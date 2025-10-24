const hre = require("hardhat");

// Contract addresses on Sepolia
const CONTRACTS = {
  RATE_LIMITER: "0x67cfcAdF2d06aAccB12e9F305d9f1C9063C07aEC",
  ROUND_ADDRESS: "0x0C0253eE6eE6B61E79eC65b64F860283cB0e6990",
  SALE_MANAGER: "0xA8C1ebacb854f226f11894a834574172fC0CA868",
  MULTISIG: "0xF5D2Cc2202Dd9Bf51D87419aD630e195F724d12C"
};

async function main() {
  console.log("=== Fixing Deployment Issues ===\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Fixing with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  try {
    const rateLimiter = await hre.ethers.getContractAt("RateLimiter", CONTRACTS.RATE_LIMITER);
    const saleRound = await hre.ethers.getContractAt("SaleRound", CONTRACTS.ROUND_ADDRESS);
    const saleManager = await hre.ethers.getContractAt("SaleManager", CONTRACTS.SALE_MANAGER);

    console.log("🔧 Fixing access control roles...");

    // 1. Grant SALE_ROUND_ROLE to SaleRound in RateLimiter (CRITICAL for no-KYC)
    try {
      const saleRoundRole = await rateLimiter.SALE_ROUND_ROLE();
      const hasRole = await rateLimiter.hasRole(saleRoundRole, CONTRACTS.ROUND_ADDRESS);
      
      if (!hasRole) {
        console.log("Granting SALE_ROUND_ROLE to SaleRound in RateLimiter...");
        const grantTx = await rateLimiter.grantRole(saleRoundRole, CONTRACTS.ROUND_ADDRESS);
        await grantTx.wait();
        console.log("✅ SALE_ROUND_ROLE granted to SaleRound in RateLimiter");
      } else {
        console.log("✅ SaleRound already has SALE_ROUND_ROLE in RateLimiter");
      }
    } catch (error) {
      console.log("❌ Error granting SALE_ROUND_ROLE:", error.message);
    }

    // 2. Grant SALE_ROUND_ROLE to SaleRound in SaleManager
    try {
      const saleManagerRole = await saleManager.SALE_ROUND_ROLE();
      const hasRole = await saleManager.hasRole(saleManagerRole, CONTRACTS.ROUND_ADDRESS);
      
      if (!hasRole) {
        console.log("Granting SALE_ROUND_ROLE to SaleRound in SaleManager...");
        const grantTx = await saleManager.grantRole(saleManagerRole, CONTRACTS.ROUND_ADDRESS);
        await grantTx.wait();
        console.log("✅ SALE_ROUND_ROLE granted to SaleRound in SaleManager");
      } else {
        console.log("✅ SaleRound already has SALE_ROUND_ROLE in SaleManager");
      }
    } catch (error) {
      console.log("❌ Error granting SALE_ROUND_ROLE in SaleManager:", error.message);
    }

    // 3. Enable no-KYC mode
    try {
      const noKycEnabled = await rateLimiter.noKYCEnabled();
      
      if (!noKycEnabled) {
        console.log("Enabling no-KYC mode...");
        const enableTx = await rateLimiter.enableNoKYCMode();
        await enableTx.wait();
        console.log("✅ No-KYC mode enabled");
      } else {
        console.log("✅ No-KYC mode already enabled");
      }
    } catch (error) {
      console.log("❌ Error enabling no-KYC mode:", error.message);
    }

    // 4. Check if multisig has admin roles
    try {
      const defaultAdminRole = await rateLimiter.DEFAULT_ADMIN_ROLE();
      const rateAdminRole = await rateLimiter.RATE_ADMIN_ROLE();
      
      const multisigHasDefaultAdmin = await rateLimiter.hasRole(defaultAdminRole, CONTRACTS.MULTISIG);
      const multisigHasRateAdmin = await rateLimiter.hasRole(rateAdminRole, CONTRACTS.MULTISIG);
      
      console.log("Multisig has DEFAULT_ADMIN_ROLE:", multisigHasDefaultAdmin);
      console.log("Multisig has RATE_ADMIN_ROLE:", multisigHasRateAdmin);
      
      if (!multisigHasDefaultAdmin) {
        console.log("⚠️  Multisig doesn't have DEFAULT_ADMIN_ROLE - this might cause issues");
      }
      
      if (!multisigHasRateAdmin) {
        console.log("⚠️  Multisig doesn't have RATE_ADMIN_ROLE - this might cause issues");
      }
    } catch (error) {
      console.log("❌ Error checking multisig roles:", error.message);
    }

    console.log("\n🎉 Deployment fixes completed!");
    console.log("\n📋 Next steps:");
    console.log("1. Run: npm run verify:deployment");
    console.log("2. Run: npm run test:simple");
    console.log("3. If still failing, check the verification output for specific issues");

  } catch (error) {
    console.log("❌ Error during fix:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fix failed:", error);
    process.exit(1);
  });
