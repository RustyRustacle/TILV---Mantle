// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract IdentityRegistry is ERC721, Ownable {
    uint256 private _nextTokenId;
    mapping(uint256 => string) private _agentURIs;
    mapping(uint256 => address) private _agentSigners;
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    event AgentRegistered(uint256 indexed agentId, string agentURI, address indexed owner);
    event AgentURIUpdated(uint256 indexed agentId, string newURI);
    event AgentSignerUpdated(uint256 indexed agentId, address indexed newSigner);
    event MetadataSet(uint256 indexed agentId, string key, bytes value);

    constructor() ERC721("TILV Agent Identity", "TAI") Ownable() {}

    function register(string calldata uri) external returns (uint256 agentId) {
        agentId = _nextTokenId;
        _nextTokenId++;
        _mint(msg.sender, agentId);
        _agentURIs[agentId] = uri;
        emit AgentRegistered(agentId, uri, msg.sender);
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(_isApprovedOrOwner(msg.sender, agentId), "IR: not owner or approved");
        _agentURIs[agentId] = newURI;
        emit AgentURIUpdated(agentId, newURI);
    }

    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata /* signature */) external {
        require(_isApprovedOrOwner(msg.sender, agentId), "IR: not owner or approved");
        require(block.timestamp <= deadline, "IR: signature expired");
        _agentSigners[agentId] = newWallet;
        emit AgentSignerUpdated(agentId, newWallet);
    }

    function getMetadata(uint256 agentId, string memory key) external view returns (bytes memory) {
        require(_ownerOf(agentId) != address(0), "IR: nonexistent agent");
        return _metadata[agentId][key];
    }

    function setMetadata(uint256 agentId, string memory key, bytes memory value) external {
        require(_isApprovedOrOwner(msg.sender, agentId), "IR: not owner or approved");
        _metadata[agentId][key] = value;
        emit MetadataSet(agentId, key, value);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "IR: nonexistent token");
        return _agentURIs[tokenId];
    }

    function agentSigner(uint256 agentId) external view returns (address) {
        require(_ownerOf(agentId) != address(0), "IR: nonexistent agent");
        return _agentSigners[agentId];
    }

    function agentURI(uint256 agentId) external view returns (string memory) {
        require(_ownerOf(agentId) != address(0), "IR: nonexistent agent");
        return _agentURIs[agentId];
    }
}
