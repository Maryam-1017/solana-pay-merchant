# Deploy to Devnet

## Prerequisites

```bash
# 1. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Install Solana CLI (v1.18+)
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# 3. Install Anchor CLI (v0.30)
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.1
avm use 0.30.1
```

## Step 1 — Configure devnet wallet

```bash
solana config set --url devnet
solana-keygen new --outfile ~/.config/solana/id.json   # skip if you have one
solana airdrop 2                                        # get devnet SOL
```

## Step 2 — Build the program

```bash
cd anchor-program
anchor build
```

## Step 3 — Get the program ID and update files

```bash
anchor keys list
# Output: solana_pay_merchant: <PROGRAM_ID>
```

Copy the `<PROGRAM_ID>`, then update **two places**:

**`anchor-program/programs/solana-pay-merchant/src/lib.rs`** line 1:
```rust
declare_id!("<PROGRAM_ID>");
```

**`anchor-program/Anchor.toml`**:
```toml
[programs.devnet]
solana_pay_merchant = "<PROGRAM_ID>"
```

Then rebuild:
```bash
anchor build
```

## Step 4 — Deploy

```bash
anchor deploy --provider.cluster devnet
```

Expected output:
```
Program Id: <PROGRAM_ID>
Deploy success
```

## Step 5 — Run tests on localnet

```bash
anchor test          # spins up a local validator, runs all 4 tests
```

## Step 6 — Add program ID to backend

In `backend/.env`, add:
```
PROGRAM_ID=<PROGRAM_ID>
```

---

## Key Accounts (devnet)

| Name | Address |
|---|---|
| USDC Mint (devnet) | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |

## Get devnet USDC

Visit the Circle USDC faucet or use the Solana devnet token airdrop:
```bash
spl-token create-account 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
# Then request from a devnet USDC faucet
```

---

## How Escrow Works (demo pitch point)

```
Customer scans QR → sends USDC to on-chain escrow PDA
                  ↓
        Merchant has 24hrs to call claim()
                  ↓
    ┌─────────────────────────────┐
    │  Claimed in time?           │
    │  YES → USDC to merchant     │
    │  NO  → customer calls       │
    │         refund() to get     │
    │         USDC back           │
    └─────────────────────────────┘
```

This replaces chargebacks: no bank needed, fully on-chain, auditable.
