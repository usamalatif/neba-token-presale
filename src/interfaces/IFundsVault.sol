// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFundsVault {
    // Deposit functions
    function depositETH() external payable;
    function depositToken(address token, uint256 amount) external;
    
    // Withdrawal functions
    function withdrawETH(address to, uint256 amount) external;
    function withdrawToken(address token, address to, uint256 amount) external;
    
    // Authorization functions
    function authorizeDepositor(address depositor) external;
    function revokeDepositor(address depositor) external;
    
    // View functions
    function getETHBalance() external view returns (uint256);
    function getTokenBalance(address token) external view returns (uint256);
    function authorizedDepositors(address depositor) external view returns (bool);
    function multisig() external view returns (address);
    
    // Events
    event ETHDeposited(address indexed from, uint256 amount);
    event TokenDeposited(address indexed token, address indexed from, uint256 amount);
    event ETHWithdrawn(address indexed to, uint256 amount);
    event TokenWithdrawn(address indexed token, address indexed to, uint256 amount);
    event DepositorAuthorized(address indexed depositor);
    event DepositorRevoked(address indexed depositor);
}

