const hre = require("hardhat");

async function main() {
  console.log("=== Deploying Complete No-KYC System ===\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // Multisig addresses
  const primaryMultisigAddress = "0xF5D2Cc2202Dd9Bf51D87419aD630e195F724d12C";
  const secondaryMultisigAddress = "0x0000000000000000000000000000000000000000"; // TODO: Set your secondary multisig address
  console.log("Primary multisig address:", primaryMultisigAddress);
  console.log("Secondary multisig address:", secondaryMultisigAddress);

  // Step 1: Use existing contracts
  console.log("📦 Step 1: Using existing contracts...");
  
  const usdcAddress = "0xfc8Bf89bd7c6AE520BEDacE38140a9aF203458E6";
  const usdtAddress = "0x92E564DA3870a300de0C45971aD82A7dFC963E1a";
  const nebaTokenAddress = "0x1175294Cf3BC254288C2Ed13326fD515c2b9Db1a";
  const oracleAddress = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
  
  const usdc = await hre.ethers.getContractAt("IERC20", usdcAddress);
  const usdt = await hre.ethers.getContractAt("IERC20", usdtAddress);
  
  console.log("✅ Using existing USDC at:", usdcAddress);
  console.log("✅ Using existing USDT at:", usdtAddress);
  console.log("✅ Using existing NebaToken at:", nebaTokenAddress);
  console.log("✅ Using existing Oracle at:", oracleAddress);

  // Step 2: Deploy infrastructure contracts
  console.log("\n🏗️ Step 2: Deploying infrastructure contracts...");
  
  const KYCRegistry = await hre.ethers.getContractFactory("KYCRegistry");
  const kycRegistry = await KYCRegistry.deploy(primaryMultisigAddress);
  await kycRegistry.waitForDeployment();
  console.log("✅ KYCRegistry deployed at:", await kycRegistry.getAddress());
  
  const RateLimiter = await hre.ethers.getContractFactory("RateLimiter");
  const rateLimiter = await RateLimiter.deploy(primaryMultisigAddress);
  await rateLimiter.waitForDeployment();
  console.log("✅ RateLimiter deployed at:", await rateLimiter.getAddress());
  
  const FundsVault = await hre.ethers.getContractFactory("FundsVault");
  const fundsVault = await FundsVault.deploy(primaryMultisigAddress, secondaryMultisigAddress);
  await fundsVault.waitForDeployment();
  console.log("✅ FundsVault deployed at:", await fundsVault.getAddress());
  
  const VestingVault = await hre.ethers.getContractFactory("VestingVault");
  const vestingVault = await VestingVault.deploy(nebaTokenAddress);
  await vestingVault.waitForDeployment();
  console.log("✅ VestingVault deployed at:", await vestingVault.getAddress());

  // Step 3: Deploy SaleManager
  console.log("\n🎯 Step 3: Deploying SaleManager...");
  
  const SaleManager = await hre.ethers.getContractFactory("SaleManager");
  const saleManager = await SaleManager.deploy(
    nebaTokenAddress,
    await kycRegistry.getAddress(),
    await rateLimiter.getAddress(),
    await vestingVault.getAddress(),
    await fundsVault.getAddress(),
    usdcAddress,
    usdtAddress,
    oracleAddress,
    primaryMultisigAddress
  );
  await saleManager.waitForDeployment();
  console.log("✅ SaleManager deployed at:", await saleManager.getAddress());

  // Step 4: Initialize VestingVault
  console.log("\n🔧 Step 4: Initializing VestingVault...");
  
  await vestingVault.initialize(await saleManager.getAddress());
  console.log("✅ VestingVault initialized with SaleManager");

  // Step 5: Create sale round
  console.log("\n📋 Step 5: Creating sale round...");
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const config = {
    name: "Private Sale",
    tokenPriceUSD: 50000,  // $0.05 USD (6 decimals: 0.05 * 1,000,000)
    hardCapUSD: hre.ethers.parseUnits("500000", 6), // $500,000 USD
    startTime: currentTimestamp,
    endTime: currentTimestamp + (30 * 24 * 60 * 60), // 30 days from now
    cliffDuration: 180 * 24 * 60 * 60, // 180 days (6 months)
    vestingDuration: 365 * 24 * 60 * 60, // 365 days (12 months)
    isActive: true,
  };

  console.log("Private Sale Round Configuration:");
  console.log("─────────────────────────────────────");
  console.log("  Name:", config.name);
  console.log("  Token Price: $0.05 USD");
  console.log("  Hard Cap: $500,000 USD");
  console.log("  Start:", new Date(config.startTime * 1000).toLocaleString());
  console.log("Start Time in same Format (For verification):", currentTimestamp);
  console.log("  End:", new Date(config.endTime * 1000).toLocaleString());
  console.log("End Time in same Format (For verification):", currentTimestamp + (30 * 24 * 60 * 60));
  console.log("  Cliff Period: 6 months (180 days)");
  console.log("  Vesting Period: 12 months (365 days)");
  console.log("  Status: Active");
  console.log("─────────────────────────────────────\n");
  
  await saleManager.createRound(config);
  const roundAddress = await saleManager.getRound(0);
  const saleRound = await hre.ethers.getContractAt("SaleRound", roundAddress);
  console.log("✅ Sale round created at:", roundAddress);

  // Step 6: Set up access control roles (CRITICAL for no-KYC)
  console.log("\n🔐 Step 6: Setting up access control roles...");
  
  // Grant SALE_ROUND_ROLE to SaleRound in RateLimiter
  const saleRoundRole = await rateLimiter.SALE_ROUND_ROLE();
  await rateLimiter.grantRole(saleRoundRole, roundAddress);
  console.log("✅ SaleRound granted SALE_ROUND_ROLE in RateLimiter");
  
  await saleManager.authorizeSaleRound(0);
  console.log("✅ SaleRound authorized in SaleManager (ReferralSystem role granted)");
  
  // Grant SALE_ROUND_ROLE to SaleRound in VestingVault (direct assignment for security)
  const vestingRole = await vestingVault.SALE_ROUND_ROLE();
  await vestingVault.grantRole(vestingRole, roundAddress);
  console.log("✅ SaleRound granted SALE_ROUND_ROLE in VestingVault");
  
  // Authorize SaleRound as depositor in FundsVault
  await fundsVault.authorizeDepositor(roundAddress);
  console.log("✅ SaleRound authorized as depositor in FundsVault");
  
  // Step 7: Enable no-KYC mode
  console.log("\n🚀 Step 7: Enabling no-KYC mode...");
  
  await rateLimiter.enableNoKYCMode();
  console.log("✅ No-KYC mode enabled");

  // Step 8: Check existing token balances
  console.log("\n💰 Step 8: Checking token balances...");
  
  const usdcBalance = await usdc.balanceOf(deployer.address);
  const usdtBalance = await usdt.balanceOf(deployer.address);
  console.log("✅ USDC balance:", hre.ethers.formatUnits(usdcBalance, 6), "USDC");
  console.log("✅ USDT balance:", hre.ethers.formatUnits(usdtBalance, 6), "USDT");
  
  if (usdcBalance === 0n && usdtBalance === 0n) {
    console.log("⚠️  No USDC/USDT balance. You may need to get test tokens from a faucet.");
  }

  // Step 9: Verify deployment
  console.log("\n🔍 Step 9: Verifying deployment...");
  
  // Check no-KYC is enabled
  const noKycEnabled = await rateLimiter.noKYCEnabled();
  console.log("✅ No-KYC enabled:", noKycEnabled);
  
  // Check round info
  const roundInfo = await saleRound.getRoundInfo();
  console.log("✅ Round name:", roundInfo.name);
  console.log("✅ Round active:", roundInfo.isActive);
  console.log("✅ Token price:", hre.ethers.formatUnits(roundInfo.tokenPriceUSD, 6), "USD");
  
  // Check roles
  const hasRateLimiterRole = await rateLimiter.hasRole(saleRoundRole, roundAddress);
  const hasVestingRole = await vestingVault.hasRole(vestingRole, roundAddress);
  const isAuthorizedDepositor = await fundsVault.authorizedDepositors(roundAddress);
  
  console.log("✅ SaleRound has SALE_ROUND_ROLE in RateLimiter:", hasRateLimiterRole);
  console.log("✅ SaleRound has SALE_ROUND_ROLE in VestingVault:", hasVestingRole);
  console.log("✅ SaleRound is authorized depositor in FundsVault:", isAuthorizedDepositor);

  // Step 10: Save deployment addresses
  console.log("\n💾 Step 10: Saving deployment addresses...");
  
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    primaryMultisig: primaryMultisigAddress,
    secondaryMultisig: secondaryMultisigAddress,
    contracts: {
      nebaToken: nebaTokenAddress,
      kycRegistry: await kycRegistry.getAddress(),
      rateLimiter: await rateLimiter.getAddress(),
      fundsVault: await fundsVault.getAddress(),
      vestingVault: await vestingVault.getAddress(),
      saleManager: await saleManager.getAddress(),
      saleRound: roundAddress,
      usdc: usdcAddress,
      usdt: usdtAddress,
      oracle: oracleAddress
    },
    deploymentTime: new Date().toISOString(),
    noKycEnabled: noKycEnabled
  };
  
  const fs = require('fs');
  const filename = `deployments-${hre.network.name}-no-kyc.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ Deployment info saved to:", filename);

  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📋 Contract Addresses:");
  console.log("NebaToken:", nebaTokenAddress);
  console.log("KYCRegistry:", await kycRegistry.getAddress());
  console.log("RateLimiter:", await rateLimiter.getAddress());
  console.log("FundsVault:", await fundsVault.getAddress());
  console.log("VestingVault:", await vestingVault.getAddress());
  console.log("SaleManager:", await saleManager.getAddress());
  console.log("SaleRound:", roundAddress);
  console.log("USDC:", usdcAddress);
  console.log("USDT:", usdtAddress);
  console.log("Oracle:", oracleAddress);
  
  console.log("\n🚀 Next steps:");
  console.log("1. Test no-KYC purchase: npm run test:gas-optimized");
  console.log("2. Verify deployment: npm run verify:test-setup");
  console.log("3. Check system status: npm run manage:no-kyc -- --status");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
