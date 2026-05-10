// Anchor migration — runs once after `anchor deploy`
// No on-chain state to migrate; all state lives in PDAs created at runtime.
module.exports = async function (_provider: any) {
  console.log("solana-pay-merchant deployed. No migration steps needed.");
  console.log("Next: update PROGRAM_ID in your backend .env and frontend config.");
};
