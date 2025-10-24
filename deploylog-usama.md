usamalatif@192 presale-contracts-neba-main % npm run resume:deployment

> neba-presale@1.0.0 resume:deployment
> hardhat run scripts/resume-deployment.js --network baseSepolia

WARNING: You are currently using Node.js v23.6.0, which is not supported by Hardhat. This can lead to unexpected behavior. See https://hardhat.org/nodejs-versions


=== Resuming No-KYC Deployment ===

Resuming with account: 0xF5D2Cc2202Dd9Bf51D87419aD630e195F724d12C
Balance: 0.073984094249795823 ETH

Multisig address: 0xF5D2Cc2202Dd9Bf51D87419aD630e195F724d12C
📋 Using deployed contract addresses:
KYCRegistry: 0x8693FA04Ac5649EdaFF3DeDA87b05DCE84a7Be71
RateLimiter: 0xc5e7ab2C0a1bbd48cDc1Cb402438c2081D002403
FundsVault: 0xf6F32A7B6760348C28F926afD644287B634559EF
VestingVault: 0x38E1F64B7d396158125d8Ed2C0CC7F6B8e5F97E5
SaleManager: 0x2c62Ef6b225bE7b03B0d2E6838adAf439a80E57E

🔍 Step 1: Getting round address...
✅ Round 0 found at: 0x5FC3501326903F581d85a99f62AA08d19B222beC
✅ SaleRound contract instance created

📋 Step 2: Checking round configuration...
✅ Round Name: Private Sale
✅ Round Active: true
✅ Token Price: 0.05 USD
✅ Hard Cap: 500000.0 USD
✅ Start Time: 2025-10-24T07:11:05.000Z
✅ End Time: 2025-11-23T07:11:05.000Z

🔐 Step 3: Setting up access control roles...
Granting SALE_ROUND_ROLE to SaleRound in RateLimiter...
✅ SaleRound granted SALE_ROUND_ROLE in RateLimiter
Granting SALE_ROUND_ROLE to SaleRound in VestingVault...
✅ SaleRound granted SALE_ROUND_ROLE in VestingVault
Authorizing SaleRound as depositor in FundsVault...
✅ SaleRound authorized as depositor in FundsVault

🚀 Step 4: Enabling no-KYC mode...
Enabling no-KYC mode...
✅ No-KYC mode enabled

💰 Step 5: Checking token balances...
✅ USDC balance: 10000000000000000.0 USDC
✅ USDT balance: 9999999999990000.0 USDT

🔍 Step 6: Verifying deployment...
✅ No-KYC enabled: false
✅ SaleRound has SALE_ROUND_ROLE in RateLimiter: true
✅ SaleRound has SALE_ROUND_ROLE in VestingVault: true
✅ SaleRound is authorized depositor in FundsVault: true
✅ Round name: Private Sale
✅ Round active: true

💾 Step 7: Saving deployment info...
✅ Deployment info saved to: deployments-baseSepolia-resumed.json

🎉 Resume deployment completed successfully!

📋 Final Contract Addresses:
NebaToken: 0x1175294Cf3BC254288C2Ed13326fD515c2b9Db1a
KYCRegistry: 0x8693FA04Ac5649EdaFF3DeDA87b05DCE84a7Be71
RateLimiter: 0xc5e7ab2C0a1bbd48cDc1Cb402438c2081D002403
FundsVault: 0xf6F32A7B6760348C28F926afD644287B634559EF
VestingVault: 0x38E1F64B7d396158125d8Ed2C0CC7F6B8e5F97E5
SaleManager: 0x2c62Ef6b225bE7b03B0d2E6838adAf439a80E57E
SaleRound: 0x5FC3501326903F581d85a99f62AA08d19B222beC
USDC: 0xfc8Bf89bd7c6AE520BEDacE38140a9aF203458E6
USDT: 0x92E564DA3870a300de0C45971aD82A7dFC963E1a
Oracle: 0x694AA1769357215DE4FAC081bf1f309aDC325306

🚀 Next steps:
1. Test no-KYC purchase: npm run test:gas-optimized
2. Verify deployment: npm run verify:test-setup
3. Check system status: npm run manage:no-kyc -- --status
usamalatif@192 presale-contracts-neba-main % 