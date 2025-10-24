// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVestingVault {
    // Vesting management
    function createVesting(
        address beneficiary,
        uint256 amount,
        uint256 cliffDuration,
        uint256 vestingDuration,
        uint256 startTime
    ) external;
    
    function claimVested() external;
    
    // View functions
    function getVestedAmount(address beneficiary) external view returns (uint256);
    function getClaimableAmount(address beneficiary) external view returns (uint256);
    function getVestingScheduleCount(address beneficiary) external view returns (uint256);
    function getVestingSchedule(address beneficiary, uint256 index) external view returns (VestingSchedule memory);
    
    // Initialization
    function initialize(address _saleManager) external;
    
    // State variables
    function token() external view returns (address);
    function saleManager() external view returns (address);
    function SALE_ROUND_ROLE() external view returns (bytes32);
    
    // Vesting schedule struct
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 startTime;
        uint256 cliffEnd;
        uint256 vestingEnd;
    }
    
    // Events
    event VestingCreated(
        address indexed beneficiary,
        uint256 indexed scheduleId,
        uint256 amount,
        uint256 cliffEnd,
        uint256 vestingEnd
    );
    event TokensClaimed(address indexed beneficiary, uint256 amount);
    event SaleRoundAuthorized(address indexed saleRound);
}

