# NEBA Token Presale - Critical Security Audit Report

## 🚨 URGENT - DEPLOYMENT BLOCKERS IDENTIFIED

Dear Development Team,

I've completed a comprehensive security audit of the NEBA Token presale smart contracts. **Critical vulnerabilities have been identified that will cause complete system failure if deployed as-is.**

**Audited Contracts:**
- SaleRound.sol (main presale contract)
- VestingVault.sol (token vesting management)
- FundsVault.sol (payment collection)
- ReferralSystem.sol (referral tracking)
- KYCRegistry.sol (whitelist management)

---

## 🔴 CRITICAL SEVERITY ISSUES - MUST FIX BEFORE DEPLOYMENT

### C-1: TOKENS CANNOT BE CLAIMED - Missing Token Transfer to VestingVault

**Severity:** 🔴 CRITICAL  -- *** NO NEED ACCORDING TO BUSSINESS LOGIC ***
**Impact:** Complete system failure - users cannot claim purchased tokens  
**Contract:** SaleRound.sol  
**Functions:** `_processPurchase()` (lines 407-456), `_processNoKYCPurchase()` (lines 463-512)

#### Problem Description

The SaleRound contract creates vesting schedules by calling `vestingVault.createVesting()`, but it **never transfers NEBA tokens** to the VestingVault contract. When users attempt to claim their vested tokens, the transaction will revert with "insufficient vault balance" because VestingVault has zero tokens.

#### Current Broken Flow:
```
User purchases tokens → SaleRound creates vesting schedule → NO tokens transferred
→ User claims → VestingVault attempts transfer → FAILS (no tokens in vault)
```

#### Code Evidence:

**In _processPurchase() - Lines 448-455:**
```solidity
// Create vesting schedule for buyer (includes referee bonus if applicable)
uint256 vestingStart = config.endTime;
vestingVault.createVesting(
    buyer,
    totalTokensToVest,
    config.cliffDuration,
    config.vestingDuration,
    vestingStart
);
// ❌ CRITICAL BUG: No token transfer happens here!
// VestingVault now has a schedule but zero tokens to fulfill it
```

**In _processPurchase() - Lines 433-442 (Referrer bonus):**
```solidity
// Create vesting for referrer bonus
vestingVault.createVesting(
    actualReferrer,
    referrerBonus,
    config.cliffDuration,
    config.vestingDuration,
    config.endTime
);
// ❌ CRITICAL BUG: No tokens transferred for referrer bonus either!
```

#### Why This Happens:

In VestingVault.sol, the `claimVested()` function attempts to transfer tokens:
```solidity
// VestingVault.sol - Line 145
token.safeTransfer(msg.sender, claimable);
```

But VestingVault never receives any tokens, so `token.balanceOf(address(this))` will be 0.

#### Required Fixes:

**Option 1: Transfer tokens immediately after creating vesting (RECOMMENDED)**

```solidity
// In _processPurchase() after line 455:
vestingVault.createVesting(
    buyer,
    totalTokensToVest,
    config.cliffDuration,
    config.vestingDuration,
    vestingStart
);

// ✅ ADD THIS:
nebaToken.safeTransfer(address(vestingVault), totalTokensToVest);

// Also for referrer bonus after line 442:
vestingVault.createVesting(
    actualReferrer,
    referrerBonus,
    config.cliffDuration,
    config.vestingDuration,
    config.endTime
);

// ✅ ADD THIS:
nebaToken.safeTransfer(address(vestingVault), referrerBonus);
```

**Option 2: Modify VestingVault to pull tokens from SaleRound**

This requires architectural changes to VestingVault.sol:
```solidity
// In VestingVault.sol
address public tokenSource; // SaleRound address

function claimVested() external nonReentrant {
    uint256 claimable = getClaimableAmount(msg.sender);
    require(claimable > 0, "VestingVault: nothing to claim");
    
    // Pull tokens from source
    IERC20(token).safeTransferFrom(tokenSource, msg.sender, claimable);
    // ... rest of logic
}
```

**Option 3: Pre-fund VestingVault with total allocation**

Before presale starts:
```solidity
// In deployment/setup script:
uint256 totalPresaleAllocation = 300_000_000e18; // 30% of supply
nebaToken.safeTransfer(address(vestingVault), totalPresaleAllocation);
```

**RECOMMENDATION: Use Option 1 - it's the safest and matches your current architecture.**

#### Additional Required Changes:

1. **Add balance check in SaleRound:**
```solidity
function _processPurchase(...) private {
    // Before creating vesting, verify SaleRound has enough tokens
    require(
        nebaToken.balanceOf(address(this)) >= totalTokensToVest,
        "SaleRound: insufficient token balance"
    );
    
    // Create vesting
    vestingVault.createVesting(...);
    
    // Transfer tokens
    nebaToken.safeTransfer(address(vestingVault), totalTokensToVest);
}
```

2. **Add funding function to SaleRound:**
```solidity
function fundPresale(uint256 amount) external onlyManager {
    nebaToken.safeTransferFrom(msg.sender, address(this), amount);
}
```

3. **Update deployment sequence:**
```
1. Deploy all contracts
2. Mint NEBA tokens to treasury
3. Treasury calls: nebaToken.approve(saleRound, presaleAllocation)
4. Manager calls: saleRound.fundPresale(presaleAllocation)
5. Start presale
```

---

### C-2: ORACLE MANIPULATION & NO CIRCUIT BREAKER

**Severity:** 🔴 CRITICAL  - FIXED WITH FIX # 1 10% price change per hour
**Impact:** Price manipulation, users can steal tokens or overpay massively  
**Contract:** SaleRound.sol  
**Function:** `_getETHPrice()` (lines 569-603)

#### Problem Description

The ETH price oracle implementation has multiple critical vulnerabilities:
1. No circuit breaker for extreme price movements
2. No fallback oracle mechanism
3. Single point of failure
4. Hardcoded price bounds may not reflect reality
5. Vulnerable to flash crash scenarios
6. No TWAP (Time-Weighted Average Price) protection

#### Attack Scenarios:

**Scenario 1: Flash Crash Exploitation**
```
Normal ETH Price: $3,000
Flash crash to: $1,500 (within bounds, passes validation)
Attacker buys: 1 ETH worth of tokens = 2x tokens vs normal price
ETH rebounds to $3,000 immediately
Attacker profits: 100% gain at protocol's expense
```

**Scenario 2: Oracle Manipulation**
```
Attacker compromises/manipulates price feed
Sets ETH price to $10,000 (MAX_PRICE)
Protocol receives 1 ETH = thinks it's $10,000 worth
Actually only $3,000 worth of value
Protocol oversells tokens by 3.3x
```

**Scenario 3: Stale Price Attack**
```
Last oracle update: 59 minutes ago (within MAX_ORACLE_DELAY of 1 hour)
ETH price was: $3,000
Current ETH price: $2,000 (30% drop)
Attacker buys using stale $3,000 price
Gets 50% more tokens than they should
```

#### Current Vulnerable Code:

```solidity
function _getETHPrice() private view returns (uint256) {
    (bool success, bytes memory data) = ethUSDOracle.staticcall(
        abi.encodeWithSignature("latestRoundData()")
    );
    require(success, "SaleRound: oracle call failed");

    (
        uint80 roundId,
        int256 price,
        ,
        uint256 updatedAt,
        uint80 answeredInRound
    ) = abi.decode(data, (uint80, int256, uint256, uint256, uint80));

    // ⚠️ INSUFFICIENT VALIDATION
    require(price > 0, "SaleRound: invalid price");
    require(updatedAt > 0, "SaleRound: invalid timestamp");
    require(block.timestamp - updatedAt <= MAX_ORACLE_DELAY, "SaleRound: stale price data");
    require(answeredInRound >= roundId, "SaleRound: stale round data");
    
    // ⚠️ HARDCODED BOUNDS - NOT CONFIGURABLE
    require(uint256(price) >= MIN_PRICE && uint256(price) <= MAX_PRICE, 
        "SaleRound: price out of bounds");

    return uint256(price) / 100;
}
```

#### Required Fixes:

**Fix 1: Add Circuit Breaker for Price Changes**

```solidity
uint256 public lastValidETHPrice;
uint256 public lastPriceUpdateTime;
uint256 public constant MAX_PRICE_CHANGE_PERCENT = 10; // 10% max change per hour

function _getETHPrice() private returns (uint256) {
    // ... existing oracle call ...
    
    uint256 newPrice = uint256(price) / 100;
    
    // Circuit breaker: Check for extreme price movements
    if (lastValidETHPrice > 0 && block.timestamp - lastPriceUpdateTime < 1 hours) {
        uint256 priceDiff = newPrice > lastValidETHPrice 
            ? newPrice - lastValidETHPrice 
            : lastValidETHPrice - newPrice;
        uint256 percentChange = (priceDiff * 100) / lastValidETHPrice;
        
        require(
            percentChange <= MAX_PRICE_CHANGE_PERCENT,
            "SaleRound: price change too extreme"
        );
    }
    
    lastValidETHPrice = newPrice;
    lastPriceUpdateTime = block.timestamp;
    
    return newPrice;
}
```

**Fix 2: Add Multiple Oracles with Median Price**

```solidity
address[] public ethUSDOracles; // Multiple oracles
uint256 public constant MIN_ORACLES = 3;

function _getETHPrice() private view returns (uint256) {
    require(ethUSDOracles.length >= MIN_ORACLES, "SaleRound: insufficient oracles");
    
    uint256[] memory prices = new uint256[](ethUSDOracles.length);
    uint256 validPrices = 0;
    
    // Query all oracles
    for (uint256 i = 0; i < ethUSDOracles.length; i++) {
        try this._queryOracle(ethUSDOracles[i]) returns (uint256 oraclePrice) {
            prices[validPrices] = oraclePrice;
            validPrices++;
        } catch {
            // Oracle failed, skip it
        }
    }
    
    require(validPrices >= MIN_ORACLES, "SaleRound: insufficient valid prices");
    
    // Return median price
    return _getMedian(prices, validPrices);
}

function _getMedian(uint256[] memory prices, uint256 len) private pure returns (uint256) {
    // Sort and return median
    // Implementation details omitted for brevity
}
```

**Fix 3: Add Manual Price Override for Emergencies**

```solidity
uint256 public manualETHPrice;
bool public useManualPrice;
uint256 public constant MANUAL_PRICE_EXPIRY = 1 hours;
uint256 public manualPriceSetTime;

function setManualPrice(uint256 _price) external onlyManager {
    require(_price >= MIN_PRICE && _price <= MAX_PRICE, "SaleRound: price out of bounds");
    manualETHPrice = _price;
    useManualPrice = true;
    manualPriceSetTime = block.timestamp;
    emit ManualPriceSet(_price);
}

function _getETHPrice() private view returns (uint256) {
    // Check if manual price is active and not expired
    if (useManualPrice && block.timestamp - manualPriceSetTime < MANUAL_PRICE_EXPIRY) {
        return manualETHPrice;
    }
    
    // Otherwise use oracle
    // ... existing oracle logic ...
}
```

**Fix 4: Make Price Bounds Configurable**

```solidity
// Remove constants, make them state variables
uint256 public minETHPrice = 1000e6;  // $1,000
uint256 public maxETHPrice = 10000e6; // $10,000

function updatePriceBounds(uint256 _min, uint256 _max) external onlyManager {
    require(_min > 0 && _max > _min, "SaleRound: invalid bounds");
    minETHPrice = _min;
    maxETHPrice = _max;
    emit PriceBoundsUpdated(_min, _max);
}
```

**Fix 5: Add TWAP Protection**

```solidity
struct PriceSnapshot {
    uint256 price;
    uint256 timestamp;
}

PriceSnapshot[] public priceHistory;
uint256 public constant TWAP_PERIOD = 30 minutes;

function _getTWAPPrice() private view returns (uint256) {
    uint256 totalWeight = 0;
    uint256 weightedSum = 0;
    uint256 cutoffTime = block.timestamp - TWAP_PERIOD;
    
    for (uint256 i = priceHistory.length; i > 0; i--) {
        PriceSnapshot memory snapshot = priceHistory[i - 1];
        
        if (snapshot.timestamp < cutoffTime) break;
        
        uint256 weight = block.timestamp - snapshot.timestamp;
        weightedSum += snapshot.price * weight;
        totalWeight += weight;
    }
    
    require(totalWeight > 0, "SaleRound: no price history");
    return weightedSum / totalWeight;
}
```

**RECOMMENDATION: Implement at minimum Fix 1 (Circuit Breaker) and Fix 3 (Manual Override) before deployment.**

---

## 🟠 HIGH SEVERITY ISSUES - CRITICAL FIXES REQUIRED - *** NO NEED as we alreadt have function in SaleManager to authorize SaleRound ***

### H-1: REFERRAL SYSTEM COMPLETELY BROKEN - Missing Role Assignment

**Severity:** 🟠 HIGH  
**Impact:** 100% of referral functionality fails, no bonuses distributed  
**Contracts:** ReferralSystem.sol + SaleRound.sol

#### Problem Description

The ReferralSystem contract requires callers to have the `SALE_ROUND_ROLE` to register referrals and calculate bonuses. However, this role is **never granted** to the SaleRound contract, causing all referral operations to revert.

#### Evidence of Failure:

**ReferralSystem.sol - Lines 49-56:**
```solidity
function registerReferral(address referee, address referrer) 
    external 
    onlyRole(SALE_ROUND_ROLE)  // ❌ SaleRound doesn't have this role!
{
    require(referee != address(0), "ReferralSystem: zero referee");
    require(referrer != address(0), "ReferralSystem: zero referrer");
    require(referee != referrer, "ReferralSystem: self-referral");
    require(!referralData[referee].hasReferred, "ReferralSystem: already referred");
    // ... This code never executes
}
```

**ReferralSystem.sol - Lines 67-74:**
```solidity
function calculateReferralBonus(address referee, uint256 tokenAmount)
    external
    onlyRole(SALE_ROUND_ROLE)  // ❌ SaleRound doesn't have this role!
    returns (address referrer, uint256 referrerBonus, uint256 refereeBonus)
{
    // ... This code never executes
}
```

**ReferralSystem.sol - Constructor (Lines 27-31):**
```solidity
constructor(address admin) {
    require(admin != address(0), "ReferralSystem: zero address");
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(REFERRAL_ADMIN_ROLE, admin);
    // ❌ MISSING: _grantRole(SALE_ROUND_ROLE, saleRound);
    // But saleRound doesn't exist yet at deployment time!
}
```

#### Call Flow That Fails:

```
User calls: saleRound.buyWithUSDC(1000e6, referrerAddress)
→ SaleRound calls: referralSystem.registerReferral(buyer, referrer)
→ OpenZeppelin AccessControl checks: hasRole(SALE_ROUND_ROLE, msg.sender)
→ Returns FALSE (SaleRound was never granted the role)
→ TRANSACTION REVERTS with "AccessControl: account 0x... is missing role..."
→ User's purchase fails completely
```

#### Required Fixes:

**Fix 1: Add Role Authorization Function (RECOMMENDED)**

Add to ReferralSystem.sol:
```solidity
/**
 * @notice Authorize a SaleRound contract to register referrals
 * @param saleRound Address of the SaleRound contract
 */
function authorizeSaleRound(address saleRound) 
    external 
    onlyRole(DEFAULT_ADMIN_ROLE) 
{
    require(saleRound != address(0), "ReferralSystem: zero address");
    _grantRole(SALE_ROUND_ROLE, saleRound);
    emit SaleRoundAuthorized(saleRound);
}

/**
 * @notice Revoke SaleRound authorization
 * @param saleRound Address of the SaleRound contract
 */
function revokeSaleRound(address saleRound) 
    external 
    onlyRole(DEFAULT_ADMIN_ROLE) 
{
    _revokeRole(SALE_ROUND_ROLE, saleRound);
    emit SaleRoundRevoked(saleRound);
}

// Add events
event SaleRoundAuthorized(address indexed saleRound);
event SaleRoundRevoked(address indexed saleRound);
```

**Fix 2: Update Deployment Script**

```javascript
// After deploying all contracts:

// 1. Grant SALE_ROUND_ROLE to SaleRound in ReferralSystem
await referralSystem.authorizeSaleRound(saleRound.address);
console.log("✅ SaleRound authorized in ReferralSystem");

// 2. Verify the role was granted
const hasRole = await referralSystem.hasRole(
    await referralSystem.SALE_ROUND_ROLE(),
    saleRound.address
);
console.log("SaleRound has SALE_ROUND_ROLE:", hasRole);
require(hasRole, "Role grant failed!");
```

**Fix 3: Add Initialization Checks**

Add to SaleRound.sol:
```solidity
function verifyIntegrations() external view returns (bool) {
    // Verify ReferralSystem permissions
    bytes32 saleRoundRole = referralSystem.SALE_ROUND_ROLE();
    require(
        referralSystem.hasRole(saleRoundRole, address(this)),
        "SaleRound: missing SALE_ROUND_ROLE in ReferralSystem"
    );
    
    // Verify VestingVault permissions (see H-3)
    bytes32 vestingRole = vestingVault.SALE_ROUND_ROLE();
    require(
        vestingVault.hasRole(vestingRole, address(this)),
        "SaleRound: missing SALE_ROUND_ROLE in VestingVault"
    );
    
    return true;
}
```

**Testing Script to Verify Fix:**

```javascript
describe("Referral System Integration", function() {
    it("Should allow SaleRound to register referrals", async function() {
        // Setup
        const [admin, buyer, referrer] = await ethers.getSigners();
        
        // Grant role
        await referralSystem.authorizeSaleRound(saleRound.address);
        
        // Test referral registration through SaleRound
        await usdc.connect(buyer).approve(saleRound.address, 1000e6);
        await saleRound.connect(buyer).buyWithUSDC(1000e6, referrer.address);
        
        // Verify referral was registered
        const buyerReferrer = await referralSystem.getReferrer(buyer.address);
        expect(buyerReferrer).to.equal(referrer.address);
        
        console.log("✅ Referral system working correctly");
    });
});
```

---

### H-2: VESTING VAULT ADMIN ROLE COMPROMISE RISK - FIXED

**Severity:** 🟠 HIGH  
**Impact:** Complete vesting system compromise if SaleManager is hacked  
**Contract:** VestingVault.sol  
**Function:** `initialize()` (lines 67-77)

#### Problem Description

The `initialize()` function grants `DEFAULT_ADMIN_ROLE` to the SaleManager, giving it **unlimited power** over the VestingVault, including:
- Granting SALE_ROUND_ROLE to malicious contracts
- Creating arbitrary vesting schedules
- Potentially draining tokens if additional functions are added
- Bricking the contract by revoking necessary roles

This violates the principle of least privilege and creates a massive attack surface.

#### Current Vulnerable Code:

```solidity
function initialize(address _saleManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(!_initialized, "VestingVault: already initialized");
    require(_saleManager != address(0), "VestingVault: zero manager address");
    
    saleManager = _saleManager;
    _initialized = true;
    
    // ⚠️ SECURITY RISK: Grants full admin control to sale manager
    _grantRole(DEFAULT_ADMIN_ROLE, _saleManager);
    
    emit SaleRoundAuthorized(_saleManager);
}
```

#### Attack Scenario:

```
1. Attacker compromises SaleManager private key
2. SaleManager has DEFAULT_ADMIN_ROLE in VestingVault
3. Attacker grants SALE_ROUND_ROLE to malicious contract
4. Malicious contract creates vesting schedules for attacker's addresses
5. Attacker drains all tokens from VestingVault
6. OR: Attacker revokes SALE_ROUND_ROLE from legitimate SaleRound
7. Legitimate users cannot claim their tokens
```

#### Required Fix:

**Replace with Minimal Permission Grant:**

```solidity
function initialize(address _saleManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(!_initialized, "VestingVault: already initialized");
    require(_saleManager != address(0), "VestingVault: zero manager address");
    
    saleManager = _saleManager;
    _initialized = true;
    
    // ✅ FIXED: Only grant SALE_ROUND_ROLE, not DEFAULT_ADMIN_ROLE
    _grantRole(SALE_ROUND_ROLE, _saleManager);
    
    emit SaleRoundAuthorized(_saleManager);
}
```

**Add Emergency Functions with Timelock:**

```solidity
uint256 public constant TIMELOCK_PERIOD = 2 days;

struct PendingRoleGrant {
    address account;
    bytes32 role;
    uint256 executeAfter;
    bool executed;
}

mapping(bytes32 => PendingRoleGrant) public pendingGrants;

function scheduleroleGrant(address account, bytes32 role) 
    external 
    onlyRole(DEFAULT_ADMIN_ROLE) 
{
    bytes32 grantId = keccak256(abi.encodePacked(account, role, block.timestamp));
    
    pendingGrants[grantId] = PendingRoleGrant({
        account: account,
        role: role,
        executeAfter: block.timestamp + TIMELOCK_PERIOD,
        executed: false
    });
    
    emit RoleGrantScheduled(account, role, block.timestamp + TIMELOCK_PERIOD);
}

function executeRoleGrant(bytes32 grantId) 
    external 
    onlyRole(DEFAULT_ADMIN_ROLE) 
{
    PendingRoleGrant storage grant = pendingGrants[grantId];
    require(!grant.executed, "VestingVault: already executed");
    require(block.timestamp >= grant.executeAfter, "VestingVault: timelock not expired");
    
    _grantRole(grant.role, grant.account);
    grant.executed = true;
    
    emit RoleGrantExecuted(grant.account, grant.role);
}
```

---

### H-3: HARD CAP CAN BE EXCEEDED - Race Condition - FIXED

**Severity:** 🟠 HIGH  
**Impact:** Presale raises more than intended hard cap  
**Contract:** SaleRound.sol  
**Functions:** All buy functions

#### Problem Description

Multiple users can submit purchase transactions in the same block when near the hard cap, causing the total raised amount to exceed the hard cap due to a race condition in the check.

#### Current Vulnerable Code:

```solidity
function _processPurchase(...) private {
    // ⚠️ VULNERABLE: Check happens BEFORE updating state
    require(totalRaisedUSD + usdValue <= config.hardCapUSD, "SaleRound: exceeds hard cap");
    
    contributions[buyer] += usdValue;
    tokenAllocations[buyer] += tokenAmount;
    totalRaisedUSD += usdValue;  // Updated AFTER the check
    totalTokensSold += tokenAmount;
    // ... rest of function
}
```

#### Attack Example:

```
Hard Cap: 1,000,000 USD
Current Raised: 995,000 USD
Remaining: 5,000 USD

Block N transactions:
1. User A buys 5,000 USD
   - Checks: 995,000 + 5,000 <= 1,000,000 ✓ PASS
   
2. User B buys 5,000 USD  
   - Checks: 995,000 + 5,000 <= 1,000,000 ✓ PASS (reads old state)
   
3. User C buys 5,000 USD
   - Checks: 995,000 + 5,000 <= 1,000,000 ✓ PASS (reads old state)

After block executes:
Total Raised = 995,000 + 5,000 + 5,000 + 5,000 = 1,010,000 USD
Hard Cap Exceeded by: 10,000 USD (10 users got 2x more tokens than they should)
```

#### Required Fixes:

**Fix 1: Check AFTER State Update (RECOMMENDED)**

```solidity
function _processPurchase(...) private {
    // Update state first
    contributions[buyer] += usdValue;
    totalRaisedUSD += usdValue;
    tokenAllocations[buyer] += tokenAmount;
    totalTokensSold += tokenAmount;
    
    // ✅ FIXED: Check AFTER updating state
    require(totalRaisedUSD <= config.hardCapUSD, "SaleRound: exceeds hard cap");
    
    // If check fails, state is already updated but transaction will revert
    // This ensures hard cap is never exceeded
    
    // ... rest of function
}
```

**Fix 2: Add Refund Logic for Partial Fills**

```solidity
function _processPurchase(...) private {
    uint256 remainingCap = config.hardCapUSD - totalRaisedUSD;
    uint256 actualUsdValue = usdValue;
    uint256 refundAmount = 0;
    
    // Check if purchase would exceed cap
    if (usdValue > remainingCap) {
        // Partial fill
        actualUsdValue = remainingCap;
        refundAmount = usdValue - remainingCap;
        
        emit PartialPurchase(buyer, usdValue, actualUsdValue, refundAmount);
    }
    
    // Recalculate token amount based on actual USD value
    tokenAmount = _calculateTokenAmount(actualUsdValue);
    
    // Update state with actual amounts
    contributions[buyer] += actualUsdValue;
    totalRaisedUSD += actualUsdValue;
    tokenAllocations[buyer] += tokenAmount;
    totalTokensSold += tokenAmount;
    
    require(totalRaisedUSD <= config.hardCapUSD, "SaleRound: hard cap exceeded");
    
    // Handle refund if necessary
    if (refundAmount > 0) {
        if (paymentToken == address(usdc)) {
            usdc.safeTransfer(buyer, refundAmount);
        } else if (paymentToken == address(usdt)) {
            usdt.safeTransfer(buyer, refundAmount);
        } else if (paymentToken == address(0)) {
            // ETH refund
            (bool success, ) = buyer.call{value: refundAmount}("");
            require(success, "SaleRound: ETH refund failed");
        }
    }
    
    // ... rest of function
}
```

**Fix 3: Add Mutex Lock (Gas Intensive)**

```solidity
bool private _purchaseLock;

modifier purchaseMutex() {
    require(!_purchaseLock, "SaleRound: purchase in progress");
    _purchaseLock = true;
    _;
    _purchaseLock = false;
}

function buyWithUSDC(uint256 usdcAmount, address referrer) 
    external 
    nonReentrant 
    whenNotPaused 
    roundActive 
    purchaseMutex  // ✅ Only one purchase at a time
{
    // ... function body
}
```

**RECOMMENDATION: Use Fix 1 (check after update) as it's simplest and most gas-efficient.**

---

### H-4: NO TOKEN BALANCE VERIFICATION - NOT REQUIRED ACCORDING TO BUSSINESS LOGIC WE WILL BE SENDING TOKENS MANUALLY

**Severity:** 🟠 HIGH  
**Impact:** Later buyers cannot claim tokens if vault runs out  
**Contract:** SaleRound.sol  
**Functions:** `_processPurchase()`, `_processNoKYCPurchase()`

#### Problem Description

SaleRound creates vesting schedules without verifying that sufficient NEBA tokens exist in the VestingVault. If the vault doesn't have enough tokens (due to insufficient funding or previous claims), later users will be unable to claim their purchases.

#### Failure Scenario:

```
Presale sells: 100M NEBA tokens
VestingVault has: 80M NEBA tokens (underfunded by 20%)

Users with first 80M tokens: ✅ Can claim successfully
Users with last 20M tokens: ❌ Cannot claim (insufficient balance)
```

#### Required Fix:

**Add Balance Verification:**

```solidity
function _processPurchase(...) private {
    require(totalRaisedUSD + usdValue <= config.hardCapUSD, "SaleRound: exceeds hard cap");
    
    contributions[buyer] += usdValue;
    tokenAllocations[buyer] += tokenAmount;
    totalRaisedUSD += usdValue;
    totalTokensSold += tokenAmount;
    
    // Handle referral bonus...
    uint256 totalTokensToVest = tokenAmount;
    // ... referral logic ...
    
    // ✅ ADD THIS: Verify VestingVault has sufficient balance
    uint256 vaultBalance = nebaToken.balanceOf(address(vestingVault));
    require(
        vaultBalance >= totalTokensToVest,
        "SaleRound: insufficient vault balance for vesting"
    );
    
    // If using fix from C-1, also verify SaleRound has tokens to transfer:
    uint256 saleRoundBalance = nebaToken.balanceOf(address(this));
    require(
        saleRoundBalance >= totalTokensToVest,
        "SaleRound: insufficient balance for transfer"
    );
    
    // Create vesting and transfer tokens
    vestingVault.createVesting(...);
    nebaToken.safeTransfer(address(vestingVault), totalTokensToVest);
    
    // ... rest of function
}
```

**Add Admin Function to Check Total Commitments:**

```solidity
/**
 * @notice Get total tokens committed vs available
 * @return committed Total tokens sold/committed
 * @return available Total tokens in VestingVault
 * @return deficit Shortage if committed > available
 */
function getTokenCommitment() external view returns (
    uint256 committed,
    uint256 available,
    uint256 deficit
) {
    committed = totalTokensSold;
    available = nebaToken.balanceOf(address(vestingVault));
    deficit = committed > available ? committed - available : 0;
    
    return (committed, available, deficit);
}

/**
 * @notice Emergency function to fund VestingVault if needed
 * @param amount Amount of tokens to add
 */
function fundVestingVault(uint256 amount) external onlyManager {
    require(amount > 0, "SaleRound: zero amount");
    nebaToken.safeTransferFrom(msg.sender, address(vestingVault), amount);
    emit VestingVaultFunded(amount);
}
```

---

## 🟡 MEDIUM SEVERITY ISSUES - FIXED

### M-1: VESTING CLIFF LOGIC ERROR - Multiple Schedules Issue

**Severity:** 🟡 MEDIUM  
**Impact:** Users cannot claim from later schedules if first schedule hasn't reached cliff  
**Contract:** VestingVault.sol  
**Function:** `getClaimableAmount()` (lines 155-172)

#### Problem Description

The function has an early return (`return 0`) if ANY schedule hasn't reached its cliff period. This prevents users from claiming tokens from other schedules that HAVE passed their cliff.

#### Current Buggy Code:

```solidity
function getClaimableAmount(address beneficiary) public view returns (uint256) {
    VestingSchedule[] memory schedules = _vestingSchedules[beneficiary];
    uint256 totalClaimable = 0;

    for (uint256 i = 0; i < schedules.length; i++) {
        VestingSchedule memory schedule = schedules[i];

        // ❌ BUG: Returns 0 for ALL schedules if first one isn't ready
        if (block.timestamp < schedule.cliffEnd) {
            return 0;  // This exits the entire function!
        }

        uint256 vested = _calculateVestedAmount(schedule);
        require(vested <= schedule.totalAmount, "VestingVault: calculation overflow");

        uint256 unclaimed = vested - schedule.claimedAmount;
        totalClaimable += unclaimed;
    }

    return totalClaimable;
}
```

#### Example of Bug:

```
User has 2 vesting schedules:

Schedule 1:
- Cliff End: Dec 31, 2025
- Status: NOT reached cliff yet

Schedule 2:  
- Cliff End: Nov 1, 2025
- Status: PASSED cliff, 50% vested, 1000 tokens claimable

Current behavior:
- User calls getClaimableAmount()
- Loop checks Schedule 1: cliff not reached
- Function returns 0
- User cannot claim 1000 tokens from Schedule 2!

Expected behavior:
- Loop checks Schedule 1: cliff not reached, skip it
- Loop checks Schedule 2: cliff reached, add 1000 to claimable
- Function returns 1000
- User can claim tokens from Schedule 2
```

#### Required Fix:

```solidity
function getClaimableAmount(address beneficiary) public view returns (uint256) {
    VestingSchedule[] memory schedules = _vestingSchedules[beneficiary];
    uint256 totalClaimable = 0;

    for (uint256 i = 0; i < schedules.length; i++) {
        VestingSchedule memory schedule = schedules[i];

        // ✅ FIXED: Skip this schedule but continue checking others
        if (block.timestamp < schedule.cliffEnd) {
            continue;  // Skip to next schedule
        }

        uint256 vested = _calculateVestedAmount(schedule);
        require(vested <= schedule.totalAmount, "VestingVault: calculation overflow");

        uint256 unclaimed = vested - schedule.claimedAmount;
        totalClaimable += unclaimed;
    }

    return totalClaimable;
}
```

**Also Update claimVested() Function:**

The same bug exists in `claimVested()` at line 136. Apply the same fix:

```solidity
function claimVested() external nonReentrant {
    uint256 claimable = getClaimableAmount(msg.sender);
    require(claimable > 0, "VestingVault: nothing to claim");

    require(
        claimable <= token.balanceOf(address(this)),
        "VestingVault: insufficient vault balance"
    );

    VestingSchedule[] storage schedules = _vestingSchedules[msg.sender];

    for (uint256 i = 0; i < schedules.length; i++) {
        VestingSchedule storage schedule = schedules[i];

        // ✅ FIXED: Skip schedules that haven't reached cliff
        if (block.timestamp < schedule.cliffEnd) {
            continue;  // Changed from implicit skip to explicit continue
        }

        uint256 vested = _calculateVestedAmount(schedule);
        uint256 unclaimed = vested - schedule.claimedAmount;

        if (unclaimed > 0) {
            schedule.claimedAmount += unclaimed;
        }
    }

    token.safeTransfer(msg.sender, claimable);

    emit TokensClaimed(msg.sender, claimable);
}
```

---

### M-2: MISSING SALE_ROUND_ROLE IN VESTING VAULT -- NO NEED AS WE ARE GRANTING ROLES IN DEPLOYMENT SCRIPT

**Severity:** 🟡 MEDIUM  
**Impact:** Same as H-1 - VestingVault will reject all vesting creation attempts  
**Contract:** VestingVault.sol

#### Problem Description

Similar to the ReferralSystem issue (H-1), the VestingVault requires `SALE_ROUND_ROLE` for `createVesting()`, but this role is never granted to SaleRound contracts.

#### Evidence:

```solidity
// VestingVault.sol - Line 46
modifier onlyAuthorized() {
    require(
        msg.sender == saleManager || hasRole(SALE_ROUND_ROLE, msg.sender),
        "VestingVault: not authorized"
    );
    _;
}

// Line 82
function createVesting(...) external onlyAuthorized {
    // This will always revert if SaleRound doesn't have SALE_ROUND_ROLE
}
```

#### Required Fix:

**Option 1: Grant role during initialization (RECOMMENDED)**

```solidity
// Modify initialize() function:
function initialize(address _saleManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(!_initialized, "VestingVault: already initialized");
    require(_saleManager != address(0), "VestingVault: zero manager address");
    
    saleManager = _saleManager;
    _initialized = true;
    
    // ✅ Grant SALE_ROUND_ROLE instead of DEFAULT_ADMIN_ROLE
    _grantRole(SALE_ROUND_ROLE, _saleManager);
    
    emit SaleRoundAuthorized(_saleManager);
}
```

**Option 2: Add authorization function**

```solidity
/**
 * @notice Authorize a SaleRound contract
 * @param saleRound Address of the SaleRound contract
 */
function authorizeSaleRound(address saleRound) 
    external 
    onlyRole(DEFAULT_ADMIN_ROLE) 
{
    require(saleRound != address(0), "VestingVault: zero address");
    _grantRole(SALE_ROUND_ROLE, saleRound);
    emit SaleRoundAuthorized(saleRound);
}
```

**Update deployment script:**

```javascript
// After deploying VestingVault and SaleRound:
await vestingVault.initialize(saleManager.address);
await vestingVault.authorizeSaleRound(saleRound.address);

// Verify
const hasRole = await vestingVault.hasRole(
    await vestingVault.SALE_ROUND_ROLE(),
    saleRound.address
);
console.log("SaleRound has SALE_ROUND_ROLE in VestingVault:", hasRole);
```

---

### M-3: NO PAUSE MECHANISM IN VESTING VAULT - FIXED added pause mechanism in VestingVault.sol

**Severity:** 🟡 MEDIUM  
**Impact:** Cannot stop token claims in emergency  
**Contract:** VestingVault.sol

#### Problem Description

VestingVault lacks a pause mechanism. If a critical bug is discovered, there's no way to prevent users from claiming tokens while the issue is being resolved.

#### Required Fix:

```solidity
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract VestingVault is ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;
    
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    constructor(address _token) {
        require(_token != address(0), "VestingVault: zero token address");
        token = IERC20(_token);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);  // ✅ Add pauser role
    }
    
    /**
     * @notice Pause the contract (emergency only)
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Claim all vested tokens for the caller
     */
    function claimVested() external nonReentrant whenNotPaused {  // ✅ Add whenNotPaused
        uint256 claimable = getClaimableAmount(msg.sender);
        require(claimable > 0, "VestingVault: nothing to claim");
        // ... rest of function
    }
}
```

---

### M-4: FUNDS VAULT SINGLE POINT OF FAILURE - FIXED ADDED SECONDARY MULTISIG

**Severity:** 🟡 MEDIUM  
**Impact:** All funds locked if multisig compromised or keys lost  
**Contract:** FundsVault.sol

#### Problem Description

Only the single multisig address can withdraw funds. If the multisig keys are lost, compromised, or owners cannot coordinate, all presale funds are permanently locked or stolen.

#### Required Fixes:

**Fix 1: Add Secondary Backup Multisig**

```solidity
address public immutable primaryMultisig;
address public secondaryMultisig;
uint256 public constant SECONDARY_DELAY = 7 days;
uint256 public secondaryMultisigActiveTime;

constructor(address _primaryMultisig, address _secondaryMultisig) {
    require(_primaryMultisig != address(0), "FundsVault: zero primary address");
    require(_secondaryMultisig != address(0), "FundsVault: zero secondary address");
    primaryMultisig = _primaryMultisig;
    secondaryMultisig = _secondaryMultisig;
}

modifier onlyMultisig() {
    require(
        msg.sender == primaryMultisig || 
        (msg.sender == secondaryMultisig && block.timestamp >= secondaryMultisigActiveTime),
        "FundsVault: not authorized"
    );
    _;
}

/**
 * @notice Activate secondary multisig (emergency recovery)
 */
function activateSecondaryMultisig() external {
    require(msg.sender == primaryMultisig, "FundsVault: only primary");
    secondaryMultisigActiveTime = block.timestamp + SECONDARY_DELAY;
    emit SecondaryMultisigActivated(block.timestamp + SECONDARY_DELAY);
}
```

**Fix 2: Add Timelock for Large Withdrawals**

```solidity
struct PendingWithdrawal {
    address token; // address(0) for ETH
    address to;
    uint256 amount;
    uint256 executeAfter;
    bool executed;
}

mapping(bytes32 => PendingWithdrawal) public pendingWithdrawals;
uint256 public constant LARGE_WITHDRAWAL_THRESHOLD = 100000e6; // $100k
uint256 public constant WITHDRAWAL_DELAY = 2 days;

function scheduleWithdrawal(
    address token,
    address to,
    uint256 amount
) external onlyMultisig returns (bytes32 withdrawalId) {
    require(amount >= LARGE_WITHDRAWAL_THRESHOLD, "FundsVault: use immediate withdrawal");
    
    withdrawalId = keccak256(abi.encodePacked(token, to, amount, block.timestamp));
    
    pendingWithdrawals[withdrawalId] = PendingWithdrawal({
        token: token,
        to: to,
        amount: amount,
        executeAfter: block.timestamp + WITHDRAWAL_DELAY,
        executed: false
    });
    
    emit WithdrawalScheduled(withdrawalId, token, to, amount);
    return withdrawalId;
}

function executeWithdrawal(bytes32 withdrawalId) external onlyMultisig nonReentrant {
    PendingWithdrawal storage withdrawal = pendingWithdrawals[withdrawalId];
    
    require(!withdrawal.executed, "FundsVault: already executed");
    require(block.timestamp >= withdrawal.executeAfter, "FundsVault: timelock active");
    
    withdrawal.executed = true;
    
    if (withdrawal.token == address(0)) {
        // ETH withdrawal
        (bool success, ) = withdrawal.to.call{value: withdrawal.amount}("");
        require(success, "FundsVault: ETH transfer failed");
        emit ETHWithdrawn(withdrawal.to, withdrawal.amount);
    } else {
        // Token withdrawal
        IERC20(withdrawal.token).safeTransfer(withdrawal.to, withdrawal.amount);
        emit TokenWithdrawn(withdrawal.token, withdrawal.to, withdrawal.amount);
    }
}
```

---

### M-5: REFERRAL SYSTEM UNBOUNDED ARRAY - NOT REQUIRED Its a mapping of address and we will get data in o(1) and there is no iteration over the array

**Severity:** 🟡 MEDIUM  
**Impact:** Gas limit issues for users with many referrals  
**Contract:** ReferralSystem.sol  
**Storage:** `referredUsers[referrer]`

#### Problem Description

The `referredUsers` mapping stores an unbounded array of addresses. A user with thousands of referrals could hit gas limits when iterating over the array.

#### Required Fix:

**Add Pagination:**

```solidity
/**
 * @notice Get paginated list of referred users
 * @param referrer Address to check
 * @param offset Starting index
 * @param limit Number of results to return
 * @return users Array of referred users
 * @return total Total number of referred users
 */
function getReferredUsersPaginated(
    address referrer,
    uint256 offset,
    uint256 limit
) external view returns (address[] memory users, uint256 total) {
    address[] storage allUsers = referredUsers[referrer];
    total = allUsers.length;
    
    if (offset >= total) {
        return (new address[](0), total);
    }
    
    uint256 end = offset + limit;
    if (end > total) {
        end = total;
    }
    
    uint256 resultLength = end - offset;
    users = new address[](resultLength);
    
    for (uint256 i = 0; i < resultLength; i++) {
        users[i] = allUsers[offset + i];
    }
    
    return (users, total);
}

/**
 * @notice Get total referral count (more efficient than returning full array)
 * @param referrer Address to check
 * @return uint256 Number of users referred
 */
function getReferralCount(address referrer) external view returns (uint256) {
    return referredUsers[referrer].length;
}
```

---

## 🟢 LOW SEVERITY & INFORMATIONAL

### L-1: Missing Zero Amount Checks - FIXED ADDED ZERO AMOUNT CHECKS IN SALEROUND.SOL

**Contract:** SaleRound.sol

```solidity
function buyWithUSDC(uint256 usdcAmount, address referrer) external {
    require(usdcAmount > 0, "SaleRound: zero amount");  // ✅ Add this
    // ...
}

function buyWithUSDT(uint256 usdtAmount, address referrer) external {
    require(usdtAmount > 0, "SaleRound: zero amount");  // ✅ Add this
    // ...
}
```

---

### L-2: FundsVault receive() Reverts - NO NEED AS WE ARE NOT ACCEPTING ETH BY SIMPLE TRANSFER WE HAVE DEPOSITETH FUNCTION

**Contract:** FundsVault.sol

**Current:**
```solidity
receive() external payable {
    revert("FundsVault: use depositETH");
}
```

**Better approach:**
```solidity
receive() external payable {
    emit ETHReceived(msg.sender, msg.value);
}
```

---

### L-3: Missing Events

Add initialization events:
```solidity
event VestingVaultInitialized(address indexed saleManager);
event ContractInitialized(address indexed initializer);
```

---

### L-4: Duplicate Code in SaleRound - IT IS NOT IMPORTANT AS WE HAVE IMPLEMENTED IT ALREADY IN FRONTEND

Functions `_processPurchase()` and `_processNoKYCPurchase()` have ~90% identical code. Refactor:

```solidity
function _processPurchaseInternal(
    address buyer,
    address paymentToken,
    uint256 paymentAmount,
    uint256 usdValue,
    uint256 tokenAmount,
    address referrer,
    bool isNoKYC
) private {
    // Shared logic
}

function _processPurchase(...) private {
    _processPurchaseInternal(..., false);
}

function _processNoKYCPurchase(...) private {
    _processPurchaseInternal(..., true);
}
```

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### Critical Fixes (MUST FIX):
- [ ] **C-1:** Add token transfers to VestingVault in all purchase functions
- [ ] **C-2:** Implement oracle circuit breaker and validation
- [ ] **H-1:** Grant SALE_ROUND_ROLE to SaleRound in ReferralSystem
- [ ] **H-2:** Remove DEFAULT_ADMIN_ROLE from SaleManager in VestingVault
- [ ] **H-3:** Fix hard cap race condition
- [ ] **H-4:** Add token balance verification
- [ ] **M-1:** Fix cliff logic in getClaimableAmount()
- [ ] **M-2:** Grant SALE_ROUND_ROLE to SaleRound in VestingVault

### Recommended Fixes:
- [ ] **M-3:** Add pause mechanism to VestingVault
- [ ] **M-4:** Add backup multisig to FundsVault
- [ ] **M-5:** Add pagination to referral system
- [ ] **L-1:** Add zero amount checks
- [ ] **L-2:** Fix receive() function in FundsVault
- [ ] **L-3:** Add missing events
- [ ] **L-4:** Refactor duplicate code

### Testing Requirements:
- [ ] Unit tests for all fixed functions
- [ ] Integration tests for cross-contract interactions
- [ ] Stress tests for edge cases (hard cap, multiple schedules, etc.)
- [ ] Gas optimization tests
- [ ] Testnet deployment and verification
- [ ] External security audit

### Deployment Sequence:
1. [ ] Deploy all contracts on testnet
2. [ ] Initialize VestingVault
3. [ ] Grant all necessary roles
4. [ ] Fund contracts with test tokens
5. [ ] Run full integration test suite
6. [ ] Verify all role assignments
7. [ ] Test emergency pause mechanisms
8. [ ] Conduct external audit
9. [ ] Deploy to mainnet
10. [ ] Transfer ownership to multisig

---

## 🔍 MISSING CONTRACT ANALYSIS

**Note:** The audit references an `IRateLimiter` interface but the actual `RateLimiter.sol` contract was not provided. Please provide this contract for complete audit coverage, as it handles:
- Daily purchase limits for no-KYC mode
- Rate limiting logic
- Anti-bot protection

The missing contract may contain additional vulnerabilities.

---

## 📞 NEXT STEPS

1. **Fix all Critical and High severity issues immediately**
2. **Provide RateLimiter.sol contract for review**
3. **Implement comprehensive test suite covering all fixes**
4. **Deploy to testnet and conduct thorough testing**
5. **Schedule follow-up review after fixes are implemented**
6. **Engage professional audit firm before mainnet deployment**

---

**Audit Conducted By:** Security Auditor  
**Date:** October 24, 2025  
**Contact:** Available for clarifications on any findings

**DISCLAIMER:** This audit does not guarantee the absence of vulnerabilities. A professional third-party audit is strongly recommended before mainnet deployment.