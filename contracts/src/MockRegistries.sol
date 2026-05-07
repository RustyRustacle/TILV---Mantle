// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockIdentityRegistry {
    uint256 private _nextId;

    function register(string calldata) external returns (uint256) {
        uint256 id = _nextId;
        _nextId++;
        return id;
    }

    function setAgentURI(uint256, string calldata) external {}
    function setAgentWallet(uint256, address, uint256, bytes calldata) external {}
    function getMetadata(uint256, string memory) external view returns (bytes memory) { return ""; }
    function setMetadata(uint256, string memory, bytes memory) external {}
}

contract MockReputationRegistry {
    function giveFeedback(
        uint256, int128, uint8, string calldata, string calldata,
        string calldata, string calldata, bytes32
    ) external {}

    function getSummary(
        uint256, address[] calldata, string memory, string memory
    ) external view returns (uint64, int128, uint8) { return (0, 0, 0); }
}

contract MockValidationRegistry {
    mapping(bytes32 => uint8) public responses;

    function setResponse(bytes32 requestHash, uint8 response) external {
        responses[requestHash] = response;
    }

    function validationRequest(address, uint256, string calldata, bytes32) external {}
    function validationResponse(bytes32, uint8, string calldata, bytes32, string calldata) external {}

    function getValidationStatus(bytes32 requestHash)
        external view
        returns (address, uint256, uint8, bytes32, string memory, uint256)
    {
        uint8 resp = responses[requestHash];
        return (address(0), 0, resp, bytes32(0), "", resp > 0 ? block.timestamp : 0);
    }
}
