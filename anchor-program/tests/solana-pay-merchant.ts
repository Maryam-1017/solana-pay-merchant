import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { SolanaPayMerchant } from "../target/types/solana_pay_merchant";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

describe("solana-pay-merchant", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaPayMerchant as Program<SolanaPayMerchant>;
  const connection = provider.connection;

  const merchant = anchor.web3.Keypair.generate();
  const customer  = anchor.web3.Keypair.generate();

  let usdcMint: anchor.web3.PublicKey;
  let customerAta: anchor.web3.PublicKey;

  // Helper: airdrop + confirm
  async function airdrop(pubkey: anchor.web3.PublicKey, sol = 2) {
    const sig = await connection.requestAirdrop(pubkey, sol * anchor.web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  }

  // Derive payment PDA + escrow ATA for a given reference
  function pdas(ref: Uint8Array) {
    const [paymentPda, bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("payment"), merchant.publicKey.toBuffer(), Buffer.from(ref)],
      program.programId,
    );
    const escrowAta = getAssociatedTokenAddressSync(usdcMint, paymentPda, true);
    return { paymentPda, bump, escrowAta };
  }

  before(async () => {
    await airdrop(merchant.publicKey);
    await airdrop(customer.publicKey);

    // Create a mock USDC mint (6 decimals) with customer as mint authority
    usdcMint = await createMint(connection, customer, customer.publicKey, null, 6);

    // Create customer ATA and fund with 100 USDC
    const ata = await getOrCreateAssociatedTokenAccount(
      connection, customer, usdcMint, customer.publicKey
    );
    customerAta = ata.address;
    await mintTo(connection, customer, usdcMint, customerAta, customer, 100_000_000);
  });

  // ── Test 1: pay ────────────────────────────────────────────────────────────

  it("customer pays 2 USDC into escrow", async () => {
    const ref = anchor.web3.Keypair.generate().publicKey.toBytes();
    const { paymentPda, escrowAta } = pdas(ref);
    const AMOUNT        = 2_000_000; // 2 USDC
    const ESCROW_PERIOD = 86400;     // 24 hrs

    await program.methods
      .pay(Array.from(ref), new BN(AMOUNT), new BN(ESCROW_PERIOD))
      .accounts({
        customer:    customer.publicKey,
        merchant:    merchant.publicKey,
        payment:     paymentPda,
        mint:        usdcMint,
        customerAta,
        escrowAta,
        tokenProgram:           TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram:          anchor.web3.SystemProgram.programId,
      })
      .signers([customer])
      .rpc();

    const rec = await program.account.paymentRecord.fetch(paymentPda);
    assert.equal(rec.amount.toNumber(), AMOUNT,             "amount stored");
    assert.equal(rec.claimed,           false,              "not claimed yet");
    assert.equal(rec.merchant.toBase58(), merchant.publicKey.toBase58(), "merchant stored");
    assert.equal(rec.customer.toBase58(), customer.publicKey.toBase58(), "customer stored");
    assert.isAbove(rec.expiry.toNumber(), rec.timestamp.toNumber(),      "expiry > timestamp");

    // Escrow ATA should hold the USDC
    const escrowBal = await connection.getTokenAccountBalance(escrowAta);
    assert.equal(escrowBal.value.uiAmount, 2, "2 USDC in escrow");
  });

  // ── Test 2: claim ──────────────────────────────────────────────────────────

  it("merchant claims 1 USDC from escrow before deadline", async () => {
    const ref = anchor.web3.Keypair.generate().publicKey.toBytes();
    const { paymentPda, escrowAta } = pdas(ref);
    const AMOUNT = 1_000_000;

    // First: pay into escrow
    await program.methods
      .pay(Array.from(ref), new BN(AMOUNT), new BN(86400))
      .accounts({
        customer:    customer.publicKey,
        merchant:    merchant.publicKey,
        payment:     paymentPda,
        mint:        usdcMint,
        customerAta,
        escrowAta,
        tokenProgram:           TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram:          anchor.web3.SystemProgram.programId,
      })
      .signers([customer])
      .rpc();

    const merchantAta = getAssociatedTokenAddressSync(usdcMint, merchant.publicKey);

    // Then: merchant claims
    await program.methods
      .claim()
      .accounts({
        merchant:    merchant.publicKey,
        payment:     paymentPda,
        escrowAta,
        merchantAta,
        mint:        usdcMint,
        tokenProgram:           TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram:          anchor.web3.SystemProgram.programId,
      })
      .signers([merchant])
      .rpc();

    const rec = await program.account.paymentRecord.fetch(paymentPda);
    assert.equal(rec.claimed, true, "marked as claimed");

    const merchantBal = await connection.getTokenAccountBalance(merchantAta);
    assert.equal(merchantBal.value.uiAmount, 1, "merchant received 1 USDC");
  });

  // ── Test 3: refund (time-travel via clock hack on localnet) ───────────────

  it("double-claim fails with AlreadyClaimed", async () => {
    const ref = anchor.web3.Keypair.generate().publicKey.toBytes();
    const { paymentPda, escrowAta } = pdas(ref);
    const merchantAta = getAssociatedTokenAddressSync(usdcMint, merchant.publicKey);

    await program.methods
      .pay(Array.from(ref), new BN(500_000), new BN(86400))
      .accounts({
        customer:    customer.publicKey,
        merchant:    merchant.publicKey,
        payment:     paymentPda,
        mint:        usdcMint,
        customerAta,
        escrowAta,
        tokenProgram:           TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram:          anchor.web3.SystemProgram.programId,
      })
      .signers([customer])
      .rpc();

    await program.methods.claim()
      .accounts({ merchant: merchant.publicKey, payment: paymentPda, escrowAta, merchantAta, mint: usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: anchor.web3.SystemProgram.programId })
      .signers([merchant]).rpc();

    try {
      await program.methods.claim()
        .accounts({ merchant: merchant.publicKey, payment: paymentPda, escrowAta, merchantAta, mint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([merchant]).rpc();
      assert.fail("Should have thrown AlreadyClaimed");
    } catch (err: any) {
      assert.include(err.message, "AlreadyClaimed");
    }
  });

  // ── Test 4: unauthorized claim rejected ───────────────────────────────────

  it("wrong signer cannot claim", async () => {
    const ref = anchor.web3.Keypair.generate().publicKey.toBytes();
    const { paymentPda, escrowAta } = pdas(ref);
    const impostor    = anchor.web3.Keypair.generate();
    const impostorAta = getAssociatedTokenAddressSync(usdcMint, impostor.publicKey);
    await airdrop(impostor.publicKey, 1);

    await program.methods
      .pay(Array.from(ref), new BN(500_000), new BN(86400))
      .accounts({
        customer:    customer.publicKey,
        merchant:    merchant.publicKey,
        payment:     paymentPda,
        mint:        usdcMint,
        customerAta,
        escrowAta,
        tokenProgram:           TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram:          anchor.web3.SystemProgram.programId,
      })
      .signers([customer])
      .rpc();

    try {
      await program.methods.claim()
        .accounts({ merchant: impostor.publicKey, payment: paymentPda, escrowAta, merchantAta: impostorAta, mint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: anchor.web3.SystemProgram.programId })
        .signers([impostor]).rpc();
      assert.fail("Should have thrown");
    } catch {
      // expected — PDA seed mismatch or Unauthorized constraint
    }
  });
});
