// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISaleManager {
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
    
    // Configuration
    function updateTimelockDelay(uint256 newDelay) external;
    
    // State variables
    function nebaToken() external view returns (address);
    function kycRegistry() external view returns (address);
    function rateLimiter() external view returns (address);
    function vestingVault() external view returns (address);
    function fundsVault() external view returns (address);
    function usdc() external view returns (address);
    function usdt() external view returns (address);
    function ethUSDOracle() external view returns (address);
    function referralSystem() external view returns (address);
    function timelockDelay() external view returns (uint256);
    function paused() external view returns (bool);
    
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
    
    // Timelock operation struct
    struct TimelockOperation {
        bytes32 operationId;
        address target;
        bytes data;
        uint256 executeTime;
        bool executed;
    }
    
    // Events
    event RoundCreated(address indexed roundAddress, uint256 indexed roundId, string name);
    event OperationScheduled(bytes32 indexed operationId, address indexed target, uint256 executeTime);
    event OperationExecuted(bytes32 indexed operationId);
    event OperationCancelled(bytes32 indexed operationId);
    event TimelockDelayUpdated(uint256 newDelay);
    event EmergencyPause(address indexed caller, uint256 timestamp);
    event Unpause(address indexed caller, uint256 timestamp);
}
