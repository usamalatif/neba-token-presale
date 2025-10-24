// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRateLimiter {
    // Original functions
    function checkAndUpdateLimit(address account, uint256 usdAmount) external;
    function resetLimit(address account) external;
    function getRateLimitInfo(address account) external view returns (
        uint256 lastTxTime,
        uint256 txCount,
        uint256 periodStart,
        uint256 dailySpentUSD,
        uint256 dailyPeriodStart,
        uint256 totalVolume
    );
    
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
    
    // No-KYC specific purchase bounds
    function NO_KYC_MIN_PURCHASE_USD() external view returns (uint256);
    function NO_KYC_MAX_PURCHASE_USD() external view returns (uint256);
    
    // Events
    event NoKYCEnabled();
    event NoKYCDisabled();
    event DailyCapUpdated(uint256 newCap);
    event PurchaseBlockedByCap(address indexed account, uint256 attemptedAmount, uint256 currentSpent, uint256 dailyCap);
}

