const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== No-KYC Fallback Mode Management ===\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Managing with account:", deployer.address, "\n");

  // Load deployment addresses
  const deploymentPath = `deployments-${hre.network.name}.json`;
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const rateLimiterAddress = deployment.contracts.RateLimiter;
  
  if (!rateLimiterAddress) {
    throw new Error("RateLimiter address not found in deployment file");
  }

  console.log("RateLimiter address:", rateLimiterAddress, "\n");

  const RateLimiter = await hre.ethers.getContractFactory("RateLimiter");
  const rateLimiter = RateLimiter.attach(rateLimiterAddress);

  const action = process.argv[2];
  const value = process.argv[3];

  switch (action) {
    case "enable":
      console.log("Enabling no-KYC fallback mode...");
      const enableTx = await rateLimiter.enableNoKYCMode();
      await enableTx.wait();
      console.log("✅ No-KYC mode enabled");
      console.log("Transaction hash:", enableTx.hash);
      break;

    case "disable":
      console.log("Disabling no-KYC fallback mode...");
      const disableTx = await rateLimiter.disableNoKYCMode();
      await disableTx.wait();
      console.log("✅ No-KYC mode disabled");
      console.log("Transaction hash:", disableTx.hash);
      break;

    case "status":
      const isEnabled = await rateLimiter.noKYCEnabled();
      const dailyCap = await rateLimiter.dailyCapUSD();
      console.log("No-KYC Mode Status:");
      console.log("  Enabled:", isEnabled);
      console.log("  Daily Cap:", hre.ethers.formatUnits(dailyCap, 6), "USD");
      break;

    case "set-cap":
      if (!value) {
        throw new Error("Please provide daily cap value in USD (e.g., 300 for $300)");
      }
      
      const newCap = hre.ethers.parseUnits(value, 6);
      console.log(`Setting daily cap to $${value}...`);
      
      const capTx = await rateLimiter.updateDailyCap(newCap);
      await capTx.wait();
      console.log("✅ Daily cap updated");
      console.log("Transaction hash:", capTx.hash);
      break;

    case "check-allowance":
      if (!value) {
        throw new Error("Please provide user address");
      }
      
      const userAddress = value;
      const allowance = await rateLimiter.getRemainingDailyAllowance(userAddress);
      const spent = await rateLimiter.getRateLimitInfo(userAddress);
      
      console.log(`Daily allowance for ${userAddress}:`);
      console.log("  Remaining:", hre.ethers.formatUnits(allowance, 6), "USD");
      console.log("  Spent:", hre.ethers.formatUnits(spent.dailySpentUSD, 6), "USD");
      console.log("  Daily Cap:", hre.ethers.formatUnits(await rateLimiter.dailyCapUSD(), 6), "USD");
      break;

    case "reset-user":
      if (!value) {
        throw new Error("Please provide user address");
      }
      
      const userToReset = value;
      console.log(`Resetting daily limit for ${userToReset}...`);
      
      const resetTx = await rateLimiter.resetLimit(userToReset);
      await resetTx.wait();
      console.log("✅ User limit reset");
      console.log("Transaction hash:", resetTx.hash);
      break;

    default:
      console.log("Usage: node scripts/manage-no-kyc.js <action> [value]");
      console.log("\nActions:");
      console.log("  enable                    - Enable no-KYC fallback mode");
      console.log("  disable                   - Disable no-KYC fallback mode");
      console.log("  status                    - Check current status");
      console.log("  set-cap <amount>          - Set daily cap (e.g., 300 for $300)");
      console.log("  check-allowance <address> - Check user's remaining allowance");
      console.log("  reset-user <address>      - Reset user's daily limit");
      console.log("\nExamples:");
      console.log("  node scripts/manage-no-kyc.js enable");
      console.log("  node scripts/manage-no-kyc.js set-cap 300");
      console.log("  node scripts/manage-no-kyc.js check-allowance 0x1234...");
      break;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
