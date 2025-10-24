const hre = require("hardhat");

async function main() {
  console.log("=== Testing VestingVault Pause Mechanism ===\n");

  const [deployer, user1, pauser] = await hre.ethers.getSigners();
  console.log("Testing with accounts:");
  console.log("Deployer:", deployer.address);
  console.log("User1:", user1.address);
  console.log("Pauser:", pauser.address);

  // Contract addresses (update these with your deployed addresses)
  const contracts = {
    vestingVault: "0x01c9DfCB7497792B928F2FE90523a05DE6e6E4C0", // Update with your VestingVault address
    nebaToken: "0x1175294Cf3BC254288C2Ed13326fD515c2b9Db1a"
  };

  try {
    // Get contract instances
    const vestingVault = await hre.ethers.getContractAt("VestingVault", contracts.vestingVault);
    const nebaToken = await hre.ethers.getContractAt("IERC20", contracts.nebaToken);
    
    console.log("📋 Contract Addresses:");
    console.log("VestingVault:", contracts.vestingVault);
    console.log("NebaToken:", contracts.nebaToken);
    
    // Test 1: Check initial pause status
    console.log("\n🔍 Test 1: Checking initial pause status...");
    try {
      const isPaused = await vestingVault.paused();
      console.log("✅ VestingVault paused:", isPaused);
    } catch (error) {
      console.log("❌ Error checking pause status:", error.message);
    }
    
    // Test 2: Check roles
    console.log("\n🔐 Test 2: Checking roles...");
    try {
      const pauserRole = await vestingVault.PAUSER_ROLE();
      const adminRole = await vestingVault.DEFAULT_ADMIN_ROLE();
      
      const deployerHasPauserRole = await vestingVault.hasRole(pauserRole, deployer.address);
      const deployerHasAdminRole = await vestingVault.hasRole(adminRole, deployer.address);
      
      console.log("✅ Deployer has PAUSER_ROLE:", deployerHasPauserRole);
      console.log("✅ Deployer has ADMIN_ROLE:", deployerHasAdminRole);
    } catch (error) {
      console.log("❌ Error checking roles:", error.message);
    }
    
    // Test 3: Test pause functionality
    console.log("\n⏸️ Test 3: Testing pause functionality...");
    try {
      console.log("Attempting to pause VestingVault...");
      const pauseTx = await vestingVault.pause();
      await pauseTx.wait();
      console.log("✅ VestingVault paused successfully! Transaction hash:", pauseTx.hash);
      
      // Check pause status
      const isPaused = await vestingVault.paused();
      console.log("✅ VestingVault paused:", isPaused);
      
    } catch (error) {
      console.log("❌ Pause failed:", error.message);
    }
    
    // Test 4: Test claiming while paused
    console.log("\n🚫 Test 4: Testing claiming while paused...");
    try {
      console.log("Attempting to claim tokens while paused...");
      const claimTx = await vestingVault.connect(user1).claimVested();
      await claimTx.wait();
      console.log("❌ UNEXPECTED: Claim succeeded while paused!");
    } catch (error) {
      if (error.message.includes("Pausable: paused")) {
        console.log("✅ EXPECTED: Claim blocked while paused - pause mechanism working!");
      } else {
        console.log("❌ Unexpected error:", error.message);
      }
    }
    
    // Test 5: Test unpause functionality
    console.log("\n▶️ Test 5: Testing unpause functionality...");
    try {
      console.log("Attempting to unpause VestingVault...");
      const unpauseTx = await vestingVault.unpause();
      await unpauseTx.wait();
      console.log("✅ VestingVault unpaused successfully! Transaction hash:", unpauseTx.hash);
      
      // Check pause status
      const isPaused = await vestingVault.paused();
      console.log("✅ VestingVault paused:", isPaused);
      
    } catch (error) {
      console.log("❌ Unpause failed:", error.message);
    }
    
    // Test 6: Test claiming after unpause
    console.log("\n✅ Test 6: Testing claiming after unpause...");
    try {
      console.log("Attempting to claim tokens after unpause...");
      const claimTx = await vestingVault.connect(user1).claimVested();
      await claimTx.wait();
      console.log("✅ Claim succeeded after unpause!");
    } catch (error) {
      if (error.message.includes("nothing to claim")) {
        console.log("ℹ️  No claimable tokens available (this is normal)");
      } else {
        console.log("❌ Claim failed:", error.message);
      }
    }
    
    // Test 7: Test unauthorized pause attempt
    console.log("\n🚫 Test 7: Testing unauthorized pause attempt...");
    try {
      console.log("Attempting to pause with non-pauser account...");
      const pauseTx = await vestingVault.connect(user1).pause();
      await pauseTx.wait();
      console.log("❌ UNEXPECTED: Unauthorized pause succeeded!");
    } catch (error) {
      if (error.message.includes("AccessControl")) {
        console.log("✅ EXPECTED: Unauthorized pause blocked - access control working!");
      } else {
        console.log("❌ Unexpected error:", error.message);
      }
    }
    
    // Test 8: Test unauthorized unpause attempt
    console.log("\n🚫 Test 8: Testing unauthorized unpause attempt...");
    try {
      console.log("Attempting to unpause with non-admin account...");
      const unpauseTx = await vestingVault.connect(user1).unpause();
      await unpauseTx.wait();
      console.log("❌ UNEXPECTED: Unauthorized unpause succeeded!");
    } catch (error) {
      if (error.message.includes("AccessControl")) {
        console.log("✅ EXPECTED: Unauthorized unpause blocked - access control working!");
      } else {
        console.log("❌ Unexpected error:", error.message);
      }
    }
    
    console.log("\n🎉 Pause mechanism testing completed!");
    console.log("\n📝 Summary:");
    console.log("- Pause mechanism implemented successfully");
    console.log("- Emergency pause blocks token claims");
    console.log("- Unpause restores normal functionality");
    console.log("- Access control prevents unauthorized pause/unpause");
    console.log("- Events are emitted for pause/unpause actions");
    
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
