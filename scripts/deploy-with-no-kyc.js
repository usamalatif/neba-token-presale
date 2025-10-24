const hre = require("hardhat");
const fs = require("fs");

const BASE_USDC = "0xA100b6aC62cf0Dd94b3BeC2b50c3d2D6150DA02";
const BASE_USDT = "0x58912D02E65CC3923F11d724f7ea5ccBcEFCAe88";
const ETH_USD_ORACLE = "0xf7aE13dEb9a62bf8f263ADAAa4aF2c7e4cBB470e";

async function main() {
  console.log("=== NEBA Presale - Deployment with No-KYC Support ===\n");

  const [deployer] = await hre.ethers.getSigners();
  const multisig = deployer.address;
  const nebaToken = process.env.NEBA_TOKEN_ADDRESS;

  console.log("Deployer:", deployer.address);
  console.log("Multisig:", multisig);
  console.log("NEBA Token:", nebaToken, "\n");

  // Check for existing deployment
  const deploymentPath = `deployments-${hre.network.name}.json`;
  let existingContracts = null;
  if (fs.existsSync(deploymentPath)) {
    existingContracts = JSON.parse(fs.readFileSync(deploymentPath, "utf8")).contracts;
    console.log("Found existing deployment, will reuse contracts where possible\n");
  }

  // Get current nonce and increment manually to avoid conflicts
  let nonce = await deployer.getNonce();
  console.log("Starting nonce:", nonce, "\n");

  // 1. Deploy or reuse VestingVault
  let vvAddr;
  if (existingContracts && existingContracts.VestingVault) {
    vvAddr = existingContracts.VestingVault;
    console.log("1️⃣ Reusing existing Vesting Vault:", vvAddr, "\n");
  } else {
    console.log("1️⃣ Deploying Vesting Vault (uninitialized)...");
    const VestingVault = await hre.ethers.getContractFactory("VestingVault");
    const vestingVault = await VestingVault.deploy(nebaToken, { nonce: nonce++ });
    await vestingVault.waitForDeployment();
    vvAddr = await vestingVault.getAddress();
    console.log("   ✅", vvAddr, "\n");
  }

  // 2. Deploy or reuse infrastructure
  let kycAddr, rateAddr, fundsAddr;
  if (existingContracts && existingContracts.KYCRegistry && existingContracts.RateLimiter && existingContracts.FundsVault) {
    kycAddr = existingContracts.KYCRegistry;
    rateAddr = existingContracts.RateLimiter;
    fundsAddr = existingContracts.FundsVault;
    console.log("2️⃣ Reusing existing infrastructure:");
    console.log("   KYC:", kycAddr);
    console.log("   RateLimiter:", rateAddr);
    console.log("   FundsVault:", fundsAddr, "\n");
  } else {
    console.log("2️⃣ Deploying infrastructure...");
    const KYCRegistry = await hre.ethers.getContractFactory("KYCRegistry");
    const kycRegistry = await KYCRegistry.deploy(multisig, { nonce: nonce++ });
    await kycRegistry.waitForDeployment();
    kycAddr = await kycRegistry.getAddress();

    const RateLimiter = await hre.ethers.getContractFactory("RateLimiter");
    const rateLimiter = await RateLimiter.deploy(multisig, { nonce: nonce++ });
    await rateLimiter.waitForDeployment();
    rateAddr = await rateLimiter.getAddress();

    const FundsVault = await hre.ethers.getContractFactory("FundsVault");
    const fundsVault = await FundsVault.deploy(multisig, { nonce: nonce++ });
    await fundsVault.waitForDeployment();
    fundsAddr = await fundsVault.getAddress();
    console.log("   ✅ Done\n");
  }

  // 3. Deploy or reuse SaleManager
  let smAddr;
  if (existingContracts && existingContracts.SaleManager) {
    smAddr = existingContracts.SaleManager;
    console.log("3️⃣ Reusing existing Sale Manager:", smAddr, "\n");
  } else {
    console.log("3️⃣ Deploying Sale Manager...");
    const SaleManager = await hre.ethers.getContractFactory("SaleManager");
    const saleManager = await SaleManager.deploy(
      nebaToken, kycAddr, rateAddr, vvAddr, fundsAddr,
      BASE_USDC, BASE_USDT, ETH_USD_ORACLE, multisig,
      { nonce: nonce++ }
    );
    await saleManager.waitForDeployment();
    smAddr = await saleManager.getAddress();
    console.log("   ✅", smAddr, "\n");
  }

  // 4. Initialize VestingVault with SaleManager (if not already initialized)
  if (!existingContracts || !existingContracts.SaleManager) {
    console.log("4️⃣ Initializing Vesting Vault with Sale Manager...");
    const vestingVaultContract = await hre.ethers.getContractAt("VestingVault", vvAddr);
    const initTx = await vestingVaultContract.initialize(smAddr, { nonce: nonce++ });
    await initTx.wait();
    console.log("   ✅ Initialized!\n");
  } else {
    console.log("4️⃣ Vesting Vault already initialized\n");
  }

  // Get SaleManager contract instance
  const saleManager = await hre.ethers.getContractAt("SaleManager", smAddr);
  const refAddr = await saleManager.referralSystem();

  console.log("═══════════════════════════════════════");
  console.log("  ✅ DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════");
  console.log("NEBA Token:", nebaToken);
  console.log("KYC Registry:", kycAddr);
  console.log("Rate Limiter:", rateAddr);
  console.log("Funds Vault:", fundsAddr);
  console.log("Vesting Vault:", vvAddr);
  console.log("Referral System:", refAddr);
  console.log("Sale Manager:", smAddr, "\n");

  // Save deployment info
  const info = {
    network: hre.network.name,
    deployer: deployer.address,
    multisig: multisig,
    timestamp: new Date().toISOString(),
    contracts: {
      NEBAToken: nebaToken,
      KYCRegistry: kycAddr,
      RateLimiter: rateAddr,
      FundsVault: fundsAddr,
      VestingVault: vvAddr,
      ReferralSystem: refAddr,
      SaleManager: smAddr,
    }
  };

  fs.writeFileSync(`deployments-${hre.network.name}.json`, JSON.stringify(info, null, 2));
  console.log("✅ Saved to deployments-" + hre.network.name + ".json\n");

  // Create round immediately
  console.log("Creating Private Sale round...");
  const config = {
    name: "Private Sale",
    tokenPriceUSD: 50000,
    hardCapUSD: hre.ethers.parseUnits("500000", 6),
    startTime: Math.floor(Date.now() / 1000),
    endTime: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
    cliffDuration: 180 * 24 * 60 * 60,
    vestingDuration: 365 * 24 * 60 * 60,
    isActive: true,
  };

  const createTx = await saleManager.createRound(config, { nonce: nonce++ });
  await createTx.wait();

  const roundCount = await saleManager.getRoundCount();
  console.log("Round count after creation:", Number(roundCount));

  if (Number(roundCount) === 0) {
    throw new Error("Round creation failed - no rounds found");
  }

  const roundAddr = await saleManager.getRound(Number(roundCount) - 1);
  console.log("✅ Round created:", roundAddr, "\n");

  // Get contract instances for authorization
  const fundsVaultContract = await hre.ethers.getContractAt("FundsVault", fundsAddr);
  const rateLimiterContract = await hre.ethers.getContractAt("RateLimiter", rateAddr);
  const vestingVaultContract = await hre.ethers.getContractAt("VestingVault", vvAddr);
  const kycRegistryContract = await hre.ethers.getContractAt("KYCRegistry", kycAddr);

  // Authorize round
  console.log("Authorizing round...");
  await fundsVaultContract.authorizeDepositor(roundAddr, { nonce: nonce++ });
  await rateLimiterContract.grantRole(await rateLimiterContract.SALE_ROUND_ROLE(), roundAddr, { nonce: nonce++ });
  await vestingVaultContract.grantRole(await vestingVaultContract.SALE_ROUND_ROLE(), roundAddr, { nonce: nonce++ });
  const refSys = await hre.ethers.getContractAt("ReferralSystem", refAddr);
  await refSys.grantRole(await refSys.SALE_ROUND_ROLE(), roundAddr, { nonce: nonce++ });
  console.log("✅ All permissions granted\n");

  // Add to KYC
  console.log("Adding to KYC whitelist...");
  await kycRegistryContract.addToWhitelist(deployer.address, { nonce: nonce++ });
  console.log("✅ KYC approved\n");

  // Configure no-KYC fallback mode
  console.log("═══════════════════════════════════════");
  console.log("  🔧 CONFIGURING NO-KYC FALLBACK");
  console.log("═══════════════════════════════════════\n");

  // Enable no-KYC mode
  console.log("Enabling no-KYC fallback mode...");
  await rateLimiterContract.enableNoKYCMode({ nonce: nonce++ });
  console.log("✅ No-KYC mode enabled\n");

  // Set daily cap to $499
  console.log("Setting daily cap to $499...");
  await rateLimiterContract.updateDailyCap(hre.ethers.parseUnits("499", 6), { nonce: nonce++ });
  console.log("✅ Daily cap set to $499\n");

  // TEST NO-KYC PURCHASE!
  console.log("═══════════════════════════════════════");
  console.log("  🧪 TESTING NO-KYC USDT PURCHASE");
  console.log("═══════════════════════════════════════\n");
  
  const saleRound = await hre.ethers.getContractAt("SaleRound", roundAddr);
  const usdt = await hre.ethers.getContractAt("ERC20Mock", BASE_USDT);
  
  const amount = hre.ethers.parseUnits("100", 6);
  
  console.log("Minting 100 USDT...");
  await usdt.mint(deployer.address, amount, { nonce: nonce++ });
  console.log("✅ Minted\n");

  console.log("Approving USDT...");
  await usdt.approve(roundAddr, amount, { nonce: nonce++ });
  console.log("✅ Approved\n");

  console.log("Purchasing with no-KYC mode...");
  console.log("  Amount: $100 USDT");
  console.log("  Expected: 2,000 NEBA ($100 / $0.05)");
  console.log("  Referrer: None");
  console.log("  Mode: No-KYC (daily cap: $499)\n");

  const purchaseTx = await saleRound.buyWithUSDTNoKYC(amount, hre.ethers.ZeroAddress, { nonce: nonce++ });
  console.log("  Transaction sent:", purchaseTx.hash);
  await purchaseTx.wait();
  console.log("  ✅ CONFIRMED!\n");

  const [contrib, alloc, bonus] = await saleRound.getUserInfo(deployer.address);
  const remainingAllowance = await saleRound.getRemainingDailyAllowance(deployer.address);
  
  console.log("🎉 NO-KYC PURCHASE SUCCESSFUL!");
  console.log("═══════════════════════════════════════");
  console.log("  Contributed: $" + hre.ethers.formatUnits(contrib, 6));
  console.log("  NEBA Tokens:", hre.ethers.formatEther(alloc));
  console.log("  Bonus Tokens:", hre.ethers.formatEther(bonus));
  console.log("  Remaining Daily Allowance: $" + hre.ethers.formatUnits(remainingAllowance, 6));
  console.log("═══════════════════════════════════════\n");

  console.log("✅ System is fully functional with no-KYC support!");
  console.log("\nPrivate Sale Round:", roundAddr);
  console.log("View on Basescan: https://sepolia.basescan.org/address/" + roundAddr);
  
  console.log("\n📋 No-KYC Management Commands:");
  console.log("  node scripts/manage-no-kyc.js status");
  console.log("  node scripts/manage-no-kyc.js disable");
  console.log("  node scripts/manage-no-kyc.js set-cap 300");
  console.log("  node scripts/manage-no-kyc.js check-allowance <address>");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
