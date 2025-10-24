const hre = require("hardhat");

async function main() {
  console.log("=== Testing Circuit Breaker Functionality ===\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // Contract addresses (update these with your deployed addresses)
  const contracts = {
    saleRound: "0x0C0253eE6eE6B61E79eC65b64F860283cB0e6990", // Update with your SaleRound address
    rateLimiter: "0x67cfcAdF2d06aAccB12e9F305d9f1C9063C07aEC",
    oracle: "0x694AA1769357215DE4FAC081bf1f309aDC325306"
  };

  try {
    // Get contract instances
    const saleRound = await hre.ethers.getContractAt("SaleRound", contracts.saleRound);
    const oracle = await hre.ethers.getContractAt("AggregatorV3Interface", contracts.oracle);
    
    console.log("📋 Contract Addresses:");
    console.log("SaleRound:", contracts.saleRound);
    console.log("Oracle:", contracts.oracle);
    
    // Test 1: Check current circuit breaker state
    console.log("\n🔍 Test 1: Checking circuit breaker state...");
    const lastValidPrice = await saleRound.lastValidETHPrice();
    const lastUpdateTime = await saleRound.lastPriceUpdateTime();
    const maxChangePercent = await saleRound.MAX_PRICE_CHANGE_PERCENT();
    
    console.log("✅ Last valid ETH price:", hre.ethers.formatUnits(lastValidPrice, 6), "USD");
    console.log("✅ Last price update time:", new Date(Number(lastUpdateTime) * 1000).toISOString());
    console.log("✅ Max price change percent:", maxChangePercent.toString(), "%");
    
    // Test 2: Get current ETH price from oracle
    console.log("\n💰 Test 2: Getting current ETH price...");
    try {
      const roundData = await oracle.latestRoundData();
      const currentPrice = Number(roundData.answer) / 100; // Convert from 8 to 6 decimals
      console.log("✅ Current ETH price from oracle:", currentPrice, "USD");
      console.log("✅ Price timestamp:", new Date(Number(roundData.updatedAt) * 1000).toISOString());
    } catch (error) {
      console.log("❌ Error getting oracle price:", error.message);
    }
    
    // Test 3: Test circuit breaker with small purchase
    console.log("\n🧪 Test 3: Testing circuit breaker with small ETH purchase...");
    try {
      const smallAmount = hre.ethers.parseEther("0.001"); // 0.001 ETH
      console.log("Attempting purchase with:", hre.ethers.formatEther(smallAmount), "ETH");
      
      const tx = await saleRound.buyWithETHNoKYC(hre.ethers.ZeroAddress, {
        value: smallAmount
      });
      
      console.log("✅ Purchase successful! Transaction hash:", tx.hash);
      
      // Check updated circuit breaker state
      const newLastValidPrice = await saleRound.lastValidETHPrice();
      const newLastUpdateTime = await saleRound.lastPriceUpdateTime();
      
      console.log("✅ Updated last valid ETH price:", hre.ethers.formatUnits(newLastValidPrice, 6), "USD");
      console.log("✅ Updated last price update time:", new Date(Number(newLastUpdateTime) * 1000).toISOString());
      
    } catch (error) {
      console.log("❌ Purchase failed:", error.message);
      
      // Check if it's a circuit breaker error
      if (error.message.includes("price change too extreme")) {
        console.log("🔴 Circuit breaker triggered! This is expected behavior for extreme price movements.");
      }
    }
    
    // Test 4: Test circuit breaker reset function
    console.log("\n🔄 Test 4: Testing circuit breaker reset...");
    try {
      const resetTx = await saleRound.resetCircuitBreaker();
      await resetTx.wait();
      console.log("✅ Circuit breaker reset successfully!");
      
      // Check reset state
      const resetLastValidPrice = await saleRound.lastValidETHPrice();
      const resetLastUpdateTime = await saleRound.lastPriceUpdateTime();
      
      console.log("✅ Reset last valid ETH price:", resetLastValidPrice.toString());
      console.log("✅ Reset last price update time:", resetLastUpdateTime.toString());
      
    } catch (error) {
      console.log("❌ Circuit breaker reset failed:", error.message);
    }
    
    // Test 5: Check round configuration
    console.log("\n📋 Test 5: Checking round configuration...");
    try {
      const roundInfo = await saleRound.getRoundInfo();
      console.log("✅ Round name:", roundInfo.name);
      console.log("✅ Round active:", roundInfo.isActive);
      console.log("✅ Token price:", hre.ethers.formatUnits(roundInfo.tokenPriceUSD, 6), "USD");
      console.log("✅ Hard cap:", hre.ethers.formatUnits(roundInfo.hardCapUSD, 6), "USD");
    } catch (error) {
      console.log("❌ Error checking round info:", error.message);
    }
    
    console.log("\n🎉 Circuit breaker testing completed!");
    console.log("\n📝 Summary:");
    console.log("- Circuit breaker protects against extreme price movements");
    console.log("- Maximum price change: 10% per hour");
    console.log("- Manager can reset circuit breaker for legitimate price movements");
    console.log("- Events are emitted when circuit breaker is triggered");
    
  } catch (error) {
    console.log("❌ Test failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test script failed:", error);
    process.exit(1);
  });
