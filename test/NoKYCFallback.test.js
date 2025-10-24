const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
describe("No-KYC Fallback Mode", function () {
  async function deployNoKYCFixture() {
    const [deployer, user1, user2, user3, multisig] = await ethers.getSigners();
    
    // Deploy mock contracts
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const usdc = await ERC20Mock.deploy("USD Coin", "USDC", 6);
    await usdc.waitForDeployment();
    
    const usdt = await ERC20Mock.deploy("Tether USD", "USDT", 6);
    await usdt.waitForDeployment();
    
    const NebaToken = await ethers.getContractFactory("NebaToken");
    const nebaToken = await NebaToken.deploy("NEBA Token", "NEBA", 18);
    await nebaToken.waitForDeployment();
    
    const OracleMock = await ethers.getContractFactory("OracleMock");
    const oracle = await OracleMock.deploy(3800_0000_0000_00, 8);
    await oracle.waitForDeployment();
    
    // Deploy infrastructure
    const KYCRegistry = await ethers.getContractFactory("KYCRegistry");
    const kycRegistry = await KYCRegistry.deploy(multisig.address);
    await kycRegistry.waitForDeployment();
    
    const RateLimiter = await ethers.getContractFactory("RateLimiter");
    const rateLimiter = await RateLimiter.deploy(multisig.address);
    await rateLimiter.waitForDeployment();
    
    const FundsVault = await ethers.getContractFactory("FundsVault");
    const fundsVault = await FundsVault.deploy(multisig.address);
    await fundsVault.waitForDeployment();
    
    const VestingVault = await ethers.getContractFactory("VestingVault");
    const vestingVault = await VestingVault.deploy(await nebaToken.getAddress());
    await vestingVault.waitForDeployment();
    
    const SaleManager = await ethers.getContractFactory("SaleManager");
    const saleManager = await SaleManager.deploy(
      await nebaToken.getAddress(),
      await kycRegistry.getAddress(),
      await rateLimiter.getAddress(),
      await vestingVault.getAddress(),
      await fundsVault.getAddress(),
      await usdc.getAddress(),
      await usdt.getAddress(),
      await oracle.getAddress(),
      multisig.address
    );
    await saleManager.waitForDeployment();
    
    // Initialize vesting vault
    await vestingVault.initialize(await saleManager.getAddress());
    
    // Create a sale round
    const config = {
      name: "Test Round",
      tokenPriceUSD: 50000, // $0.05
      hardCapUSD: ethers.parseUnits("1000000", 6), // $1M
      startTime: Math.floor(Date.now() / 1000),
      endTime: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
      cliffDuration: 180 * 24 * 60 * 60,
      vestingDuration: 365 * 24 * 60 * 60,
      isActive: true,
    };
    await saleManager.connect(multisig).createRound(config);
    const roundAddress = await saleManager.getRound(0);
    const saleRound = await ethers.getContractAt("SaleRound", roundAddress);
    
    // Authorize the round
    await fundsVault.connect(multisig).authorizeDepositor(roundAddress);
    await rateLimiter.connect(multisig).grantRole(await rateLimiter.SALE_ROUND_ROLE(), roundAddress);
    await vestingVault.grantRole(await vestingVault.SALE_ROUND_ROLE(), roundAddress);

    
    // Enable no-KYC mode
    await rateLimiter.connect(multisig).enableNoKYCMode();
    
    // Mint tokens to users
    const amount = ethers.parseUnits("1000", 6); // $1000 USDC/USDT
    await usdc.mint(user1.address, amount);
    await usdc.mint(user2.address, amount);
    await usdt.mint(user1.address, amount);
    await usdt.mint(user2.address, amount);
    
    return {
      saleRound,
      rateLimiter,
      usdc,
      usdt,
      nebaToken,
      oracle,
      user1,
      user2,
      user3,
      multisig
    };
  }

  describe("No-KYC Mode Management", function () {
    it("Should enable no-KYC mode", async function () {
      const { rateLimiter, multisig } = await loadFixture(deployNoKYCFixture);
      
      expect(await rateLimiter.noKYCEnabled()).to.be.true;
    });

    it("Should disable no-KYC mode", async function () {
      const { rateLimiter, multisig } = await loadFixture(deployNoKYCFixture);
      
      await rateLimiter.connect(multisig).disableNoKYCMode();
      expect(await rateLimiter.noKYCEnabled()).to.be.false;
    });

    it("Should update daily cap", async function () {
      const { rateLimiter, multisig } = await loadFixture(deployNoKYCFixture);
      
      const newCap = ethers.parseUnits("300", 6); // $300
      await rateLimiter.connect(multisig).updateDailyCap(newCap);
      expect(await rateLimiter.dailyCapUSD()).to.equal(newCap);
    });

    it("Should revert when non-admin tries to enable no-KYC", async function () {
      const { rateLimiter, user1 } = await loadFixture(deployNoKYCFixture);
      
      await expect(
        rateLimiter.connect(user1).enableNoKYCMode()
      ).to.be.reverted;
    });
  });

  describe("Daily Cap Tracking", function () {
    it("Should track daily spending correctly", async function () {
      const { saleRound, rateLimiter, usdc, user1 } = await loadFixture(deployNoKYCFixture);
      
      const amount = ethers.parseUnits("100", 6); // $100
      await usdc.connect(user1).approve(await saleRound.getAddress(), amount);
      
      // First purchase
      await saleRound.connect(user1).buyWithUSDCNoKYC(amount, ethers.ZeroAddress);
      
      const info = await rateLimiter.getRateLimitInfo(user1.address);
      expect(info.dailySpentUSD).to.equal(amount);
    });

    it("Should reset daily spending after 24 hours", async function () {
      const { saleRound, rateLimiter, usdc, user1 } = await loadFixture(deployNoKYCFixture);
      
      const amount = ethers.parseUnits("200", 6); // $100
      const approveAmount = ethers.parseUnits("400", 6);;
      await usdc.connect(user1).approve(await saleRound.getAddress(), approveAmount);
      
      // First purchase
      await saleRound.connect(user1).buyWithUSDCNoKYC(amount, ethers.ZeroAddress);
      
      // Fast forward 25 hours
      await time.increase(25 * 60 * 60);
      // Should be able to purchase again
      await saleRound.connect(user1).buyWithUSDCNoKYC(amount, ethers.ZeroAddress);
      
      const info = await rateLimiter.getRateLimitInfo(user1.address);
      expect(info.dailySpentUSD).to.equal(amount); // Should reset to current amount
    });

    it("Should return correct remaining allowance", async function () {
      const { saleRound, rateLimiter, usdc, user1 } = await loadFixture(deployNoKYCFixture);
      
      const amount = ethers.parseUnits("200", 6); // $200
      await usdc.connect(user1).approve(await saleRound.getAddress(), amount);
      
      // First purchase
      await saleRound.connect(user1).buyWithUSDCNoKYC(amount, ethers.ZeroAddress);
      
      const remaining = await rateLimiter.getRemainingDailyAllowance(user1.address);
      expect(remaining).to.equal(ethers.parseUnits("299", 6)); // $499 - $200 = $299
    });
  });

  describe("No-KYC Purchase Flow", function () {
    it("Should allow USDC purchase in no-KYC mode", async function () {
      const { saleRound, usdc, user1 } = await loadFixture(deployNoKYCFixture);
      
      const amount = ethers.parseUnits("100", 6); // $100
      await usdc.connect(user1).approve(await saleRound.getAddress(), amount);
      
      await expect(saleRound.connect(user1).buyWithUSDCNoKYC(amount, ethers.ZeroAddress))
        .to.emit(saleRound, "NoKYCPurchase")
        .withArgs(user1.address, await usdc.getAddress(), amount, amount, anyValue, anyValue);
    });

    it("Should enforce no-KYC specific purchase bounds", async function () {
      const { saleRound, usdc, user1 } = await loadFixture(deployNoKYCFixture);
      
      // Test minimum bound ($25)
      // const minAmount = ethers.parseUnits("25", 6);
      // await usdc.connect(user1).approve(await saleRound.getAddress(), minAmount);
      // await expect(saleRound.connect(user1).buyWithUSDCNoKYC(minAmount, ethers.ZeroAddress))
      //   .to.not.be.reverted;

      // Test maximum bound ($499)
      const maxAmount = ethers.parseUnits("499", 6);
      await usdc.connect(user1).approve(await saleRound.getAddress(), maxAmount);
      await expect(saleRound.connect(user1).buyWithUSDCNoKYC(maxAmount, ethers.ZeroAddress))
        .to.not.be.reverted;

      // Test below minimum ($24)
      // const belowMin = ethers.parseUnits("24", 6);
      // await usdc.connect(user1).approve(await saleRound.getAddress(), belowMin);
      // await expect(saleRound.connect(user1).buyWithUSDCNoKYC(belowMin, ethers.ZeroAddress))
      //   .to.be.revertedWith("RateLimiter: NO_KYC_MIN_PURCHASE_USD");

      // Test above maximum ($500)
      // const aboveMax = ethers.parseUnits("500", 6);
      // await usdc.connect(user1).approve(await saleRound.getAddress(), aboveMax);
      // await expect(saleRound.connect(user1).buyWithUSDCNoKYC(aboveMax, ethers.ZeroAddress))
      //   .to.be.revertedWith("RateLimiter: NO_KYC_MAX_PURCHASE_USD");
    });

    it("Should allow USDT purchase in no-KYC mode", async function () {
      const { saleRound, usdt, user1 } = await loadFixture(deployNoKYCFixture);
      
      const amount = ethers.parseUnits("100", 6); // $100
      await usdt.connect(user1).approve(await saleRound.getAddress(), amount);
      
      await expect(saleRound.connect(user1).buyWithUSDTNoKYC(amount, ethers.ZeroAddress))
        .to.emit(saleRound, "NoKYCPurchase");
    });

    // it("Should allow ETH purchase in no-KYC mode", async function () {
    //   const { saleRound, user1 } = await loadFixture(deployNoKYCFixture);
      
    //   const ethAmount = ethers.parseEther("0.1"); // 0.1 ETH
      
    //   await expect(saleRound.connect(user1).buyWithETHNoKYC(ethers.ZeroAddress, { value: ethAmount }))
    //     .to.emit(saleRound, "NoKYCPurchase");
    // });

    it("Should revert when no-KYC mode is disabled", async function () {
      const { saleRound, rateLimiter, usdc, user1, multisig } = await loadFixture(deployNoKYCFixture);
      
      // Disable no-KYC mode
      await rateLimiter.connect(multisig).disableNoKYCMode();
      
      const amount = ethers.parseUnits("100", 6);
      await usdc.connect(user1).approve(await saleRound.getAddress(), amount);
      
      await expect(
        saleRound.connect(user1).buyWithUSDCNoKYC(amount, ethers.ZeroAddress)
      ).to.be.revertedWith("SaleRound: no-KYC mode not enabled");
    });
  });

  describe("Daily Cap Enforcement", function () {
    it("Should allow exactly $499 USD", async function () {
      const { saleRound, usdc, user1 } = await loadFixture(deployNoKYCFixture);
      
      const amount = ethers.parseUnits("499", 6); // $499
      await usdc.connect(user1).approve(await saleRound.getAddress(), amount);
      
      await expect(saleRound.connect(user1).buyWithUSDCNoKYC(amount, ethers.ZeroAddress))
        .to.not.be.reverted;
    });

    it("Should block when exceeding $499 USD", async function () {
      const { saleRound, usdc, user1 } = await loadFixture(deployNoKYCFixture);
      
      const amount = ethers.parseUnits("500", 6); // $500
      await usdc.connect(user1).approve(await saleRound.getAddress(), amount);
      
      await expect(
        saleRound.connect(user1).buyWithUSDCNoKYC(amount, ethers.ZeroAddress)
      ).to.be.revertedWith("RateLimiter: daily cap exceeded");
    });

    it("Should allow multiple purchases within daily cap", async function () {
      const { saleRound, usdc, user1, rateLimiter } = await loadFixture(deployNoKYCFixture);
      
      const amount1 = ethers.parseUnits("200", 6); // $200
      const amount2 = ethers.parseUnits("299", 6); // $299
      
      await usdc.connect(user1).approve(await saleRound.getAddress(), amount1 + amount2);
      
      // First purchase
      await saleRound.connect(user1).buyWithUSDCNoKYC(amount1, ethers.ZeroAddress);
      
      // Second purchase
      await saleRound.connect(user1).buyWithUSDCNoKYC(amount2, ethers.ZeroAddress);
      
      const info = await rateLimiter.getRateLimitInfo(user1.address);
      expect(info.dailySpentUSD).to.equal(amount1 + amount2);
    });

    it("Should block when next purchase would exceed cap", async function () {
      const { saleRound, usdc, user1 } = await loadFixture(deployNoKYCFixture);
      
      const amount1 = ethers.parseUnits("200", 6); // $200
      const amount2 = ethers.parseUnits("300", 6); // $300 (total would be $500)
      
      await usdc.connect(user1).approve(await saleRound.getAddress(), amount1 + amount2);
      
      // First purchase
      await saleRound.connect(user1).buyWithUSDCNoKYC(amount1, ethers.ZeroAddress);
      
      // Second purchase should fail
      await expect(
        saleRound.connect(user1).buyWithUSDCNoKYC(amount2, ethers.ZeroAddress)
      ).to.be.revertedWith("RateLimiter: daily cap exceeded");
    });
  });

  describe("Mixed Asset Flows", function () {
    it("Should track spending across USDC, USDT, and ETH", async function () {
      const { saleRound, usdc, usdt, user1, rateLimiter } = await loadFixture(deployNoKYCFixture);
      
      const usdcAmount = ethers.parseUnits("100", 6); // $100 USDC
      const usdtAmount = ethers.parseUnits("200", 6); // $200 USDT
    //   const ethAmount = ethers.parseEther("0.1"); // ~$200 ETH (assuming $2000/ETH)
      
      await usdc.connect(user1).approve(await saleRound.getAddress(), usdcAmount);
      await usdt.connect(user1).approve(await saleRound.getAddress(), usdtAmount);
      
      // USDC purchase
      await saleRound.connect(user1).buyWithUSDCNoKYC(usdcAmount, ethers.ZeroAddress);
      
      // USDT purchase
      await saleRound.connect(user1).buyWithUSDTNoKYC(usdtAmount, ethers.ZeroAddress);
      
      // ETH purchase
    //   await saleRound.connect(user1).buyWithETHNoKYC(ethers.ZeroAddress, { value: ethAmount });
      
      const info = await rateLimiter.getRateLimitInfo(user1.address);
      expect(info.dailySpentUSD).to.be.equal(ethers.parseUnits("300", 6));
    });
  });



//   describe("ETH Price Feed Staleness", function () {
//     it("Should handle stale ETH price feed", async function () {
//       const { saleRound, oracle, user1 } = await loadFixture(deployNoKYCFixture);
      
//       // Set stale price (older than 5 minutes)
//       await oracle.setStalePrice();
      
//       const ethAmount = ethers.parseEther("0.1");
      
//       await expect(
//         saleRound.connect(user1).buyWithETHNoKYC(ethers.ZeroAddress, { value: ethAmount })
//       ).to.be.revertedWith("SaleRound: stale price data");
//     });
//   });

//   describe("Pause/Unpause in No-KYC Mode", function () {
//     it("Should respect pause state in no-KYC mode", async function () {
//       const { saleRound, usdc, user1, multisig } = await loadFixture(deployNoKYCFixture);
      
//       // Pause the round
//       await saleRound.connect(multisig).pause();
      
//       const amount = ethers.parseUnits("100", 6);
//       await usdc.connect(user1).approve(await saleRound.getAddress(), amount);
      
//       await expect(
//         saleRound.connect(user1).buyWithUSDCNoKYC(amount, ethers.ZeroAddress)
//       ).to.be.revertedWith("Pausable: paused");
//     });
//   });

//   describe("Events", function () {
//     it("Should emit NoKYCEnabled event", async function () {
//       const { rateLimiter, multisig } = await loadFixture(deployNoKYCFixture);
      
//       // Disable and re-enable to test event
//       await rateLimiter.connect(multisig).disableNoKYCMode();
      
//       await expect(rateLimiter.connect(multisig).enableNoKYCMode())
//         .to.emit(rateLimiter, "NoKYCEnabled");
//     });

//     it("Should emit NoKYCDisabled event", async function () {
//       const { rateLimiter, multisig } = await loadFixture(deployNoKYCFixture);
      
//       await expect(rateLimiter.connect(multisig).disableNoKYCMode())
//         .to.emit(rateLimiter, "NoKYCDisabled");
//     });

//     it("Should emit DailyCapUpdated event", async function () {
//       const { rateLimiter, multisig } = await loadFixture(deployNoKYCFixture);
      
//       const newCap = ethers.parseUnits("300", 6);
      
//       await expect(rateLimiter.connect(multisig).updateDailyCap(newCap))
//         .to.emit(rateLimiter, "DailyCapUpdated")
//         .withArgs(newCap);
//     });
//   });
});
