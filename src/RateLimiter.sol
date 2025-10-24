// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title RateLimiter
 * @notice Implements rate limiting to prevent bot activities
 * @dev Tracks transaction count and timing per address
 */
contract RateLimiter is AccessControl {
    bytes32 public constant RATE_ADMIN_ROLE = keccak256("RATE_ADMIN_ROLE");
    bytes32 public constant SALE_ROUND_ROLE = keccak256("SALE_ROUND_ROLE");
    
    struct RateLimit {
        uint256 lastTransactionTime;
        uint256 transactionCount;
        uint256 periodStart;
        uint256 dailySpentUSD; // Daily spending in USD (6 decimals)
        uint256 dailyPeriodStart; // Start of daily spending period
        uint256 totalVolume; // Track volume per period
    }
    
    mapping(address => RateLimit) private _limits;
    
    // Configurable parameters
    uint256 public minTimeBetweenTx = 60; // 1 minute (not 30 seconds)
    uint256 public maxTxPerPeriod = 5; // 5 transactions (not 10)
    uint256 public period = 24 hours;

    // Add per-transaction amount limits
    uint256 public minPurchaseAmount = 100e6; // $100 minimum in USDC decimals
    uint256 public maxPurchaseAmount = 50000e6; // $50,000 maximum in USDC decimals
    
    // No-KYC fallback mode parameters
    bool public noKYCEnabled = false;
    uint256 public dailyCapUSD = 499e6; // $499 daily cap in USD (6 decimals)
    uint256 public constant DAILY_WINDOW = 24 hours;
    
    // No-KYC specific purchase bounds
    uint256 public constant NO_KYC_MIN_PURCHASE_USD = 25e6; // $25 minimum for no-KYC
    uint256 public constant NO_KYC_MAX_PURCHASE_USD = 499e6; // $499 maximum for no-KYC
    
    event RateLimitExceeded(address indexed account, string reason);
    event RateLimitUpdated(uint256 minTimeBetweenTx, uint256 maxTxPerPeriod, uint256 period);
    event RateLimitCheck(address indexed user, uint256 amountUSD, uint256 txCount);
    event LimitReset(address indexed account);
    event NoKYCEnabled();
    event NoKYCDisabled();
    event DailyCapUpdated(uint256 newCap);
    event PurchaseBlockedByCap(address indexed account, uint256 attemptedAmount, uint256 currentSpent, uint256 dailyCap);
    
    /**
     * @dev Constructor sets up initial roles
     * @param admin Address that will have admin roles
     */
    constructor(address admin) {
        require(admin != address(0), "RateLimiter: zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RATE_ADMIN_ROLE, admin);
    }
    
    /**
     * @notice Check rate limit and update if passed
     * @param account Address to check
     * @param usdAmount USD amount being spent (6 decimals)
     * @dev Reverts if rate limit is exceeded
     */
    function checkAndUpdateLimit(address account, uint256 usdAmount) external onlyRole(SALE_ROUND_ROLE) {
        RateLimit storage limit = _limits[account];
        uint256 currentTime = block.timestamp;

        // Check time between transactions
        require(
            currentTime >= limit.lastTransactionTime + minTimeBetweenTx,
            "RateLimiter: transaction too frequent"
        );

        // Check amount limits
        require(
            usdAmount >= minPurchaseAmount && usdAmount <= maxPurchaseAmount,
            "RateLimiter: amount out of bounds"
        );

        // Reset period if needed
        if (currentTime >= limit.periodStart + period) {
            limit.periodStart = currentTime;
            limit.transactionCount = 0;
            limit.totalVolume = 0;
        }

        // Check transaction count
        require(limit.transactionCount < maxTxPerPeriod, "RateLimiter: too many transactions");

        // Update activity
        limit.lastTransactionTime = currentTime;
        limit.transactionCount++;
        limit.totalVolume += usdAmount;

        emit RateLimitCheck(account, usdAmount, limit.transactionCount);
    }
    
    /**
     * @notice Check daily cap for no-KYC fallback mode
     * @param account Address to check
     * @param usdAmount USD amount being spent (6 decimals)
     * @dev Reverts if daily cap would be exceeded
     */
    function checkDailyCap(address account, uint256 usdAmount) external onlyRole(SALE_ROUND_ROLE) {
        require(noKYCEnabled, "RateLimiter: no-KYC mode not enabled");
        
        // Check no-KYC specific purchase bounds
        require(
            usdAmount >= NO_KYC_MIN_PURCHASE_USD,
            "RateLimiter: NO_KYC_MIN_PURCHASE_USD"
        );
        require(
            usdAmount <= NO_KYC_MAX_PURCHASE_USD,
            "RateLimiter: NO_KYC_MAX_PURCHASE_USD"
        );
        
        RateLimit storage limit = _limits[account];
        uint256 currentTime = block.timestamp;
        
        // Reset daily spending if 24 hours have passed
        if (currentTime >= limit.dailyPeriodStart + DAILY_WINDOW) {
            limit.dailySpentUSD = 0;
            limit.dailyPeriodStart = currentTime;
        }
        
        // Check if this purchase would exceed daily cap
        require(
            limit.dailySpentUSD + usdAmount <= dailyCapUSD,
            "RateLimiter: daily cap exceeded"
        );
        
        // Update daily spending
        limit.dailySpentUSD += usdAmount;
        
        emit RateLimitCheck(account, usdAmount, limit.transactionCount);
    }
    
    /**
     * @notice Reset rate limit for an address
     * @param account Address to reset
     */
    function resetLimit(address account) external onlyRole(RATE_ADMIN_ROLE) {
        delete _limits[account];
        emit LimitReset(account);
    }
    
    /**
     * @notice Update rate limit parameters
     * @param _minTimeBetweenTx New minimum time between transactions
     * @param _maxTxPerPeriod New maximum transactions per period
     * @param _period New period duration
     */
    function updateRateLimitConfig(
        uint256 _minTimeBetweenTx,
        uint256 _maxTxPerPeriod,
        uint256 _period
    ) external onlyRole(RATE_ADMIN_ROLE) {
        require(_minTimeBetweenTx > 0, "RateLimiter: invalid min time");
        require(_maxTxPerPeriod > 0, "RateLimiter: invalid max tx");
        require(_period > 0, "RateLimiter: invalid period");
        
        minTimeBetweenTx = _minTimeBetweenTx;
        maxTxPerPeriod = _maxTxPerPeriod;
        period = _period;
        
        emit RateLimitUpdated(_minTimeBetweenTx, _maxTxPerPeriod, _period);
    }
    
    /**
     * @notice Enable no-KYC fallback mode
     * @dev Only callable by admin or through Safe
     */
    function enableNoKYCMode() external onlyRole(RATE_ADMIN_ROLE) {
        require(!noKYCEnabled, "RateLimiter: no-KYC already enabled");
        noKYCEnabled = true;
        emit NoKYCEnabled();
    }
    
    /**
     * @notice Disable no-KYC fallback mode
     * @dev Only callable by admin or through Safe
     */
    function disableNoKYCMode() external onlyRole(RATE_ADMIN_ROLE) {
        require(noKYCEnabled, "RateLimiter: no-KYC not enabled");
        noKYCEnabled = false;
        emit NoKYCDisabled();
    }
    
    /**
     * @notice Update daily cap for no-KYC mode
     * @param _dailyCapUSD New daily cap in USD (6 decimals)
     */
    function updateDailyCap(uint256 _dailyCapUSD) external onlyRole(RATE_ADMIN_ROLE) {
        require(_dailyCapUSD > 0, "RateLimiter: invalid daily cap");
        require(_dailyCapUSD <= 1000e6, "RateLimiter: daily cap too high"); // Max $1000
        
        dailyCapUSD = _dailyCapUSD;
        emit DailyCapUpdated(_dailyCapUSD);
    }
    
    /**
     * @notice Get rate limit info for an address
     * @param account Address to query
     * @return lastTxTime Last transaction timestamp
     * @return txCount Transaction count in current period
     * @return periodStart Start of current period
     * @return dailySpentUSD Daily spending in USD (6 decimals)
     * @return dailyPeriodStart Start of daily spending period
     * @return totalVolume Total volume in current period
     */
    function getRateLimitInfo(address account) external view returns (
        uint256 lastTxTime,
        uint256 txCount,
        uint256 periodStart,
        uint256 dailySpentUSD,
        uint256 dailyPeriodStart,
        uint256 totalVolume
    ) {
        RateLimit memory limit = _limits[account];
        return (
            limit.lastTransactionTime,
            limit.transactionCount,
            limit.periodStart,
            limit.dailySpentUSD,
            limit.dailyPeriodStart,
            limit.totalVolume
        );
    }
    
    /**
     * @notice Get remaining daily allowance for an address
     * @param account Address to query
     * @return remainingUSD Remaining daily allowance in USD (6 decimals)
     */
    function getRemainingDailyAllowance(address account) external view returns (uint256 remainingUSD) {
        RateLimit memory limit = _limits[account];
        uint256 currentTime = block.timestamp;
        
        // If 24 hours have passed, reset to full allowance
        if (currentTime >= limit.dailyPeriodStart + DAILY_WINDOW) {
            return dailyCapUSD;
        }
        
        // Calculate remaining allowance
        if (limit.dailySpentUSD >= dailyCapUSD) {
            return 0;
        }
        
        return dailyCapUSD - limit.dailySpentUSD;
    }


}

