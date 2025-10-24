const hre = require("hardhat");

// Contract addresses on Sepolia
const CONTRACTS = {
  RATE_LIMITER: "0x67cfcAdF2d06aAccB12e9F305d9f1C9063C07aEC",
  ROUND_ADDRESS: "0x0C0253eE6eE6B61E79eC65b64F860283cB0e6990",
  USDT: "0x92E564DA3870a300de0C45971aD82A7dFC963E1a"
};

async function main() {
  console.log("=== Simple No-KYC Purchase Test ===\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // Get contract instances
  const rateLimiter = await hre.ethers.getContractAt("RateLimiter", CONTRACTS.RATE_LIMITER);
  const saleRound = await hre.ethers.getContractAt("SaleRound", CONTRACTS.ROUND_ADDRESS);
  const usdt = await hre.ethers.getContractAt("IERC20", CONTRACTS.USDT);

  // Check if no-KYC is enabled
  const isNoKYCEnabled = await rateLimiter.noKYCEnabled();
  console.log("No-KYC Mode Enabled:", isNoKYCEnabled);
  
  if (!isNoKYCEnabled) {
    console.log("❌ No-KYC mode is not enabled. Please enable it first.");
    return;
  }

  // Check daily allowance
  const remainingAllowance = await saleRound.getRemainingDailyAllowance(deployer.address);
  console.log("Remaining Daily Allowance:", hre.ethers.formatUnits(remainingAllowance, 6), "USD");
  
  if (remainingAllowance === 0n) {
    console.log("❌ Daily allowance exhausted.");
    return;
  }

  // Test purchase amount ($100 USDT)
  const purchaseAmount = hre.ethers.parseUnits("100", 6);
  console.log("Testing purchase amount:", hre.ethers.formatUnits(purchaseAmount, 6), "USDT");

  try {
    // Check USDT balance
    const usdtBalance = await usdt.balanceOf(deployer.address);
    console.log("USDT Balance:", hre.ethers.formatUnits(usdtBalance, 6), "USDT");
    
    if (usdtBalance < purchaseAmount) {
      console.log("❌ Insufficient USDT balance");
      return;
    }

    // Approve USDT
    console.log("Approving USDT...");
    const approveTx = await usdt.approve(CONTRACTS.ROUND_ADDRESS, purchaseAmount);
    await approveTx.wait();
    console.log("✅ USDT approved");

    // Make purchase
    console.log("Making no-KYC purchase...");
    const purchaseTx = await saleRound.buyWithUSDTNoKYC(purchaseAmount, hre.ethers.ZeroAddress);
    console.log("Transaction hash:", purchaseTx.hash);
    
    const receipt = await purchaseTx.wait();
    console.log("✅ Purchase successful!");
    console.log("Gas used:", receipt.gasUsed.toString());

    // Check user info
    const [contribution, allocation, bonus] = await saleRound.getUserInfo(deployer.address);
    console.log("User Contribution:", hre.ethers.formatUnits(contribution, 6), "USD");
    console.log("User Allocation:", hre.ethers.formatEther(allocation), "NEBA");
    console.log("User Bonus:", hre.ethers.formatEther(bonus), "NEBA");

  } catch (error) {
    console.log("❌ Purchase failed:", error.message);
    
    // Try to get more detailed error information
    if (error.reason) {
      console.log("Error reason:", error.reason);
    }
    
    if (error.data) {
      console.log("Error data:", error.data);
    }
    
    // Check if it's a revert with reason
    if (error.message.includes("execution reverted")) {
      console.log("🔍 Transaction reverted. Checking possible causes...");
      
      // Check if round is active
      try {
        const roundInfo = await saleRound.getRoundInfo();
        console.log("Round active:", roundInfo.isActive);
        console.log("Round start:", new Date(Number(roundInfo.startTime) * 1000).toISOString());
        console.log("Round end:", new Date(Number(roundInfo.endTime) * 1000).toISOString());
        console.log("Current time:", new Date().toISOString());
      } catch (e) {
        console.log("Could not check round info:", e.message);
      }
      
      // Check if sale round is paused
      try {
        const isPaused = await saleRound.paused();
        console.log("Sale round paused:", isPaused);
      } catch (e) {
        console.log("Could not check pause status:", e.message);
      }
      
      // Check if no-KYC is still enabled
      try {
        const noKycEnabled = await rateLimiter.noKYCEnabled();
        console.log("No-KYC still enabled:", noKycEnabled);
      } catch (e) {
        console.log("Could not check no-KYC status:", e.message);
      }
      
      // Check daily allowance again
      try {
        const allowance = await saleRound.getRemainingDailyAllowance(deployer.address);
        console.log("Remaining allowance:", hre.ethers.formatUnits(allowance, 6), "USD");
      } catch (e) {
        console.log("Could not check allowance:", e.message);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
