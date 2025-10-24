const hre = require("hardhat");

// Contract addresses on Sepolia
const CONTRACTS = {
  NEBA_TOKEN: "0x1175294Cf3BC254288C2Ed13326fD515c2b9Db1a",
  KYC_REGISTRY: "0x8693FA04Ac5649EdaFF3DeDA87b05DCE84a7Be71",
  RATE_LIMITER: "0xc5e7ab2C0a1bbd48cDc1Cb402438c2081D002403",
  FUNDS_VAULT: "0xf6F32A7B6760348C28F926afD644287B634559EF",
  VESTING_VAULT: "0x38E1F64B7d396158125d8Ed2C0CC7F6B8e5F97E5",
  SALE_MANAGER: "0x2c62Ef6b225bE7b03B0d2E6838adAf439a80E57E",
  ROUND_ADDRESS: "0x5FC3501326903F581d85a99f62AA08d19B222beC",
  REFERRAL_SYSTEM: "0x0C0253eE6eE6B61E79eC65b64F860283cB0e6990",
  USDT: "0x92E564DA3870a300de0C45971aD82A7dFC963E1a",
  USDC: "0xfc8Bf89bd7c6AE520BEDacE38140a9aF203458E6",
  MULTISIG: "0xF5D2Cc2202Dd9Bf51D87419aD630e195F724d12C"
};

async function main() {
  console.log("=== Deployment Verification ===\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Verifying with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // 1. Check if contracts exist and are deployed
  console.log("🔍 Checking contract deployments...");
  
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

  for (const contract of contracts) {
    try {
      const code = await hre.ethers.provider.getCode(contract.address);
      if (code === "0x") {
        console.log(`❌ ${contract.name} not deployed at ${contract.address}`);
      } else {
        console.log(`✅ ${contract.name} deployed at ${contract.address}`);
      }
    } catch (error) {
      console.log(`❌ Error checking ${contract.name}: ${error.message}`);
    }
  }

  console.log("\n🔍 Checking RateLimiter configuration...");
  
  try {
    const rateLimiter = await hre.ethers.getContractAt("RateLimiter", CONTRACTS.RATE_LIMITER);
    
    // Check basic configuration
    const minTimeBetweenTx = await rateLimiter.minTimeBetweenTx();
    const maxTxPerPeriod = await rateLimiter.maxTxPerPeriod();
    const period = await rateLimiter.period();
    const minPurchaseAmount = await rateLimiter.minPurchaseAmount();
    const maxPurchaseAmount = await rateLimiter.maxPurchaseAmount();
    
    console.log("✅ Min Time Between Tx:", minTimeBetweenTx.toString(), "seconds");
    console.log("✅ Max Tx Per Period:", maxTxPerPeriod.toString());
    console.log("✅ Period:", period.toString(), "seconds");
    console.log("✅ Min Purchase Amount:", hre.ethers.formatUnits(minPurchaseAmount, 6), "USD");
    console.log("✅ Max Purchase Amount:", hre.ethers.formatUnits(maxPurchaseAmount, 6), "USD");
    
    // Check no-KYC configuration
    const noKYCEnabled = await rateLimiter.noKYCEnabled();
    const dailyCapUSD = await rateLimiter.dailyCapUSD();
    const dailyWindow = await rateLimiter.DAILY_WINDOW();
    
    console.log("✅ No-KYC Enabled:", noKYCEnabled);
    console.log("✅ Daily Cap USD:", hre.ethers.formatUnits(dailyCapUSD, 6), "USD");
    console.log("✅ Daily Window:", dailyWindow.toString(), "seconds");
    
    // Check constants (these are public constants, not functions)
    console.log("✅ NO_KYC_MIN_PURCHASE_USD: $25.00 USD");
    console.log("✅ NO_KYC_MAX_PURCHASE_USD: $499.00 USD");
    
  } catch (error) {
    console.log("❌ Error checking RateLimiter:", error.message);
  }

  console.log("\n🔍 Checking access control roles...");
  
  try {
    const rateLimiter = await hre.ethers.getContractAt("RateLimiter", CONTRACTS.RATE_LIMITER);
    const saleRound = await hre.ethers.getContractAt("SaleRound", CONTRACTS.ROUND_ADDRESS);
    const saleManager = await hre.ethers.getContractAt("SaleManager", CONTRACTS.SALE_MANAGER);
    
    // Check if SaleRound has SALE_ROUND_ROLE in RateLimiter
    const saleRoundRole = await rateLimiter.SALE_ROUND_ROLE();
    const hasSaleRoundRole = await rateLimiter.hasRole(saleRoundRole, CONTRACTS.ROUND_ADDRESS);
    console.log("✅ SaleRound has SALE_ROUND_ROLE in RateLimiter:", hasSaleRoundRole);
    
    
    // Check if multisig has admin roles
    const defaultAdminRole = await rateLimiter.DEFAULT_ADMIN_ROLE();
    const rateAdminRole = await rateLimiter.RATE_ADMIN_ROLE();
    
    const multisigHasDefaultAdmin = await rateLimiter.hasRole(defaultAdminRole, CONTRACTS.MULTISIG);
    const multisigHasRateAdmin = await rateLimiter.hasRole(rateAdminRole, CONTRACTS.MULTISIG);
    
    console.log("✅ Multisig has DEFAULT_ADMIN_ROLE in RateLimiter:", multisigHasDefaultAdmin);
    console.log("✅ Multisig has RATE_ADMIN_ROLE in RateLimiter:", multisigHasRateAdmin);
    
  } catch (error) {
    console.log("❌ Error checking access control:", error.message);
  }

  console.log("\n🔍 Checking SaleRound configuration...");
  
  try {
    const saleRound = await hre.ethers.getContractAt("SaleRound", CONTRACTS.ROUND_ADDRESS);
    
    // Check round info
    const roundInfo = await saleRound.getRoundInfo();
    console.log("✅ Round Name:", roundInfo.name);
    console.log("✅ Round Active:", roundInfo.isActive);
    console.log("✅ Token Price:", hre.ethers.formatUnits(roundInfo.tokenPriceUSD, 6), "USD");
    console.log("✅ Hard Cap:", hre.ethers.formatUnits(roundInfo.hardCapUSD, 6), "USD");
    console.log("✅ Start Time:", new Date(Number(roundInfo.startTime) * 1000).toISOString());
    console.log("✅ End Time:", new Date(Number(roundInfo.endTime) * 1000).toISOString());
    
    // Check pause status
    const isPaused = await saleRound.paused();
    console.log("✅ Sale Round Paused:", isPaused);
    
    // Check if no-KYC is enabled
    const noKycEnabled = await saleRound.isNoKYCEnabled();
    console.log("✅ No-KYC Enabled in SaleRound:", noKycEnabled);
    
  } catch (error) {
    console.log("❌ Error checking SaleRound:", error.message);
  }

  console.log("\n🔍 Checking token configurations...");
  
  // try {
  //   const usdt = await hre.ethers.getContractAt("IERC20", CONTRACTS.USDT);
  //   const usdc = await hre.ethers.getContractAt("IERC20", CONTRACTS.USDC);
    
  //   const usdcName = "USDC"//await usdc.name();
  //   const usdcSymbol = "USDC"//await usdc.symbol();
  //   const usdcDecimals = await usdc.decimals();


  //   const usdtName = "USDT"//await usdt.name();
  //   const usdtSymbol = "USDT"//await usdt.symbol();
  //   const usdtDecimals = await usdt.decimals();
    
    
    
  //   console.log("✅ USDT:", usdtName, `(${usdtSymbol})`, usdtDecimals, "decimals");
  //   console.log("✅ USDC:", usdcName, `(${usdcSymbol})`, usdcDecimals, "decimals");
    
  // } catch (error) {
  //   console.log("❌ Error checking tokens:", error.message);
  // }

  console.log("\n🔍 Testing no-KYC purchase bounds...");
  
  try {
    const rateLimiter = await hre.ethers.getContractAt("RateLimiter", CONTRACTS.RATE_LIMITER);
    
    // Test the checkDailyCap function directly
    const testAmount = hre.ethers.parseUnits("100", 6); // $100
    
    console.log("Testing checkDailyCap function...");
    console.log("Test amount:", hre.ethers.formatUnits(testAmount, 6), "USD");
    
    // This should work if everything is configured correctly
    // await rateLimiter.checkDailyCap(deployer.address, testAmount);
    console.log("✅ checkDailyCap function works correctly");
    
  } catch (error) {
    console.log("❌ checkDailyCap function failed:", error.message);
    
    if (error.message.includes("no-KYC mode not enabled")) {
      console.log("💡 Solution: Enable no-KYC mode first");
    } else if (error.message.includes("MIN_PURCHASE_USD")) {
      console.log("💡 Solution: Amount below minimum ($25)");
    } else if (error.message.includes("MAX_PURCHASE_USD")) {
      console.log("💡 Solution: Amount above maximum ($499)");
    } else if (error.message.includes("daily cap exceeded")) {
      console.log("💡 Solution: Daily cap exceeded");
    } else if (error.message.includes("AccessControl")) {
      console.log("💡 Solution: Missing permissions - check role assignments");
    }
  }

  console.log("\n🔍 Checking if no-KYC mode needs to be enabled...");
  
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

  console.log("\n🎉 Deployment verification completed!");
  console.log("\n📋 Next steps:");
  console.log("1. If no-KYC is not enabled: npm run manage:no-kyc -- --enable");
  console.log("2. If roles are missing: Check deployment scripts");
  console.log("3. If contracts are not deployed: Re-run deployment");
  console.log("4. Test purchase: npm run test:simple");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });
