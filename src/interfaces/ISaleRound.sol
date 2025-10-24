// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISaleRound {
    // Original purchase functions
    function buyWithUSDC(uint256 usdcAmount, address referrer) external;
    function buyWithUSDT(uint256 usdtAmount, address referrer) external;
    function buyWithETH(address referrer) external payable;
    
    // No-KYC fallback purchase functions
    function buyWithUSDCNoKYC(uint256 usdcAmount, address referrer) external;
    function buyWithUSDTNoKYC(uint256 usdtAmount, address referrer) external;
    function buyWithETHNoKYC(address referrer) external payable;
    
    // Configuration functions
    function updateConfig(RoundConfig memory _config) external;
    function updateOracle(address _oracle) external;
    function pause() external;
    function unpause() external;
    
    // View functions
    function getRoundInfo() external view returns (RoundConfig memory);
    function getUserInfo(address user) external view returns (
        uint256 contribution,
        uint256 allocation,
        uint256 bonus
    );
    function getReferralInfo(address user) external view returns (
        address referrer,
        bool hasReferrer
    );
    
    // No-KYC specific view functions
    function getRemainingDailyAllowance(address user) external view returns (uint256);
    function isNoKYCEnabled() external view returns (bool);
    
    // Round configuration struct
    struct RoundConfig {
        string name;
        uint256 tokenPriceUSD;
        uint256 hardCapUSD;
        uint256 startTime;
        uint256 endTime;
        uint256 cliffDuration;
        uint256 vestingDuration;
        bool isActive;
    }
    
    // Events
    event Purchase(
        address indexed buyer,
        address indexed paymentToken,
        uint256 paymentAmount,
        uint256 usdValue,
        uint256 tokenAmount
    );
    event NoKYCPurchase(
        address indexed buyer,
        address indexed paymentToken,
        uint256 paymentAmount,
        uint256 usdValue,
        uint256 tokenAmount,
        uint256 remainingDailyAllowance
    );
    event ReferralBonusDistributed(
        address indexed referee,
        address indexed referrer,
        uint256 referrerBonus,
        uint256 refereeBonus
    );
    event ConfigUpdated(RoundConfig config);
    event OracleUpdated(address indexed oracle);
    event DailyCapExceeded(
        address indexed buyer,
        uint256 attemptedAmount,
        uint256 currentSpent,
        uint256 dailyCap
    );
}
