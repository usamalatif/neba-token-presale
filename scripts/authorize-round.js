const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Authorizing Sale Round ===\n");

  const [deployer] = await hre.ethers.getSigners();
  const deployment = JSON.parse(fs.readFileSync(`deployments-${hre.network.name}.json`, "utf8"));
  
  const fundsVaultAddress = deployment.contracts.FundsVault;
  const rateLimiterAddress = deployment.contracts.RateLimiter;
  const roundAddress = "0x0C0253eE6eE6B61E79eC65b64F860283cB0e6990";
  
  console.log("Funds Vault:", fundsVaultAddress);
  console.log("Rate Limiter:", rateLimiterAddress);
  console.log("Sale Round:", roundAddress);
  console.log("Your Account:", deployer.address, "\n");
  
  // 1. Authorize in FundsVault
  console.log("1. Authorizing round in FundsVault...");
  const fundsVault = await hre.ethers.getContractAt("FundsVault", fundsVaultAddress);
  const tx1 = await fundsVault.authorizeDepositor(roundAddress);
  await tx1.wait();
  console.log("✅ Round authorized in FundsVault");
  console.log("   Tx:", tx1.hash, "\n");
  
  // 2. Grant SALE_ROUND_ROLE in RateLimiter
  console.log("2. Granting SALE_ROUND_ROLE in RateLimiter...");
  const rateLimiter = await hre.ethers.getContractAt("RateLimiter", rateLimiterAddress);
  const SALE_ROUND_ROLE = await rateLimiter.SALE_ROUND_ROLE();
  const tx2 = await rateLimiter.grantRole(SALE_ROUND_ROLE, roundAddress);
  await tx2.wait();
  console.log("✅ SALE_ROUND_ROLE granted");
  console.log("   Tx:", tx2.hash, "\n");
  
  console.log("🎉 Round fully authorized and ready for purchases!");
  console.log("\nNext:");
  console.log("1. Add users to KYC whitelist:");
  console.log("   node scripts/manage-kyc.js add <address>");
  console.log("\n2. Users can now purchase with referrals:");
  console.log("   await saleRound.buyWithUSDC(amount, referrerAddress)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

