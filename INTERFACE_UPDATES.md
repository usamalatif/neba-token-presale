# Interface Updates for No-KYC Fallback Mode

## Overview

All interfaces have been updated to include the new functions and events added for the no-KYC fallback mode implementation. This ensures proper type safety and contract interaction.

## Updated Interfaces

### 1. IRateLimiter.sol

**Added No-KYC Functions:**
```solidity
// No-KYC fallback mode functions
function checkDailyCap(address account, uint256 usdAmount) external;
function enableNoKYCMode() external;
function disableNoKYCMode() external;
function updateDailyCap(uint256 _dailyCapUSD) external;
function getRemainingDailyAllowance(address account) external view returns (uint256);

// State variables
function noKYCEnabled() external view returns (bool);
function dailyCapUSD() external view returns (uint256);
function DAILY_WINDOW() external view returns (uint256);
```

**Added Events:**
```solidity
event NoKYCEnabled();
event NoKYCDisabled();
event DailyCapUpdated(uint256 newCap);
event PurchaseBlockedByCap(address indexed account, uint256 attemptedAmount, uint256 currentSpent, uint256 dailyCap);
```

**Updated Functions:**
- `getRateLimitInfo()` now includes `totalVolume` parameter

### 2. ISaleRound.sol (New Interface)

**No-KYC Purchase Functions:**
```solidity
function buyWithUSDCNoKYC(uint256 usdcAmount, address referrer) external;
function buyWithUSDTNoKYC(uint256 usdtAmount, address referrer) external;
function buyWithETHNoKYC(address referrer) external payable;
```

**No-KYC View Functions:**
```solidity
function getRemainingDailyAllowance(address user) external view returns (uint256);
function isNoKYCEnabled() external view returns (bool);
```

**Added Events:**
```solidity
event NoKYCPurchase(
    address indexed buyer,
    address indexed paymentToken,
    uint256 paymentAmount,
    uint256 usdValue,
    uint256 tokenAmount,
    uint256 remainingDailyAllowance
);
event DailyCapExceeded(
    address indexed buyer,
    uint256 attemptedAmount,
    uint256 currentSpent,
    uint256 dailyCap
);
```

### 3. IFundsVault.sol

**Added Functions:**
```solidity
// Authorization functions
function authorizeDepositor(address depositor) external;
function revokeDepositor(address depositor) external;

// View functions
function getETHBalance() external view returns (uint256);
function getTokenBalance(address token) external view returns (uint256);
function authorizedDepositors(address depositor) external view returns (bool);
function multisig() external view returns (address);
```

**Added Events:**
```solidity
event DepositorAuthorized(address indexed depositor);
event DepositorRevoked(address indexed depositor);
```

### 4. IVestingVault.sol

**Added Functions:**
```solidity
// View functions
function getVestingScheduleCount(address beneficiary) external view returns (uint256);
function getVestingSchedule(address beneficiary, uint256 index) external view returns (VestingSchedule memory);

// Initialization
function initialize(address _saleManager) external;

// State variables
function token() external view returns (address);
function saleManager() external view returns (address);
function SALE_ROUND_ROLE() external view returns (bytes32);
```

**Added Struct:**
```solidity
struct VestingSchedule {
    uint256 totalAmount;
    uint256 claimedAmount;
    uint256 startTime;
    uint256 cliffEnd;
    uint256 vestingEnd;
}
```

### 5. IKYCRegistry.sol

**Added Access Control Functions:**
```solidity
function KYC_MANAGER_ROLE() external view returns (bytes32);
function DEFAULT_ADMIN_ROLE() external view returns (bytes32);
function hasRole(bytes32 role, address account) external view returns (bool);
function grantRole(bytes32 role, address account) external;
function revokeRole(bytes32 role, address account) external;
```

### 6. ISaleManager.sol (New Interface)

**Complete SaleManager Interface:**
```solidity
// Round management
function createRound(RoundConfig memory config) external returns (address);
function authorizeSaleRound(uint256 roundIndex) external;
function getRoundCount() external view returns (uint256);
function getRound(uint256 index) external view returns (address);
function getAllRounds() external view returns (address[] memory);

// Timelock operations
function scheduleOperation(address target, bytes memory data) external returns (bytes32);
function executeOperation(bytes32 operationId) external;
function cancelOperation(bytes32 operationId) external;

// Emergency controls
function emergencyPause() external;
function unpause() external;
function pauseRound(uint256 roundIndex) external;
function unpauseRound(uint256 roundIndex) external;
```

### 7. IReferralSystem.sol (New Interface)

**Complete ReferralSystem Interface:**
```solidity
// Referral management
function registerReferral(address referee, address referrer) external;
function calculateReferralBonus(address referee, uint256 tokenAmount) external returns (
    address referrer,
    uint256 referrerBonus,
    uint256 refereeBonus
);

// Configuration
function updateBonusPercentages(uint256 _referrerBps, uint256 _refereeBps) external;

// View functions
function getReferrer(address referee) external view returns (address);
function hasReferrer(address referee) external view returns (bool);
function getReferredUsers(address referrer) external view returns (address[] memory);
function getReferralStats(address user) external view returns (
    address referrer,
    uint256 totalReferred,
    uint256 totalBonusEarned,
    bool hasReferred
);
```

## Usage Examples

### Using Interfaces in Tests

```javascript
// Get contract instance using interface
const rateLimiter = await ethers.getContractAt("IRateLimiter", rateLimiterAddress);

// Check no-KYC status
const isEnabled = await rateLimiter.noKYCEnabled();
const dailyCap = await rateLimiter.dailyCapUSD();

// Enable no-KYC mode
await rateLimiter.enableNoKYCMode();

// Check remaining allowance
const remaining = await rateLimiter.getRemainingDailyAllowance(userAddress);
```

### Using Interfaces in Scripts

```javascript
// Get SaleRound interface
const saleRound = await ethers.getContractAt("ISaleRound", roundAddress);

// Check if no-KYC is enabled
const isNoKYC = await saleRound.isNoKYCEnabled();

// Get remaining allowance
const allowance = await saleRound.getRemainingDailyAllowance(userAddress);

// Make no-KYC purchase
if (isNoKYC) {
  await saleRound.buyWithUSDCNoKYC(amount, referrer);
}
```

### Using Interfaces in Frontend

```javascript
// Type-safe contract interaction
const rateLimiter = new ethers.Contract(rateLimiterAddress, IRateLimiterABI, provider);

// Check no-KYC status
const [isEnabled, dailyCap] = await Promise.all([
  rateLimiter.noKYCEnabled(),
  rateLimiter.dailyCapUSD()
]);

// Get user's remaining allowance
const remaining = await rateLimiter.getRemainingDailyAllowance(userAddress);
```

## Benefits of Updated Interfaces

### 1. **Type Safety**
- All new functions are properly typed
- Compile-time checking for function signatures
- Better IDE support and autocomplete

### 2. **Contract Interaction**
- Clean separation of concerns
- Easy to mock for testing
- Consistent API across contracts

### 3. **Documentation**
- Self-documenting interfaces
- Clear function signatures
- Event definitions included

### 4. **Maintainability**
- Easy to update interfaces when contracts change
- Version control for interface changes
- Backward compatibility considerations

## File Structure

```
src/interfaces/
├── IRateLimiter.sol      # Updated with no-KYC functions
├── ISaleRound.sol        # New interface for SaleRound
├── IFundsVault.sol       # Updated with all functions
├── IVestingVault.sol     # Updated with all functions
├── IKYCRegistry.sol      # Updated with access control
├── ISaleManager.sol      # New interface for SaleManager
└── IReferralSystem.sol   # New interface for ReferralSystem
```

## Summary

All interfaces have been comprehensively updated to include:

✅ **No-KYC Functions**: All new no-KYC functionality properly typed
✅ **Access Control**: Complete role-based access control interfaces
✅ **View Functions**: All getter functions included
✅ **Events**: All events properly defined
✅ **Structs**: Data structures included where needed
✅ **State Variables**: Public variables accessible through interfaces

The interfaces now provide complete type safety and documentation for all contract interactions, making the codebase more maintainable and developer-friendly.
