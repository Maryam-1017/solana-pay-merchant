//! Solana Pay Merchant — USDC Escrow Program
//!
//! Three instructions:
//!   pay    — customer locks USDC in a PDA-owned escrow ATA
//!   claim  — merchant withdraws before the escrow deadline (unique differentiator)
//!   refund — customer reclaims after the deadline if merchant never claimed
//!
//! The escrow mechanic removes the trust-me-I-got-paid problem: funds are
//! provably locked on-chain and auto-refundable, making this safer than card
//! chargebacks while still being instant for the merchant.

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

// Replace this after `anchor build` → `anchor keys list`
declare_id!("SoPAYMerchant111111111111111111111111111111");

pub const PAYMENT_SEED: &[u8] = b"payment";

// ─── Program ─────────────────────────────────────────────────────────────────

#[program]
pub mod solana_pay_merchant {
    use super::*;

    /// Customer sends USDC (or any SPL token) into a PDA-owned escrow ATA.
    ///
    /// `reference`     — 32-byte Solana Pay reference key (base58 decoded)
    /// `amount`        — raw token units (USDC: 6 decimals, so 1 USDC = 1_000_000)
    /// `escrow_period` — seconds the merchant has to claim (0 = immediate release)
    pub fn pay(
        ctx: Context<Pay>,
        reference: [u8; 32],
        amount: u64,
        escrow_period: i64,
    ) -> Result<()> {
        require!(amount > 0, PaymentError::InvalidAmount);

        let clock = Clock::get()?;
        let rec = &mut ctx.accounts.payment;

        rec.merchant  = ctx.accounts.merchant.key();
        rec.customer  = ctx.accounts.customer.key();
        rec.mint      = ctx.accounts.mint.key();
        rec.reference = reference;
        rec.amount    = amount;
        rec.timestamp = clock.unix_timestamp;
        rec.expiry    = clock.unix_timestamp + escrow_period.max(0);
        rec.claimed   = false;
        rec.bump      = ctx.bumps.payment;

        // Customer ATA → Escrow ATA (PDA is authority, customer signs transfer)
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.customer_ata.to_account_info(),
                    to:        ctx.accounts.escrow_ata.to_account_info(),
                    authority: ctx.accounts.customer.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(PaymentReceived {
            merchant:  rec.merchant,
            customer:  rec.customer,
            mint:      rec.mint,
            reference: rec.reference,
            amount:    rec.amount,
            timestamp: rec.timestamp,
            expiry:    rec.expiry,
        });

        Ok(())
    }

    /// Merchant withdraws escrowed tokens before the deadline.
    /// Must be called by the merchant who is stored in the PaymentRecord.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let rec    = &ctx.accounts.payment;
        let clock  = Clock::get()?;
        let amount = rec.amount;
        let mkey   = rec.merchant;
        let refkey = rec.reference;
        let bump   = rec.bump;

        require!(!rec.claimed,                        PaymentError::AlreadyClaimed);
        require!(clock.unix_timestamp <= rec.expiry,  PaymentError::EscrowExpired);

        // PDA signs the transfer out of escrow
        let seeds: &[&[u8]] = &[PAYMENT_SEED, mkey.as_ref(), &refkey, &[bump]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.escrow_ata.to_account_info(),
                    to:        ctx.accounts.merchant_ata.to_account_info(),
                    authority: ctx.accounts.payment.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;

        ctx.accounts.payment.claimed = true;

        emit!(PaymentClaimed {
            merchant:  mkey,
            reference: refkey,
            amount,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Customer reclaims tokens after the escrow deadline if the merchant
    /// never called `claim`. Protects customers from merchants going dark.
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let rec    = &ctx.accounts.payment;
        let clock  = Clock::get()?;
        let amount = rec.amount;
        let mkey   = rec.merchant;
        let refkey = rec.reference;
        let bump   = rec.bump;

        require!(!rec.claimed,                        PaymentError::AlreadyClaimed);
        require!(clock.unix_timestamp > rec.expiry,   PaymentError::EscrowNotExpired);

        let seeds: &[&[u8]] = &[PAYMENT_SEED, mkey.as_ref(), &refkey, &[bump]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.escrow_ata.to_account_info(),
                    to:        ctx.accounts.customer_ata.to_account_info(),
                    authority: ctx.accounts.payment.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;

        ctx.accounts.payment.claimed = true;

        emit!(PaymentRefunded {
            customer:  ctx.accounts.customer.key(),
            reference: refkey,
            amount,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}

// ─── On-Chain State ──────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct PaymentRecord {
    pub merchant:  Pubkey,    // 32 — who receives funds
    pub customer:  Pubkey,    // 32 — who can refund after expiry
    pub mint:      Pubkey,    // 32 — SPL token mint (USDC)
    pub reference: [u8; 32], // 32 — matches Solana Pay reference key
    pub amount:    u64,       //  8 — raw token units
    pub timestamp: i64,       //  8 — Unix seconds at payment time
    pub expiry:    i64,       //  8 — Unix seconds after which refund is allowed
    pub claimed:   bool,      //  1 — true once claimed OR refunded
    pub bump:      u8,        //  1 — PDA bump seed
}
// Discriminator 8 + InitSpace 154 = 162 bytes total

// ─── Instruction Accounts ────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(reference: [u8; 32])]
pub struct Pay<'info> {
    #[account(mut)]
    pub customer: Signer<'info>,

    /// CHECK: Merchant is just a recipient pubkey; no on-chain state required
    pub merchant: UncheckedAccount<'info>,

    #[account(
        init,
        payer = customer,
        space = 8 + PaymentRecord::INIT_SPACE,
        seeds = [PAYMENT_SEED, merchant.key().as_ref(), &reference],
        bump,
    )]
    pub payment: Account<'info, PaymentRecord>,

    /// The SPL token being paid (USDC on devnet: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU)
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint      = mint,
        associated_token::authority = customer,
    )]
    pub customer_ata: Account<'info, TokenAccount>,

    /// PDA-owned ATA that holds funds in escrow until claim/refund
    #[account(
        init_if_needed,
        payer = customer,
        associated_token::mint      = mint,
        associated_token::authority = payment,
    )]
    pub escrow_ata: Account<'info, TokenAccount>,

    pub token_program:            Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program:           Program<'info, System>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub merchant: Signer<'info>,

    #[account(
        mut,
        seeds  = [PAYMENT_SEED, merchant.key().as_ref(), &payment.reference],
        bump   = payment.bump,
        constraint = payment.merchant == merchant.key() @ PaymentError::Unauthorized,
    )]
    pub payment: Account<'info, PaymentRecord>,

    #[account(
        mut,
        associated_token::mint      = mint,
        associated_token::authority = payment,
    )]
    pub escrow_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer  = merchant,
        associated_token::mint      = mint,
        associated_token::authority = merchant,
    )]
    pub merchant_ata: Account<'info, TokenAccount>,

    #[account(address = payment.mint)]
    pub mint: Account<'info, Mint>,

    pub token_program:            Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program:           Program<'info, System>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub customer: Signer<'info>,

    /// CHECK: Only needed to reconstruct the PDA seeds
    pub merchant: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds  = [PAYMENT_SEED, merchant.key().as_ref(), &payment.reference],
        bump   = payment.bump,
        constraint = payment.customer == customer.key()  @ PaymentError::Unauthorized,
        constraint = payment.merchant == merchant.key()  @ PaymentError::Unauthorized,
    )]
    pub payment: Account<'info, PaymentRecord>,

    #[account(
        mut,
        associated_token::mint      = mint,
        associated_token::authority = payment,
    )]
    pub escrow_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint      = mint,
        associated_token::authority = customer,
    )]
    pub customer_ata: Account<'info, TokenAccount>,

    #[account(address = payment.mint)]
    pub mint: Account<'info, Mint>,

    pub token_program:            Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program:           Program<'info, System>,
}

// ─── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct PaymentReceived {
    pub merchant:  Pubkey,
    pub customer:  Pubkey,
    pub mint:      Pubkey,
    #[index]
    pub reference: [u8; 32],
    pub amount:    u64,
    pub timestamp: i64,
    pub expiry:    i64,
}

#[event]
pub struct PaymentClaimed {
    pub merchant:  Pubkey,
    #[index]
    pub reference: [u8; 32],
    pub amount:    u64,
    pub timestamp: i64,
}

#[event]
pub struct PaymentRefunded {
    pub customer:  Pubkey,
    #[index]
    pub reference: [u8; 32],
    pub amount:    u64,
    pub timestamp: i64,
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum PaymentError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Payment already claimed or refunded")]
    AlreadyClaimed,
    #[msg("Escrow deadline passed — merchant can no longer claim")]
    EscrowExpired,
    #[msg("Escrow period not yet expired — refund not available")]
    EscrowNotExpired,
    #[msg("Signer is not authorized for this payment")]
    Unauthorized,
}
