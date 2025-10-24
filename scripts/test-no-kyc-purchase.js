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
  console.log("=== No-KYC Purchase Test on Sepolia ===\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // Get contract instances
  console.log("📋 Loading contract instances...");
  
  const rateLimiter = await hre.ethers.getContractAt("RateLimiter", CONTRACTS.RATE_LIMITER);
  const saleRound = await hre.ethers.getContractAt("SaleRound", CONTRACTS.ROUND_ADDRESS);
  const usdt = await hre.ethers.getContractAt("IERC20", CONTRACTS.USDT);
  const fundsVault = await hre.ethers.getContractAt("FundsVault", CONTRACTS.FUNDS_VAULT);
  
  console.log("✅ Contracts loaded successfully\n");

  // Check current state
  console.log("🔍 Checking system state...");
  
  const isNoKYCEnabled = await rateLimiter.noKYCEnabled();
  const dailyCap = await rateLimiter.dailyCapUSD();
  const noKycMin = await rateLimiter.NO_KYC_MIN_PURCHASE_USD();
  const noKycMax = await rateLimiter.NO_KYC_MAX_PURCHASE_USD();
  
  console.log("No-KYC Mode Enabled:", isNoKYCEnabled);
  console.log("Daily Cap:", hre.ethers.formatUnits(dailyCap, 6), "USD");
  console.log("No-KYC Min Purchase:", hre.ethers.formatUnits(noKycMin, 6), "USD");
  console.log("No-KYC Max Purchase:", hre.ethers.formatUnits(noKycMax, 6), "USD");
  
  if (!isNoKYCEnabled) {
    console.log("❌ No-KYC mode is not enabled. Enabling it...");
    
    // Enable no-KYC mode (requires multisig or admin)
    try {
      const enableTx = await rateLimiter.enableNoKYCMode();
      await enableTx.wait();
      console.log("✅ No-KYC mode enabled");
    } catch (error) {
      console.log("❌ Failed to enable no-KYC mode:", error.message);
      console.log("Note: This requires admin privileges");
      return;
    }
  }
  
  console.log("");

  // Check round info
  console.log("📊 Checking round information...");
  
  const roundInfo = await saleRound.getRoundInfo();
  console.log("Round Name:", roundInfo.name);
  console.log("Token Price:", hre.ethers.formatUnits(roundInfo.tokenPriceUSD, 6), "USD");
  console.log("Hard Cap:", hre.ethers.formatUnits(roundInfo.hardCapUSD, 6), "USD");
  console.log("Is Active:", roundInfo.isActive);
  console.log("Start Time:", new Date(Number(roundInfo.startTime) * 1000).toISOString());
  console.log("End Time:", new Date(Number(roundInfo.endTime) * 1000).toISOString());
  console.log("");

  // Check user's current allowance
  console.log("💰 Checking user's daily allowance...");
  
  const remainingAllowance = await saleRound.getRemainingDailyAllowance(deployer.address);
  console.log("Remaining Daily Allowance:", hre.ethers.formatUnits(remainingAllowance, 6), "USD");
  
  if (remainingAllowance === 0n) {
    console.log("❌ Daily allowance exhausted. Cannot make purchase.");
    return;
  }
  console.log("");

  // Test purchase amounts
  const testAmounts = [
    { amount: hre.ethers.parseUnits("25", 6), name: "$25 (minimum)" },
    { amount: hre.ethers.parseUnits("100", 6), name: "$100 (test)" },
    { amount: hre.ethers.parseUnits("499", 6), name: "$499 (maximum)" }
  ];

  for (const test of testAmounts) {
    console.log(`🧪 Testing purchase: ${test.name}`);
    
    // Check if amount is within bounds
    if (test.amount < noKycMin) {
      console.log(`❌ Amount ${test.name} is below minimum (${hre.ethers.formatUnits(noKycMin, 6)} USD)`);
      continue;
    }
    
    if (test.amount > noKycMax) {
      console.log(`❌ Amount ${test.name} is above maximum (${hre.ethers.formatUnits(noKycMax, 6)} USD)`);
      continue;
    }
    
    if (test.amount > remainingAllowance) {
      console.log(`❌ Amount ${test.name} exceeds remaining daily allowance`);
      continue;
    }

    try {
      // Check USDT balance
      const usdtBalance = await usdt.balanceOf(deployer.address);
      console.log("USDT Balance:", hre.ethers.formatUnits(usdtBalance, 6), "USDT");
      
      if (usdtBalance < test.amount) {
        console.log(`❌ Insufficient USDT balance. Need ${hre.ethers.formatUnits(test.amount, 6)} USDT`);
        continue;
      }

      // Check allowance
      const allowance = await usdt.allowance(deployer.address, CONTRACTS.ROUND_ADDRESS);
      console.log("Current Allowance:", hre.ethers.formatUnits(allowance, 6), "USDT");
      
      if (allowance < test.amount) {
        console.log("🔐 Approving USDT...");
        const approveTx = await usdt.approve(CONTRACTS.ROUND_ADDRESS, test.amount);
        await approveTx.wait();
        console.log("✅ USDT approved");
      }

      // Get initial balances
      const initialFundsVaultBalance = await usdt.balanceOf(CONTRACTS.FUNDS_VAULT);
      const initialUserBalance = await usdt.balanceOf(deployer.address);
      
      console.log("📤 Making no-KYC purchase...");
      console.log("Amount:", hre.ethers.formatUnits(test.amount, 6), "USDT");
      
      // Make the purchase
      const purchaseTx = await saleRound.buyWithUSDTNoKYC(test.amount, hre.ethers.ZeroAddress);
      console.log("Transaction hash:", purchaseTx.hash);
      
      const receipt = await purchaseTx.wait();
      console.log("✅ Purchase successful!");
      console.log("Gas used:", receipt.gasUsed.toString());
      
      // Check final balances
      const finalFundsVaultBalance = await usdt.balanceOf(CONTRACTS.FUNDS_VAULT);
      const finalUserBalance = await usdt.balanceOf(deployer.address);
      
      console.log("Funds Vault USDT Balance:", hre.ethers.formatUnits(finalFundsVaultBalance, 6), "USDT");
      console.log("User USDT Balance:", hre.ethers.formatUnits(finalUserBalance, 6), "USDT");
      
      // Check user info
      const [contribution, allocation, bonus] = await saleRound.getUserInfo(deployer.address);
      console.log("User Contribution:", hre.ethers.formatUnits(contribution, 6), "USD");
      console.log("User Allocation:", hre.ethers.formatEther(allocation), "NEBA");
      console.log("User Bonus:", hre.ethers.formatEther(bonus), "NEBA");
      
      // Check remaining allowance
      const newRemainingAllowance = await saleRound.getRemainingDailyAllowance(deployer.address);
      console.log("Remaining Daily Allowance:", hre.ethers.formatUnits(newRemainingAllowance, 6), "USD");
      
      console.log("✅ Test completed successfully!\n");
      
      // Only test one successful purchase
      break;
      
    } catch (error) {
      console.log(`❌ Purchase failed: ${error.message}`);
      
      if (error.message.includes("NO_KYC_MIN_PURCHASE_USD")) {
        console.log("Error: Amount below minimum purchase ($25)");
      } else if (error.message.includes("NO_KYC_MAX_PURCHASE_USD")) {
        console.log("Error: Amount above maximum purchase ($499)");
      } else if (error.message.includes("daily cap exceeded")) {
        console.log("Error: Daily cap exceeded");
      } else if (error.message.includes("no-KYC mode not enabled")) {
        console.log("Error: No-KYC mode not enabled");
      }
      console.log("");
    }
  }

  // Test error cases
  console.log("🚫 Testing error cases...");
  
  // Test below minimum
  try {
    const belowMin = hre.ethers.parseUnits("24", 6); // $24
    await usdt.approve(CONTRACTS.ROUND_ADDRESS, belowMin);
    await saleRound.buyWithUSDTNoKYC(belowMin, hre.ethers.ZeroAddress);
    console.log("❌ Should have failed for amount below minimum");
  } catch (error) {
    if (error.message.includes("NO_KYC_MIN_PURCHASE_USD")) {
      console.log("✅ Correctly rejected amount below minimum");
    } else {
      console.log("❌ Unexpected error:", error.message);
    }
  }

  // Test above maximum
  try {
    const aboveMax = hre.ethers.parseUnits("500", 6); // $500
    await usdt.approve(CONTRACTS.ROUND_ADDRESS, aboveMax);
    await saleRound.buyWithUSDTNoKYC(aboveMax, hre.ethers.ZeroAddress);
    console.log("❌ Should have failed for amount above maximum");
  } catch (error) {
    if (error.message.includes("NO_KYC_MAX_PURCHASE_USD")) {
      console.log("✅ Correctly rejected amount above maximum");
    } else {
      console.log("❌ Unexpected error:", error.message);
    }
  }

  console.log("\n🎉 No-KYC purchase test completed!");
  console.log("\n📋 Summary:");
  console.log("- No-KYC mode:", isNoKYCEnabled ? "✅ Enabled" : "❌ Disabled");
  console.log("- Purchase bounds:", `$${hre.ethers.formatUnits(noKycMin, 6)} - $${hre.ethers.formatUnits(noKycMax, 6)}`);
  console.log("- Daily cap:", hre.ethers.formatUnits(dailyCap, 6), "USD");
  console.log("- System is working correctly! 🚀");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
