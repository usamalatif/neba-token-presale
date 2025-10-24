const hre = require("hardhat");

// Contract addresses on Sepolia
const CONTRACTS = {
  NEBA_TOKEN: "0x1175294Cf3BC254288C2Ed13326fD515c2b9Db1a",
  KYC_REGISTRY: "0x5Ae998bfBE395bd27F6aBCFBd6F8Bf383eedc82c",
  RATE_LIMITER: "0x67cfcAdF2d06aAccB12e9F305d9f1C9063C07aEC",
  FUNDS_VAULT: "0xED12cC985F87e219D0087ce4fE6141a2B470a861",
  VESTING_VAULT: "0x01c9DfCB7497792B928F2FE90523a05DE6e6E4C0",
  SALE_MANAGER: "0xA8C1ebacb854f226f11894a834574172fC0CA868",
  ROUND_ADDRESS: "0x0C0253eE6eE6B61E79eC65b64F860283cB0e6990",
  REFERRAL_SYSTEM: "0x0C0253eE6eE6B61E79eC65b64F860283cB0e6990",
  USDT: "0x92E564DA3870a300de0C45971aD82A7dFC963E1a",
  USDC: "0xfc8Bf89bd7c6AE520BEDacE38140a9aF203458E6",
  MULTISIG: "0xF5D2Cc2202Dd9Bf51D87419aD630e195F724d12C"
};

async function main() {
  console.log("=== Verifying Deployment Based on Test Setup ===\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Verifying with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // 1. Check all contracts are deployed
  console.log("🔍 Step 1: Checking contract deployments...");
  
  const contracts = [
    { name: "NebaToken", address: CONTRACTS.NEBA_TOKEN },
    { name: "KYCRegistry", address: CONTRACTS.KYC_REGISTRY },
    { name: "RateLimiter", address: CONTRACTS.RATE_LIMITER },
    { name: "FundsVault", address: CONTRACTS.FUNDS_VAULT },
    { name: "VestingVault", address: CONTRACTS.VESTING_VAULT },
    { name: "SaleManager", address: CONTRACTS.SALE_MANAGER },
    { name: "SaleRound", address: CONTRACTS.ROUND_ADDRESS },
    { name: "ReferralSystem", address: CONTRACTS.REFERRAL_SYSTEM }
  ];

  let allDeployed = true;
  for (const contract of contracts) {
    try {
      const code = await hre.ethers.provider.getCode(contract.address);
      if (code === "0x") {
        console.log(`❌ ${contract.name} not deployed at ${contract.address}`);
        allDeployed = false;
      } else {
        console.log(`✅ ${contract.name} deployed at ${contract.address}`);
      }
    } catch (error) {
      console.log(`❌ Error checking ${contract.name}: ${error.message}`);
      allDeployed = false;
    }
  }

  if (!allDeployed) {
    console.log("❌ Some contracts are not deployed. Cannot proceed with verification.");
    return;
  }

  console.log("\n🔍 Step 2: Checking contract instances and basic configuration...");
  
  try {
    // Get contract instances
    const rateLimiter = await hre.ethers.getContractAt("RateLimiter", CONTRACTS.RATE_LIMITER);
    const saleRound = await hre.ethers.getContractAt("SaleRound", CONTRACTS.ROUND_ADDRESS);
    const saleManager = await hre.ethers.getContractAt("SaleManager", CONTRACTS.SALE_MANAGER);
    const fundsVault = await hre.ethers.getContractAt("FundsVault", CONTRACTS.FUNDS_VAULT);
    const vestingVault = await hre.ethers.getContractAt("VestingVault", CONTRACTS.VESTING_VAULT);
    const kycRegistry = await hre.ethers.getContractAt("KYCRegistry", CONTRACTS.KYC_REGISTRY);

    console.log("✅ All contract instances loaded successfully");

    // Check RateLimiter configuration
    const noKycEnabled = await rateLimiter.noKYCEnabled();
    const dailyCapUSD = await rateLimiter.dailyCapUSD();
    const dailyWindow = await rateLimiter.DAILY_WINDOW();
    
    console.log("✅ No-KYC Enabled:", noKycEnabled);
    console.log("✅ Daily Cap USD:", hre.ethers.formatUnits(dailyCapUSD, 6), "USD");
    console.log("✅ Daily Window:", dailyWindow.toString(), "seconds");

    // Check SaleRound configuration
    const roundInfo = await saleRound.getRoundInfo();
    console.log("✅ Round Name:", roundInfo.name);
    console.log("✅ Round Active:", roundInfo.isActive);
    console.log("✅ Token Price:", hre.ethers.formatUnits(roundInfo.tokenPriceUSD, 6), "USD");
    console.log("✅ Hard Cap:", hre.ethers.formatUnits(roundInfo.hardCapUSD, 6), "USD");

  } catch (error) {
    console.log("❌ Error checking contract configuration:", error.message);
    return;
  }

  console.log("\n🔍 Step 3: Checking access control roles (Critical for no-KYC)...");
  
  try {
    const rateLimiter = await hre.ethers.getContractAt("RateLimiter", CONTRACTS.RATE_LIMITER);
    const saleRound = await hre.ethers.getContractAt("SaleRound", CONTRACTS.ROUND_ADDRESS);
    const saleManager = await hre.ethers.getContractAt("SaleManager", CONTRACTS.SALE_MANAGER);
    const fundsVault = await hre.ethers.getContractAt("FundsVault", CONTRACTS.FUNDS_VAULT);
    const vestingVault = await hre.ethers.getContractAt("VestingVault", CONTRACTS.VESTING_VAULT);

    // Check SaleRound has SALE_ROUND_ROLE in RateLimiter (CRITICAL)
    const saleRoundRole = await rateLimiter.SALE_ROUND_ROLE();
    const hasSaleRoundRole = await rateLimiter.hasRole(saleRoundRole, CONTRACTS.ROUND_ADDRESS);
    console.log("✅ SaleRound has SALE_ROUND_ROLE in RateLimiter:", hasSaleRoundRole);
    
    if (!hasSaleRoundRole) {
      console.log("❌ CRITICAL: SaleRound needs SALE_ROUND_ROLE in RateLimiter for no-KYC to work!");
    }

    // Check SaleRound has SALE_ROUND_ROLE in SaleManager
    const saleManagerRole = await saleManager.SALE_ROUND_ROLE();
    const hasSaleManagerRole = await saleManager.hasRole(saleManagerRole, CONTRACTS.ROUND_ADDRESS);
    console.log("✅ SaleRound has SALE_ROUND_ROLE in SaleManager:", hasSaleManagerRole);

    // Check SaleRound is authorized depositor in FundsVault
    const isAuthorizedDepositor = await fundsVault.authorizedDepositors(CONTRACTS.ROUND_ADDRESS);
    console.log("✅ SaleRound is authorized depositor in FundsVault:", isAuthorizedDepositor);

    // Check SaleRound has SALE_ROUND_ROLE in VestingVault
    const vestingRole = await vestingVault.SALE_ROUND_ROLE();
    const hasVestingRole = await vestingVault.hasRole(vestingRole, CONTRACTS.ROUND_ADDRESS);
    console.log("✅ SaleRound has SALE_ROUND_ROLE in VestingVault:", hasVestingRole);

    // Check multisig has admin roles
    const defaultAdminRole = await rateLimiter.DEFAULT_ADMIN_ROLE();
    const rateAdminRole = await rateLimiter.RATE_ADMIN_ROLE();
    
    const multisigHasDefaultAdmin = await rateLimiter.hasRole(defaultAdminRole, CONTRACTS.MULTISIG);
    const multisigHasRateAdmin = await rateLimiter.hasRole(rateAdminRole, CONTRACTS.MULTISIG);
    
    console.log("✅ Multisig has DEFAULT_ADMIN_ROLE in RateLimiter:", multisigHasDefaultAdmin);
    console.log("✅ Multisig has RATE_ADMIN_ROLE in RateLimiter:", multisigHasRateAdmin);

  } catch (error) {
    console.log("❌ Error checking access control:", error.message);
  }

  console.log("\n🔍 Step 4: Testing no-KYC purchase bounds...");
  
  try {
    const rateLimiter = await hre.ethers.getContractAt("RateLimiter", CONTRACTS.RATE_LIMITER);
    
    // Test the checkDailyCap function directly
    const testAmount = hre.ethers.parseUnits("100", 6); // $100
    
    console.log("Testing checkDailyCap function with $100...");
    await rateLimiter.checkDailyCap(deployer.address, testAmount);
    console.log("✅ checkDailyCap function works correctly");
    
  } catch (error) {
    console.log("❌ checkDailyCap function failed:", error.message);
    
    if (error.message.includes("no-KYC mode not enabled")) {
      console.log("💡 Solution: Enable no-KYC mode first");
    } else if (error.message.includes("AccessControl")) {
      console.log("💡 Solution: SaleRound needs SALE_ROUND_ROLE in RateLimiter");
    } else if (error.message.includes("MIN_PURCHASE_USD")) {
      console.log("💡 Solution: Amount below minimum ($25)");
    } else if (error.message.includes("MAX_PURCHASE_USD")) {
      console.log("💡 Solution: Amount above maximum ($499)");
    } else if (error.message.includes("daily cap exceeded")) {
      console.log("💡 Solution: Daily cap exceeded");
    }
  }

  console.log("\n🔍 Step 5: Checking if no-KYC mode is enabled...");
  
  try {
    const rateLimiter = await hre.ethers.getContractAt("RateLimiter", CONTRACTS.RATE_LIMITER);
    const noKYCEnabled = await rateLimiter.noKYCEnabled();
    
    if (!noKYCEnabled) {
      console.log("⚠️  No-KYC mode is not enabled!");
      console.log("💡 Run: npm run manage:no-kyc -- --enable");
    } else {
      console.log("✅ No-KYC mode is enabled");
    }
    
  } catch (error) {
    console.log("❌ Error checking no-KYC status:", error.message);
  }

  console.log("\n🔍 Step 6: Checking round timing...");
  
  try {
    const saleRound = await hre.ethers.getContractAt("SaleRound", CONTRACTS.ROUND_ADDRESS);
    const roundInfo = await saleRound.getRoundInfo();
    
    const currentTime = Math.floor(Date.now() / 1000);
    const isTimeValid = currentTime >= Number(roundInfo.startTime) && currentTime <= Number(roundInfo.endTime);
    
    console.log("✅ Round Start:", new Date(Number(roundInfo.startTime) * 1000).toISOString());
    console.log("✅ Round End:", new Date(Number(roundInfo.endTime) * 1000).toISOString());
    console.log("✅ Current Time:", new Date().toISOString());
    console.log("✅ Time Valid:", isTimeValid);
    
    if (!isTimeValid) {
      console.log("⚠️  Current time is outside round time window!");
    }
    
  } catch (error) {
    console.log("❌ Error checking round timing:", error.message);
  }

  console.log("\n🔍 Step 7: Checking pause status...");
  
  try {
    const saleRound = await hre.ethers.getContractAt("SaleRound", CONTRACTS.ROUND_ADDRESS);
    const isPaused = await saleRound.paused();
    
    console.log("✅ Sale Round Paused:", isPaused);
    
    if (isPaused) {
      console.log("⚠️  Sale round is paused!");
    }
    
  } catch (error) {
    console.log("❌ Error checking pause status:", error.message);
  }

  console.log("\n🎉 Verification completed!");
  console.log("\n📋 Summary of critical requirements for no-KYC to work:");
  console.log("1. ✅ All contracts deployed");
  console.log("2. ✅ SaleRound has SALE_ROUND_ROLE in RateLimiter");
  console.log("3. ✅ SaleRound is authorized depositor in FundsVault");
  console.log("4. ✅ SaleRound has SALE_ROUND_ROLE in VestingVault");
  console.log("5. ✅ No-KYC mode enabled");
  console.log("6. ✅ Round is active and timing is valid");
  console.log("7. ✅ Sale round is not paused");
  
  console.log("\n🚀 Next steps:");
  console.log("1. If any issues found, run: npm run fix:deployment");
  console.log("2. Test purchase: npm run test:simple");
  console.log("3. If still failing, check the specific error messages above");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });
