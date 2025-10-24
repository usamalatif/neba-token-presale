const hre = require("hardhat");

async function main() {
  console.log("=== Resuming No-KYC Deployment ===\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Resuming with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // Multisig address
  const multisigAddress = "0xF5D2Cc2202Dd9Bf51D87419aD630e195F724d12C";
  console.log("Multisig address:", multisigAddress);

  // Contract addresses from previous deployment
  const contracts = {
    kycRegistry: "0x8693FA04Ac5649EdaFF3DeDA87b05DCE84a7Be71",
    rateLimiter: "0xc5e7ab2C0a1bbd48cDc1Cb402438c2081D002403",
    fundsVault: "0xf6F32A7B6760348C28F926afD644287B634559EF",
    vestingVault: "0x38E1F64B7d396158125d8Ed2C0CC7F6B8e5F97E5",
    saleManager: "0x2c62Ef6b225bE7b03B0d2E6838adAf439a80E57E",
    usdc: "0xfc8Bf89bd7c6AE520BEDacE38140a9aF203458E6",
    usdt: "0x92E564DA3870a300de0C45971aD82A7dFC963E1a",
    nebaToken: "0x1175294Cf3BC254288C2Ed13326fD515c2b9Db1a",
    oracle: "0x694AA1769357215DE4FAC081bf1f309aDC325306"
  };

  console.log("📋 Using deployed contract addresses:");
  console.log("KYCRegistry:", contracts.kycRegistry);
  console.log("RateLimiter:", contracts.rateLimiter);
  console.log("FundsVault:", contracts.fundsVault);
  console.log("VestingVault:", contracts.vestingVault);
  console.log("SaleManager:", contracts.saleManager);

  // Get contract instances
  const saleManager = await hre.ethers.getContractAt("SaleManager", contracts.saleManager);
  const rateLimiter = await hre.ethers.getContractAt("RateLimiter", contracts.rateLimiter);
  const fundsVault = await hre.ethers.getContractAt("FundsVault", contracts.fundsVault);
  const vestingVault = await hre.ethers.getContractAt("VestingVault", contracts.vestingVault);

  // Step 1: Get the round address (assuming round 0 was created)
  console.log("\n🔍 Step 1: Getting round address...");
  
  let roundAddress;
  try {
    roundAddress = await saleManager.getRound(0);
    console.log("✅ Round 0 found at:", roundAddress);
  } catch (error) {
    console.log("❌ Error getting round 0:", error.message);
    console.log("💡 The round might not have been created yet. Please check the transaction status.");
    return;
  }

  const saleRound = await hre.ethers.getContractAt("SaleRound", roundAddress);
  console.log("✅ SaleRound contract instance created");

  // Step 2: Check round configuration
  console.log("\n📋 Step 2: Checking round configuration...");
  
  try {
    const roundInfo = await saleRound.getRoundInfo();
    console.log("✅ Round Name:", roundInfo.name);
    console.log("✅ Round Active:", roundInfo.isActive);
    console.log("✅ Token Price:", hre.ethers.formatUnits(roundInfo.tokenPriceUSD, 6), "USD");
    console.log("✅ Hard Cap:", hre.ethers.formatUnits(roundInfo.hardCapUSD, 6), "USD");
    console.log("✅ Start Time:", new Date(Number(roundInfo.startTime) * 1000).toISOString());
    console.log("✅ End Time:", new Date(Number(roundInfo.endTime) * 1000).toISOString());
  } catch (error) {
    console.log("❌ Error checking round info:", error.message);
    return;
  }

  // Step 3: Set up access control roles (CRITICAL for no-KYC)
  console.log("\n🔐 Step 3: Setting up access control roles...");
  
  try {
    // Grant SALE_ROUND_ROLE to SaleRound in RateLimiter
    const saleRoundRole = await rateLimiter.SALE_ROUND_ROLE();
    const hasRateLimiterRole = await rateLimiter.hasRole(saleRoundRole, roundAddress);
    
    if (!hasRateLimiterRole) {
      console.log("Granting SALE_ROUND_ROLE to SaleRound in RateLimiter...");
      await rateLimiter.grantRole(saleRoundRole, roundAddress);
      console.log("✅ SaleRound granted SALE_ROUND_ROLE in RateLimiter");
    } else {
      console.log("✅ SaleRound already has SALE_ROUND_ROLE in RateLimiter");
    }
    
    // Grant SALE_ROUND_ROLE to SaleRound in VestingVault
    const vestingRole = await vestingVault.SALE_ROUND_ROLE();
    const hasVestingRole = await vestingVault.hasRole(vestingRole, roundAddress);
    
    if (!hasVestingRole) {
      console.log("Granting SALE_ROUND_ROLE to SaleRound in VestingVault...");
      await vestingVault.grantRole(vestingRole, roundAddress);
      console.log("✅ SaleRound granted SALE_ROUND_ROLE in VestingVault");
    } else {
      console.log("✅ SaleRound already has SALE_ROUND_ROLE in VestingVault");
    }
    
    // Authorize SaleRound as depositor in FundsVault
    const isAuthorizedDepositor = await fundsVault.authorizedDepositors(roundAddress);
    
    if (!isAuthorizedDepositor) {
      console.log("Authorizing SaleRound as depositor in FundsVault...");
      await fundsVault.authorizeDepositor(roundAddress);
      console.log("✅ SaleRound authorized as depositor in FundsVault");
    } else {
      console.log("✅ SaleRound already authorized as depositor in FundsVault");
    }
    
  } catch (error) {
    console.log("❌ Error setting up access control roles:", error.message);
    return;
  }

  // Step 4: Enable no-KYC mode
  console.log("\n🚀 Step 4: Enabling no-KYC mode...");
  
  try {
    const noKycEnabled = await rateLimiter.noKYCEnabled();
    
    if (!noKycEnabled) {
      console.log("Enabling no-KYC mode...");
      await rateLimiter.enableNoKYCMode();
      console.log("✅ No-KYC mode enabled");
    } else {
      console.log("✅ No-KYC mode already enabled");
    }
  } catch (error) {
    console.log("❌ Error enabling no-KYC mode:", error.message);
    return;
  }

  // Step 5: Check token balances
  console.log("\n💰 Step 5: Checking token balances...");
  
  try {
    const usdc = await hre.ethers.getContractAt("IERC20", contracts.usdc);
    const usdt = await hre.ethers.getContractAt("IERC20", contracts.usdt);
    
    const usdcBalance = await usdc.balanceOf(deployer.address);
    const usdtBalance = await usdt.balanceOf(deployer.address);
    console.log("✅ USDC balance:", hre.ethers.formatUnits(usdcBalance, 6), "USDC");
    console.log("✅ USDT balance:", hre.ethers.formatUnits(usdtBalance, 6), "USDT");
    
    if (usdcBalance === 0n && usdtBalance === 0n) {
      console.log("⚠️  No USDC/USDT balance. You may need to get test tokens from a faucet.");
    }
  } catch (error) {
    console.log("❌ Error checking token balances:", error.message);
  }

  // Step 6: Verify deployment
  console.log("\n🔍 Step 6: Verifying deployment...");
  
  try {
    // Check no-KYC is enabled
    const noKycEnabled = await rateLimiter.noKYCEnabled();
    console.log("✅ No-KYC enabled:", noKycEnabled);
    
    // Check roles
    const saleRoundRole = await rateLimiter.SALE_ROUND_ROLE();
    const vestingRole = await vestingVault.SALE_ROUND_ROLE();
    
    const hasRateLimiterRole = await rateLimiter.hasRole(saleRoundRole, roundAddress);
    const hasVestingRole = await vestingVault.hasRole(vestingRole, roundAddress);
    const isAuthorizedDepositor = await fundsVault.authorizedDepositors(roundAddress);
    
    console.log("✅ SaleRound has SALE_ROUND_ROLE in RateLimiter:", hasRateLimiterRole);
    console.log("✅ SaleRound has SALE_ROUND_ROLE in VestingVault:", hasVestingRole);
    console.log("✅ SaleRound is authorized depositor in FundsVault:", isAuthorizedDepositor);
    
    // Check round info
    const roundInfo = await saleRound.getRoundInfo();
    console.log("✅ Round name:", roundInfo.name);
    console.log("✅ Round active:", roundInfo.isActive);
    
  } catch (error) {
    console.log("❌ Error during verification:", error.message);
  }

  // Step 7: Save updated deployment info
  console.log("\n💾 Step 7: Saving deployment info...");
  
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    multisig: multisigAddress,
    contracts: {
      nebaToken: contracts.nebaToken,
      kycRegistry: contracts.kycRegistry,
      rateLimiter: contracts.rateLimiter,
      fundsVault: contracts.fundsVault,
      vestingVault: contracts.vestingVault,
      saleManager: contracts.saleManager,
      saleRound: roundAddress,
      usdc: contracts.usdc,
      usdt: contracts.usdt,
      oracle: contracts.oracle
    },
    deploymentTime: new Date().toISOString(),
    noKycEnabled: await rateLimiter.noKYCEnabled()
  };
  
  const fs = require('fs');
  const filename = `deployments-${hre.network.name}-resumed.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ Deployment info saved to:", filename);

  console.log("\n🎉 Resume deployment completed successfully!");
  console.log("\n📋 Final Contract Addresses:");
  console.log("NebaToken:", contracts.nebaToken);
  console.log("KYCRegistry:", contracts.kycRegistry);
  console.log("RateLimiter:", contracts.rateLimiter);
  console.log("FundsVault:", contracts.fundsVault);
  console.log("VestingVault:", contracts.vestingVault);
  console.log("SaleManager:", contracts.saleManager);
  console.log("SaleRound:", roundAddress);
  console.log("USDC:", contracts.usdc);
  console.log("USDT:", contracts.usdt);
  console.log("Oracle:", contracts.oracle);
  
  console.log("\n🚀 Next steps:");
  console.log("1. Test no-KYC purchase: npm run test:gas-optimized");
  console.log("2. Verify deployment: npm run verify:test-setup");
  console.log("3. Check system status: npm run manage:no-kyc -- --status");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Resume deployment failed:", error);
    process.exit(1);
  });
