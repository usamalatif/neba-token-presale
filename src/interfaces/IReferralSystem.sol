// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IReferralSystem {
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
    function getReferralCount(address referrer) external view returns (uint256);
    
    // Access control
    function REFERRAL_ADMIN_ROLE() external view returns (bytes32);
    function SALE_ROUND_ROLE() external view returns (bytes32);
    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);
    function hasRole(bytes32 role, address account) external view returns (bool);
    function grantRole(bytes32 role, address account) external;
    function revokeRole(bytes32 role, address account) external;
    
    // State variables
    function referrerBonusBps() external view returns (uint256);
    function refereeBonusBps() external view returns (uint256);
    function totalReferrals() external view returns (uint256);
    function totalBonusDistributed() external view returns (uint256);
    
    // Referral data struct
    struct ReferralData {
        address referrer;
        uint256 totalReferred;
        uint256 totalBonusEarned;
        bool hasReferred;
    }
    
    // Events
    event ReferralRegistered(address indexed referee, address indexed referrer);
    event ReferralBonusCalculated(
        address indexed referee,
        address indexed referrer,
        uint256 purchaseAmount,
        uint256 referrerBonus,
        uint256 refereeBonus
    );
    event BonusPercentagesUpdated(uint256 referrerBps, uint256 refereeBps);
}
