# No-KYC Fallback Mode Implementation

## Overview

This document describes the implementation of the no-KYC fallback mode for the NEBA presale system. This mode allows users to participate without KYC verification while maintaining strict per-wallet daily caps for compliance.

## Features Implemented

### ✅ Core Requirements Met

1. **Strict Daily Cap**: $499 USD per wallet per 24-hour rolling window
2. **Multi-Currency Support**: USDC, USDT, and ETH purchases
3. **On-Chain Accounting**: Tracks daily spending per wallet
4. **Event Emissions**: Comprehensive event logging
5. **Admin Controls**: Operator/Safe gated toggling
6. **Price Feed Integration**: ETH/USD conversion with staleness checks

### ✅ Security Features

- **Daily Cap Enforcement**: Prevents exceeding $499 per wallet
- **Rolling 24-Hour Window**: Automatic reset after 24 hours
- **Price Feed Validation**: Staleness checks for ETH price
- **Access Control**: Only authorized roles can manage mode
- **Pause Integration**: Respects system pause states

## Contract Changes

### RateLimiter.sol

**New State Variables:**
```solidity
bool public noKYCEnabled = false;
uint256 public dailyCapUSD = 499e6; // $499 daily cap
uint256 public constant DAILY_WINDOW = 24 hours;
```

**New Functions:**
- `enableNoKYCMode()` - Enable no-KYC fallback mode
- `disableNoKYCMode()` - Disable no-KYC fallback mode
- `updateDailyCap(uint256 _dailyCapUSD)` - Update daily cap
- `checkDailyCap(address account, uint256 usdAmount)` - Check daily cap
- `getRemainingDailyAllowance(address account)` - Get remaining allowance

**New Events:**
- `NoKYCEnabled()` - Emitted when mode is enabled
- `NoKYCDisabled()` - Emitted when mode is disabled
- `DailyCapUpdated(uint256 newCap)` - Emitted when cap is updated
- `PurchaseBlockedByCap(address, uint256, uint256, uint256)` - Emitted when cap exceeded

### SaleRound.sol

**New Functions:**
- `buyWithUSDCNoKYC(uint256 usdcAmount, address referrer)` - USDC purchase without KYC
- `buyWithUSDTNoKYC(uint256 usdtAmount, address referrer)` - USDT purchase without KYC
- `buyWithETHNoKYC(address referrer)` - ETH purchase without KYC
- `getRemainingDailyAllowance(address user)` - Get user's remaining allowance
- `isNoKYCEnabled()` - Check if no-KYC mode is enabled

**New Events:**
- `NoKYCPurchase(address, address, uint256, uint256, uint256, uint256)` - No-KYC purchase event
- `DailyCapExceeded(address, uint256, uint256, uint256)` - Cap exceeded event

## Usage Examples

### Enable No-KYC Mode

```bash
# Enable no-KYC fallback mode
node scripts/manage-no-kyc.js enable

# Check status
node scripts/manage-no-kyc.js status
```

### Set Daily Cap

```bash
# Set daily cap to $300
node scripts/manage-no-kyc.js set-cap 300
```

### Check User Allowance

```bash
# Check remaining allowance for user
node scripts/manage-no-kyc.js check-allowance 0x1234567890abcdef...
```

### Disable No-KYC Mode

```bash
# Disable no-KYC fallback mode
node scripts/manage-no-kyc.js disable
```

## Frontend Integration

### Banner Display

```javascript
// Check if no-KYC mode is enabled
const isNoKYCEnabled = await saleRound.isNoKYCEnabled();

if (isNoKYCEnabled) {
  // Show banner: "Temporary no-KYC mode: 499 USD/day per wallet."
  showBanner("Temporary no-KYC mode: 499 USD/day per wallet.");
}
```

### Remaining Allowance Display

```javascript
// Get remaining daily allowance
const remainingAllowance = await saleRound.getRemainingDailyAllowance(userAddress);
const remainingUSD = ethers.formatUnits(remainingAllowance, 6);

console.log(`Remaining daily allowance: $${remainingUSD}`);
```

### Purchase Flow

```javascript
// No-KYC purchase flow
if (isNoKYCEnabled) {
  // Use no-KYC functions
  await saleRound.buyWithUSDCNoKYC(amount, referrer);
  await saleRound.buyWithUSDTNoKYC(amount, referrer);
  await saleRound.buyWithETHNoKYC(referrer, { value: ethAmount });
} else {
  // Use regular KYC functions
  await saleRound.buyWithUSDC(amount, referrer);
  await saleRound.buyWithUSDT(amount, referrer);
  await saleRound.buyWithETH(referrer, { value: ethAmount });
}
```

## Test Cases

### Comprehensive Test Suite

The implementation includes extensive test coverage:

1. **Daily Cap Enforcement**
   - Allow exactly $499 USD
   - Block when exceeding $499 USD
   - Multiple purchases within cap
   - Block when next purchase would exceed cap

2. **Window Reset**
   - Reset after 24 hours
   - Correct allowance calculation
   - Multiple windows

3. **Mixed Asset Flows**
   - USDC + USDT + ETH within same window
   - Cross-asset spending tracking
   - Price conversion accuracy

4. **ETH Price Feed**
   - Stale price detection
   - Price validation
   - Conversion accuracy

5. **Pause/Unpause**
   - Respect pause state in no-KYC mode
   - Emergency controls

6. **Events**
   - All required events emitted
   - Event parameter validation

### Running Tests

```bash
# Run no-KYC specific tests
npm run test:no-kyc

# Run all tests
npm test
```

## Deployment

### Deploy with No-KYC Support

```bash
# Deploy to testnet with no-KYC support
npm run deploy:no-kyc

# Deploy to mainnet
npm run deploy:mainnet
```

### Management Commands

```bash
# Check status
npm run manage:no-kyc status

# Enable mode
npm run manage:no-kyc enable

# Set daily cap
npm run manage:no-kyc set-cap 300

# Check user allowance
npm run manage:no-kyc check-allowance 0x1234...
```

## Security Considerations

### Access Control

- **Admin Only**: Only `RATE_ADMIN_ROLE` can enable/disable mode
- **Multisig Integration**: Safe wallet can manage mode
- **Operator Controls**: Delegated management possible

### Daily Cap Limits

- **Maximum Cap**: $1000 USD (configurable)
- **Minimum Cap**: $1 USD
- **Default Cap**: $499 USD

### Price Feed Security

- **Staleness Check**: Maximum 5-minute delay
- **Price Bounds**: $1,000 - $10,000 ETH price range
- **Oracle Validation**: Chainlink-compatible interface

## Migration Plan

### When Sumsub API is Ready

1. **Disable No-KYC Mode**
   ```bash
   node scripts/manage-no-kyc.js disable
   ```

2. **Re-enable KYC Gating**
   - Users must complete KYC verification
   - Whitelist management resumes
   - Regular purchase functions active

3. **Daily Cap Policy**
   - Keep daily cap for additional compliance
   - Or remove based on policy requirements

## Monitoring & Analytics

### Key Metrics

- **Daily Cap Usage**: Track how much of daily cap is used
- **Purchase Patterns**: Analyze user behavior
- **Mode Adoption**: Monitor no-KYC vs KYC usage
- **Cap Exceeded Events**: Track blocked purchases

### Events to Monitor

```solidity
// Mode management
event NoKYCEnabled();
event NoKYCDisabled();
event DailyCapUpdated(uint256 newCap);

// Purchase events
event NoKYCPurchase(address buyer, address token, uint256 amount, uint256 usdValue, uint256 tokens, uint256 remaining);
event DailyCapExceeded(address buyer, uint256 attempted, uint256 current, uint256 cap);
```

## Error Handling

### Common Error Messages

- `"RateLimiter: no-KYC mode not enabled"` - Mode not enabled
- `"RateLimiter: daily cap exceeded"` - Daily cap exceeded
- `"SaleRound: no-KYC mode not enabled"` - Function called when mode disabled
- `"SaleRound: stale price data"` - ETH price feed stale

### Frontend Error Handling

```javascript
try {
  await saleRound.buyWithUSDCNoKYC(amount, referrer);
} catch (error) {
  if (error.message.includes("daily cap exceeded")) {
    showError("Daily limit reached. Try again after the 24-hour window resets.");
  } else if (error.message.includes("no-KYC mode not enabled")) {
    showError("No-KYC mode is not currently available.");
  }
}
```

## Configuration

### Environment Variables

```env
# No-KYC mode configuration
FEATURE_NO_KYC_FALLBACK=1
DAILY_CAP_USD=499
```

### Contract Configuration

```javascript
// Enable no-KYC mode
await rateLimiter.enableNoKYCMode();

// Set daily cap
await rateLimiter.updateDailyCap(ethers.parseUnits("499", 6));

// Disable mode
await rateLimiter.disableNoKYCMode();
```

## Summary

The no-KYC fallback mode implementation provides:

✅ **Complete Feature Set**: All requirements from NO_KYC.md implemented
✅ **Security First**: Strict daily caps and access controls
✅ **User Experience**: Seamless integration with existing system
✅ **Compliance Ready**: On-chain accounting and event logging
✅ **Production Ready**: Comprehensive testing and documentation
✅ **Migration Path**: Clear transition back to KYC mode

The system is ready for deployment and can be easily toggled between KYC and no-KYC modes as needed.
