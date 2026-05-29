// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ValidationRegistry is Ownable {
    mapping(address => bool) public authorizedRequesters;

    struct ValidationRequest {
        address validatorAddress;
        uint256 agentId;
        string  requestURI;
        bytes32 requestHash;
        uint256 submittedAt;
    }

    struct ValidationResponse {
        uint8   response;
        string  responseURI;
        bytes32 responseHash;
        string  tag;
        uint256 respondedAt;
    }

    mapping(bytes32 => ValidationRequest) private _requests;
    mapping(bytes32 => ValidationResponse) private _responses;
    mapping(bytes32 => bool) private _hasResponse;

    event ValidationRequested(
        address indexed validatorAddress,
        uint256 indexed agentId,
        bytes32 indexed requestHash,
        string  requestURI
    );

    event ValidationResponded(
        address indexed validatorAddress,
        uint256 indexed agentId,
        bytes32 indexed requestHash,
        uint8   response,
        string  responseURI,
        bytes32 responseHash,
        string  tag
    );

    error NotValidator(address sender, address expected);
    error NoResponse(bytes32 requestHash);
    error AlreadyResponded(bytes32 requestHash);

    constructor() Ownable() {
        authorizedRequesters[msg.sender] = true;
    }

    function authorizeRequester(address requester) external onlyOwner {
        require(requester != address(0), "VR: zero address");
        authorizedRequesters[requester] = true;
    }

    function revokeRequester(address requester) external onlyOwner {
        authorizedRequesters[requester] = false;
    }

    modifier onlyValidator(bytes32 requestHash) {
        if (msg.sender != _requests[requestHash].validatorAddress) {
            revert NotValidator(msg.sender, _requests[requestHash].validatorAddress);
        }
        _;
    }

    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string  calldata requestURI,
        bytes32 requestHash
    ) external {
        require(authorizedRequesters[msg.sender], "VR: not authorized");
        _requests[requestHash] = ValidationRequest({
            validatorAddress: validatorAddress,
            agentId: agentId,
            requestURI: requestURI,
            requestHash: requestHash,
            submittedAt: block.timestamp
        });

        emit ValidationRequested(validatorAddress, agentId, requestHash, requestURI);
    }

    function validationResponse(
        bytes32 requestHash,
        uint8   response,
        string  calldata responseURI,
        bytes32 responseHash,
        string  calldata tag
    ) external onlyValidator(requestHash) {
        if (_hasResponse[requestHash]) {
            revert AlreadyResponded(requestHash);
        }

        _responses[requestHash] = ValidationResponse({
            response: response,
            responseURI: responseURI,
            responseHash: responseHash,
            tag: tag,
            respondedAt: block.timestamp
        });
        _hasResponse[requestHash] = true;

        emit ValidationResponded(
            _requests[requestHash].validatorAddress,
            _requests[requestHash].agentId,
            requestHash,
            response,
            responseURI,
            responseHash,
            tag
        );
    }

    function getValidationStatus(bytes32 requestHash)
        external view
        returns (
            address validatorAddress,
            uint256 agentId,
            uint8   response,
            bytes32 responseHash,
            string  memory tag,
            uint256 lastUpdate
        )
    {
        if (_requests[requestHash].submittedAt == 0) {
            revert NoResponse(requestHash);
        }

        if (_hasResponse[requestHash]) {
            ValidationResponse storage r = _responses[requestHash];
            return (
                _requests[requestHash].validatorAddress,
                _requests[requestHash].agentId,
                r.response,
                r.responseHash,
                r.tag,
                r.respondedAt
            );
        }

        return (
            _requests[requestHash].validatorAddress,
            _requests[requestHash].agentId,
            0,
            bytes32(0),
            "",
            0
        );
    }
}
