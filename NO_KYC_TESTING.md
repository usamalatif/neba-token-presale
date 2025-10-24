# No-KYC Purchase Testing Guide

This guide explains how to test the no-KYC purchase functionality on Sepolia testnet.

## Prerequisites

1. **Environment Setup**: Make sure you have your `.env` file configured with:
   - `SEPOLIA_RPC_URL=https://eth-sepolia.public.blastapi.io`
   - `PRIVATE_KEY` (your wallet private key)
   - `ETHERSCAN_API_KEY` (for verification)

2. **USDT Balance**: You need USDT tokens on Sepolia to test purchases. You can get test USDT from:
   - Sepolia faucets
   - Uniswap Sepolia
   - Or any other testnet token faucet

## Contract Addresses (Sepolia)

```
NEXT_PUBLIC_NEBA_TOKEN=0x1175294Cf3BC254288C2Ed13326fD515c2b9Db1a
NEXT_PUBLIC_KYC_REGISTRY_ADDRESS=0x5Ae998bfBE395bd27F6aBCFBd6F8Bf383eedc82c
NEXT_PUBLIC_RATE_LIMITER_ADDRESS=0x67cfcAdF2d06aAccB12e9F305d9f1C9063C07aEC
NEXT_PUBLIC_FUNDS_VAULT_ADDRESS=0xED12cC985F87e219D0087ce4fE6141a2B470a861
NEXT_PUBLIC_VESTING_VAULT_ADDRESS=0x01c9DfCB7497792B928F2FE90523a05DE6e6E4C0
NEXT_PUBLIC_SALE_MANAGER_ADDRESS=0xA8C1ebacb854f226f11894a834574172fC0CA868
NEXT_PUBLIC_ROUND_ADDRESS=0x0C0253eE6eE6B61E79eC65b64F860283cB0e6990
NEXT_PUBLIC_REFERRAL_SYSTEM_ADDRESS=0x0C0253eE6eE6B61E79eC65b64F860283cB0e6990
NEXT_PUBLIC_USDT_ADDRESS=0x92E564DA3870a300de0C45971aD82A7dFC963E1a
NEXT_PUBLIC_USDC_ADDRESS=0xfc8Bf89bd7c6AE520BEDacE38140a9aF203458E6
```

## Test Scripts

### 1. Simple Purchase Test

```bash
npm run test:simple
```

This script:
- Tests a basic $100 USDT purchase
- Checks no-KYC mode status
- Verifies daily allowance
- Makes a single purchase
- Shows user contribution and allocation

### 2. Comprehensive Purchase Test

```bash
npm run test:purchase
```

This script:
- Tests multiple purchase amounts ($25, $100, $499)
- Tests error cases (below minimum, above maximum)
- Checks all system states
- Provides detailed logging
- Tests purchase bounds enforcement

## Manual Testing Steps

### Step 1: Enable No-KYC Mode

```bash
npm run manage:no-kyc -- --enable
```

### Step 2: Check System Status

```bash
npm run manage:no-kyc -- --status
```

### Step 3: Test Purchase

```bash
npm run test:simple
```

### Step 4: Test Error Cases

```bash
npm run test:purchase
```

## Expected Behavior

### ✅ Successful Purchase
- No-KYC mode enabled
- Amount between $25-$499
- Within daily allowance
- Sufficient USDT balance
- Round is active

### ❌ Failed Purchase
- **Below minimum**: Amount < $25
- **Above maximum**: Amount > $499
- **Daily cap exceeded**: Total daily spending > $499
- **No-KYC disabled**: Mode not enabled
- **Insufficient balance**: Not enough USDT
- **Round inactive**: Sale not active

## Purchase Bounds (No-KYC Mode Only)

- **Minimum**: $25 USD per transaction
- **Maximum**: $499 USD per transaction
- **Daily Cap**: $499 USD per wallet per 24 hours
- **Window**: Rolling 24-hour period

## Events to Monitor

```solidity
event NoKYCPurchase(
    address indexed buyer,
    address indexed paymentToken,
    uint256 paymentAmount,
    uint256 usdValue,
    uint256 tokenAmount,
    uint256 remainingDailyAllowance
);

event PurchaseBlockedByCap(
    address indexed buyer,
    uint256 attemptedAmount,
    uint256 currentSpent,
    uint256 dailyCap
);
```

## Troubleshooting

### Common Issues

1. **"No-KYC mode not enabled"**
   - Run: `npm run manage:no-kyc -- --enable`

2. **"Insufficient USDT balance"**
   - Get test USDT from Sepolia faucets

3. **"Daily cap exceeded"**
   - Wait 24 hours or use different wallet

4. **"Amount below minimum"**
   - Use at least $25 USDT

5. **"Amount above maximum"**
   - Use at most $499 USDT

### Debug Commands

```bash
# Check no-KYC status
npm run manage:no-kyc -- --status

# Check daily allowance
npm run manage:no-kyc -- --allowance <wallet-address>

# Enable no-KYC mode
npm run manage:no-kyc -- --enable

# Disable no-KYC mode
npm run manage:no-kyc -- --disable
```

## Security Notes

- No-KYC mode is temporary
- Daily caps prevent abuse
- Purchase bounds are enforced
- All transactions are on-chain
- No personal data stored

## Next Steps

1. Test all purchase scenarios
2. Verify event emissions
3. Check daily cap reset
4. Test pause/unpause
5. Prepare for production deployment
