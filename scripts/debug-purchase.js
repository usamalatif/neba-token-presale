const hre = require("hardhat");

// Contract addresses on Sepolia
const CONTRACTS = {
  RATE_LIMITER: "0x67cfcAdF2d06aAccB12e9F305d9f1C9063C07aEC",
  ROUND_ADDRESS: "0x0C0253eE6eE6B61E79eC65b64F860283cB0e6990",
  USDT: "0x92E564DA3870a300de0C45971aD82A7dFC963E1a",
  SALE_MANAGER: "0xA8C1ebacb854f226f11894a834574172fC0CA868"
};

async function main() {
  console.log("=== Debug Purchase Issues ===\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // Get contract instances
  const rateLimiter = await hre.ethers.getContractAt("RateLimiter", CONTRACTS.RATE_LIMITER);
  const saleRound = await hre.ethers.getContractAt("SaleRound", CONTRACTS.ROUND_ADDRESS);
  const usdt = await hre.ethers.getContractAt("IERC20", CONTRACTS.USDT);
  const saleManager = await hre.ethers.getContractAt("SaleManager", CONTRACTS.SALE_MANAGER);

  console.log("🔍 Checking all system states...\n");

  // 1. Check no-KYC mode
  try {
    const isNoKYCEnabled = await rateLimiter.noKYCEnabled();
    console.log("✅ No-KYC Mode Enabled:", isNoKYCEnabled);
    
    if (!isNoKYCEnabled) {
      console.log("❌ No-KYC mode is not enabled!");
      return;
    }
  } catch (error) {
    console.log("❌ Error checking no-KYC status:", error.message);
    return;
  }

  // 2. Check round information
  try {
    const roundInfo = await saleRound.getRoundInfo();
    console.log("✅ Round Name:", roundInfo.name);
    console.log("✅ Round Active:", roundInfo.isActive);
    console.log("✅ Token Price:", hre.ethers.formatUnits(roundInfo.tokenPriceUSD, 6), "USD");
    console.log("✅ Start Time:", new Date(Number(roundInfo.startTime) * 1000).toISOString());
    console.log("✅ End Time:", new Date(Number(roundInfo.endTime) * 1000).toISOString());
    console.log("✅ Current Time:", new Date().toISOString());
    
    const currentTime = Math.floor(Date.now() / 1000);
    const isTimeValid = currentTime >= Number(roundInfo.startTime) && currentTime <= Number(roundInfo.endTime);
    console.log("✅ Time Valid:", isTimeValid);
    
    if (!roundInfo.isActive) {
      console.log("❌ Round is not active!");
      return;
    }
    
    if (!isTimeValid) {
      console.log("❌ Current time is outside round time window!");
      return;
    }
  } catch (error) {
    console.log("❌ Error checking round info:", error.message);
    return;
  }

  // 3. Check pause status
  try {
    const isPaused = await saleRound.paused();
    console.log("✅ Sale Round Paused:", isPaused);
    
    if (isPaused) {
      console.log("❌ Sale round is paused!");
      return;
    }
  } catch (error) {
    console.log("❌ Error checking pause status:", error.message);
    return;
  }

  // 4. Check daily allowance
  try {
    const remainingAllowance = await saleRound.getRemainingDailyAllowance(deployer.address);
    console.log("✅ Remaining Daily Allowance:", hre.ethers.formatUnits(remainingAllowance, 6), "USD");
    
    if (remainingAllowance === 0n) {
      console.log("❌ Daily allowance exhausted!");
      return;
    }
  } catch (error) {
    console.log("❌ Error checking daily allowance:", error.message);
    return;
  }

  // 5. Check USDT balance and allowance
  try {
    const usdtBalance = await usdt.balanceOf(deployer.address);
    const allowance = await usdt.allowance(deployer.address, CONTRACTS.ROUND_ADDRESS);
    
    console.log("✅ USDT Balance:", hre.ethers.formatUnits(usdtBalance, 6), "USDT");
    console.log("✅ USDT Allowance:", hre.ethers.formatUnits(allowance, 6), "USDT");
    
    const purchaseAmount = hre.ethers.parseUnits("100", 6);
    
    if (usdtBalance < purchaseAmount) {
      console.log("❌ Insufficient USDT balance!");
      return;
    }
    
    if (allowance < purchaseAmount) {
      console.log("⚠️  Need to approve USDT");
    }
  } catch (error) {
    console.log("❌ Error checking USDT:", error.message);
    return;
  }

  // 6. Check purchase bounds
  try {
    // These are constants, not functions
    const minPurchase = hre.ethers.parseUnits("25", 6); // $25
    const maxPurchase = hre.ethers.parseUnits("499", 6); // $499
    const dailyCap = await rateLimiter.dailyCapUSD();
    
    console.log("✅ Min Purchase:", hre.ethers.formatUnits(minPurchase, 6), "USD");
    console.log("✅ Max Purchase:", hre.ethers.formatUnits(maxPurchase, 6), "USD");
    console.log("✅ Daily Cap:", hre.ethers.formatUnits(dailyCap, 6), "USD");
    
    const purchaseAmount = hre.ethers.parseUnits("100", 6);
    
    if (purchaseAmount < minPurchase) {
      console.log("❌ Purchase amount below minimum!");
      return;
    }
    
    if (purchaseAmount > maxPurchase) {
      console.log("❌ Purchase amount above maximum!");
      return;
    }
  } catch (error) {
    console.log("❌ Error checking purchase bounds:", error.message);
    return;
  }

  // 7. Check rate limiter permissions
  try {
    const hasRole = await rateLimiter.hasRole(await rateLimiter.SALE_ROUND_ROLE(), CONTRACTS.ROUND_ADDRESS);
    console.log("✅ Sale Round has SALE_ROUND_ROLE:", hasRole);
    
    if (!hasRole) {
      console.log("❌ Sale round doesn't have SALE_ROUND_ROLE!");
      return;
    }
  } catch (error) {
    console.log("❌ Error checking rate limiter permissions:", error.message);
    return;
  }

  // 8. Check sale manager permissions
  try {
    const hasRole = await saleManager.hasRole(await saleManager.SALE_ROUND_ROLE(), CONTRACTS.ROUND_ADDRESS);
    console.log("✅ Sale Round has SALE_ROUND_ROLE in SaleManager:", hasRole);
    
    if (!hasRole) {
      console.log("❌ Sale round doesn't have SALE_ROUND_ROLE in SaleManager!");
      return;
    }
  } catch (error) {
    console.log("❌ Error checking sale manager permissions:", error.message);
    return;
  }

  // 9. Try to simulate the purchase call
  try {
    const purchaseAmount = hre.ethers.parseUnits("100", 6);
    
    console.log("\n🧪 Attempting to simulate purchase...");
    
    // First approve if needed
    const currentAllowance = await usdt.allowance(deployer.address, CONTRACTS.ROUND_ADDRESS);
    if (currentAllowance < purchaseAmount) {
      console.log("Approving USDT...");
      const approveTx = await usdt.approve(CONTRACTS.ROUND_ADDRESS, purchaseAmount);
      await approveTx.wait();
      console.log("✅ USDT approved");
    }
    
    // Try to call the function with gas estimation
    try {
      const gasEstimate = await saleRound.buyWithUSDTNoKYC.estimateGas(purchaseAmount, hre.ethers.ZeroAddress);
      console.log("✅ Gas estimate successful:", gasEstimate.toString());
    } catch (gasError) {
      console.log("❌ Gas estimation failed:", gasError.message);
      
      // Try to decode the error
      if (gasError.data) {
        console.log("Error data:", gasError.data);
      }
      
      return;
    }
    
    // If gas estimation succeeds, try the actual transaction
    console.log("Making actual purchase...");
    const purchaseTx = await saleRound.buyWithUSDTNoKYC(purchaseAmount, hre.ethers.ZeroAddress);
    console.log("Transaction hash:", purchaseTx.hash);
    
    const receipt = await purchaseTx.wait();
    console.log("✅ Purchase successful!");
    console.log("Gas used:", receipt.gasUsed.toString());
    
  } catch (error) {
    console.log("❌ Purchase simulation failed:", error.message);
    
    if (error.reason) {
      console.log("Error reason:", error.reason);
    }
    
    if (error.data) {
      console.log("Error data:", error.data);
    }
    
    // Try to get more specific error information
    if (error.message.includes("execution reverted")) {
      console.log("\n🔍 Transaction reverted. Possible causes:");
      console.log("- Round not active");
      console.log("- Sale paused");
      console.log("- No-KYC mode disabled");
      console.log("- Daily cap exceeded");
      console.log("- Purchase bounds violated");
      console.log("- Insufficient permissions");
      console.log("- Token transfer failed");
    }
  }

  console.log("\n🎉 Debug completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Debug failed:", error);
    process.exit(1);
  });
