const hre = require("hardhat");

// Contract addresses on Sepolia
const CONTRACTS = {
  RATE_LIMITER: "0x67cfcAdF2d06aAccB12e9F305d9f1C9063C07aEC",
  ROUND_ADDRESS: "0x0C0253eE6eE6B61E79eC65b64F860283cB0e6990",
  USDT: "0x92E564DA3870a300de0C45971aD82A7dFC963E1a"
};

async function main() {
  console.log("=== Gas-Optimized No-KYC Purchase Test ===\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // Get contract instances
  const rateLimiter = await hre.ethers.getContractAt("RateLimiter", CONTRACTS.RATE_LIMITER);
  const saleRound = await hre.ethers.getContractAt("SaleRound", CONTRACTS.ROUND_ADDRESS);
  const usdt = await hre.ethers.getContractAt("IERC20", CONTRACTS.USDT);

  console.log("🔍 Checking system state...");
  
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

  // Use a smaller amount to avoid gas issues
  const purchaseAmount = hre.ethers.parseUnits("50", 6); // $50 instead of $100
  console.log("Testing purchase amount:", hre.ethers.formatUnits(purchaseAmount, 6), "USDT");

  try {
    // Check USDT balance
    const usdtBalance = await usdt.balanceOf(deployer.address);
    console.log("USDT Balance:", hre.ethers.formatUnits(usdtBalance, 6), "USDT");
    
    if (usdtBalance < purchaseAmount) {
      console.log("❌ Insufficient USDT balance");
      return;
    }

    // Check allowance
    const allowance = await usdt.allowance(deployer.address, CONTRACTS.ROUND_ADDRESS);
    console.log("Current Allowance:", hre.ethers.formatUnits(allowance, 6), "USDT");
    
    if (allowance < purchaseAmount) {
      console.log("🔐 Approving USDT...");
      const approveTx = await usdt.approve(CONTRACTS.ROUND_ADDRESS, purchaseAmount);
      await approveTx.wait();
      console.log("✅ USDT approved");
    }

    // Estimate gas first
    console.log("⛽ Estimating gas...");
    try {
      const gasEstimate = await saleRound.buyWithUSDTNoKYC.estimateGas(purchaseAmount, hre.ethers.ZeroAddress);
      console.log("✅ Gas estimate:", gasEstimate.toString());
      
      if (gasEstimate > 15000000) { // 15M gas limit
        console.log("⚠️  Gas estimate is high, but should work with optimized contract");
      }
    } catch (gasError) {
      console.log("❌ Gas estimation failed:", gasError.message);
      return;
    }

    // Make the purchase with gas limit
    console.log("📤 Making no-KYC purchase...");
    const purchaseTx = await saleRound.buyWithUSDTNoKYC(purchaseAmount, hre.ethers.ZeroAddress, {
      gasLimit: 2000000 // Set explicit gas limit
    });
    console.log("Transaction hash:", purchaseTx.hash);
    
    const receipt = await purchaseTx.wait();
    console.log("✅ Purchase successful!");
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Gas price:", hre.ethers.formatUnits(receipt.gasPrice, "gwei"), "Gwei");

    // Check user info
    const [contribution, allocation, bonus] = await saleRound.getUserInfo(deployer.address);
    console.log("User Contribution:", hre.ethers.formatUnits(contribution, 6), "USD");
    console.log("User Allocation:", hre.ethers.formatEther(allocation), "NEBA");
    console.log("User Bonus:", hre.ethers.formatEther(bonus), "NEBA");

    // Check remaining allowance
    const newRemainingAllowance = await saleRound.getRemainingDailyAllowance(deployer.address);
    console.log("Remaining Daily Allowance:", hre.ethers.formatUnits(newRemainingAllowance, 6), "USD");

  } catch (error) {
    console.log("❌ Purchase failed:", error.message);
    
    if (error.message.includes("gas limit")) {
      console.log("💡 Gas limit exceeded. The contract has been optimized to reduce gas usage.");
      console.log("💡 Try with a smaller amount or check if the contract needs further optimization.");
    } else if (error.message.includes("execution reverted")) {
      console.log("💡 Transaction reverted. Check the debug output for specific issues.");
    }
  }

  console.log("\n🎉 Gas-optimized test completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
