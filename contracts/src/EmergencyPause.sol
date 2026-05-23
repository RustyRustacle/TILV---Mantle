// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract EmergencyPause is Pausable, AccessControl {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UNPAUSER_ROLE = keccak256("UNPAUSER_ROLE");
    bytes32 public constant EMERGENCY_ADMIN_ROLE = keccak256("EMERGENCY_ADMIN_ROLE");

    event EmergencyShutdownInitiated(address indexed triggeredBy, string reason);
    event GracefulShutdownComplete(address indexed triggeredBy);

    bool public isShutdownMode = false;
    uint256 public shutdownTimestamp;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(UNPAUSER_ROLE, msg.sender);
        _grantRole(EMERGENCY_ADMIN_ROLE, msg.sender);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(UNPAUSER_ROLE) {
        require(!isShutdownMode, "Cannot unpause after shutdown");
        _unpause();
    }

    function triggerEmergencyShutdown(string calldata reason) external onlyRole(EMERGENCY_ADMIN_ROLE) {
        isShutdownMode = true;
        shutdownTimestamp = block.timestamp;
        _pause();
        emit EmergencyShutdownInitiated(msg.sender, reason);
    }

    function initiateGracefulShutdown() external onlyRole(EMERGENCY_ADMIN_ROLE) {
        isShutdownMode = true;
        shutdownTimestamp = block.timestamp;
        emit GracefulShutdownComplete(msg.sender);
    }

    modifier whenNotShutdown() {
        require(!isShutdownMode, "Protocol is in shutdown mode");
        _;
    }
}