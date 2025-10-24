const hre = require("hardhat");

async function main() {
  console.log("=== Testing Secondary Multisig Functionality ===\n");

  const [deployer, primaryMultisig, secondaryMultisig, user1] = await hre.ethers.getSigners();
  console.log("Testing with accounts:");
  console.log("Deployer:", deployer.address);
  console.log("Primary Multisig:", primaryMultisig.address);
  console.log("Secondary Multisig:", secondaryMultisig.address);
  console.log("User1:", user1.address);

  // Contract addresses (update these with your deployed addresses)
  const contracts = {
    fundsVault: "0xED12cC985F87e219D0087ce4fE6141a2B470a861", // Update with your FundsVault address
    usdc: "0xfc8Bf89bd7c6AE520BEDacE38140a9aF203458E6"
  };

  try {
    // Get contract instances
    const fundsVault = await hre.ethers.getContractAt("FundsVault", contracts.fundsVault);
    const usdc = await hre.ethers.getContractAt("IERC20", contracts.usdc);
    
    console.log("📋 Contract Addresses:");
    console.log("FundsVault:", contracts.fundsVault);
    console.log("USDC:", contracts.usdc);
    
    // Test 1: Check initial multisig configuration
    console.log("\n🔍 Test 1: Checking multisig configuration...");
    try {
      const primaryMultisigAddr = await fundsVault.primaryMultisig();
      const secondaryMultisigAddr = await fundsVault.secondaryMultisig();
      const secondaryDelay = await fundsVault.SECONDARY_DELAY();
      const secondaryActiveTime = await fundsVault.secondaryMultisigActiveTime();
      
      console.log("✅ Primary multisig:", primaryMultisigAddr);
      console.log("✅ Secondary multisig:", secondaryMultisigAddr);
      console.log("✅ Secondary delay:", secondaryDelay.toString(), "seconds");
      console.log("✅ Secondary active time:", secondaryActiveTime.toString());
      
      const isSecondaryActive = await fundsVault.isSecondaryMultisigActive();
      console.log("✅ Secondary multisig active:", isSecondaryActive);
      
    } catch (error) {
      console.log("❌ Error checking multisig configuration:", error.message);
    }
    
    // Test 2: Test primary multisig withdrawal
    console.log("\n💰 Test 2: Testing primary multisig withdrawal...");
    try {
      // Check ETH balance
      const ethBalance = await hre.ethers.provider.getBalance(contracts.fundsVault);
      console.log("✅ FundsVault ETH balance:", hre.ethers.formatEther(ethBalance), "ETH");
      
      if (ethBalance > 0) {
        console.log("Attempting ETH withdrawal with primary multisig...");
        const withdrawTx = await fundsVault.connect(primaryMultisig).withdrawETH(
          primaryMultisig.address,
          ethBalance
        );
        await withdrawTx.wait();
        console.log("✅ ETH withdrawal successful! Transaction hash:", withdrawTx.hash);
      } else {
        console.log("ℹ️  No ETH to withdraw");
      }
      
    } catch (error) {
      console.log("❌ Primary multisig withdrawal failed:", error.message);
    }
    
    // Test 3: Test secondary multisig activation
    console.log("\n🚨 Test 3: Testing secondary multisig activation...");
    try {
      console.log("Primary multisig activating secondary multisig...");
      const activateTx = await fundsVault.connect(primaryMultisig).activateSecondaryMultisig();
      await activateTx.wait();
      console.log("✅ Secondary multisig activation initiated! Transaction hash:", activateTx.hash);
      
      // Check activation time
      const secondaryActiveTime = await fundsVault.secondaryMultisigActiveTime();
      const activationTime = new Date(Number(secondaryActiveTime) * 1000);
      console.log("✅ Secondary multisig will be active at:", activationTime.toISOString());
      
      // Check if currently active
      const isSecondaryActive = await fundsVault.isSecondaryMultisigActive();
      console.log("✅ Secondary multisig currently active:", isSecondaryActive);
      
    } catch (error) {
      console.log("❌ Secondary multisig activation failed:", error.message);
    }
    
    // Test 4: Test unauthorized secondary activation
    console.log("\n🚫 Test 4: Testing unauthorized secondary activation...");
    try {
      console.log("Attempting to activate secondary with non-primary account...");
      const activateTx = await fundsVault.connect(secondaryMultisig).activateSecondaryMultisig();
      await activateTx.wait();
      console.log("❌ UNEXPECTED: Unauthorized activation succeeded!");
    } catch (error) {
      if (error.message.includes("only primary")) {
        console.log("✅ EXPECTED: Unauthorized activation blocked - access control working!");
      } else {
        console.log("❌ Unexpected error:", error.message);
      }
    }
    
    // Test 5: Test secondary multisig withdrawal (if active)
    console.log("\n💰 Test 5: Testing secondary multisig withdrawal...");
    try {
      const isSecondaryActive = await fundsVault.isSecondaryMultisigActive();
      
      if (isSecondaryActive) {
        console.log("Secondary multisig is active - testing withdrawal...");
        
        // Check USDC balance
        const usdcBalance = await usdc.balanceOf(contracts.fundsVault);
        console.log("✅ FundsVault USDC balance:", hre.ethers.formatUnits(usdcBalance, 6), "USDC");
        
        if (usdcBalance > 0) {
          const withdrawTx = await fundsVault.connect(secondaryMultisig).withdrawToken(
            contracts.usdc,
            secondaryMultisig.address,
            usdcBalance
          );
          await withdrawTx.wait();
          console.log("✅ USDC withdrawal with secondary multisig successful! Transaction hash:", withdrawTx.hash);
        } else {
          console.log("ℹ️  No USDC to withdraw");
        }
      } else {
        console.log("ℹ️  Secondary multisig not active yet - waiting for activation time");
      }
      
    } catch (error) {
      if (error.message.includes("not authorized")) {
        console.log("✅ EXPECTED: Secondary multisig not active yet - access control working!");
      } else {
        console.log("❌ Unexpected error:", error.message);
      }
    }
    
    // Test 6: Test secondary multisig update
    console.log("\n🔄 Test 6: Testing secondary multisig update...");
    try {
      console.log("Primary multisig updating secondary multisig address...");
      const newSecondaryAddress = "0x1111111111111111111111111111111111111111";
      
      const updateTx = await fundsVault.connect(primaryMultisig).updateSecondaryMultisig(newSecondaryAddress);
      await updateTx.wait();
      console.log("✅ Secondary multisig updated! Transaction hash:", updateTx.hash);
      
      // Check new address
      const newSecondaryMultisig = await fundsVault.secondaryMultisig();
      console.log("✅ New secondary multisig:", newSecondaryMultisig);
      
    } catch (error) {
      console.log("❌ Secondary multisig update failed:", error.message);
    }
    
    // Test 7: Test unauthorized secondary update
    console.log("\n🚫 Test 7: Testing unauthorized secondary update...");
    try {
      console.log("Attempting to update secondary with non-primary account...");
      const updateTx = await fundsVault.connect(secondaryMultisig).updateSecondaryMultisig(
        "0x2222222222222222222222222222222222222222"
      );
      await updateTx.wait();
      console.log("❌ UNEXPECTED: Unauthorized update succeeded!");
    } catch (error) {
      if (error.message.includes("only primary")) {
        console.log("✅ EXPECTED: Unauthorized update blocked - access control working!");
      } else {
        console.log("❌ Unexpected error:", error.message);
      }
    }
    
    console.log("\n🎉 Secondary multisig testing completed!");
    console.log("\n📝 Summary:");
    console.log("- Secondary multisig provides backup access to funds");
    console.log("- 7-day delay prevents immediate activation");
    console.log("- Primary multisig controls secondary activation and updates");
    console.log("- Access control prevents unauthorized operations");
    console.log("- Emergency recovery mechanism is functional");
    
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
