// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ReputationRegistry is Ownable {
    struct Feedback {
        int128  value;
        uint8   valueDecimals;
        string  tag1;
        string  tag2;
        string  endpoint;
        string  feedbackURI;
        bytes32 feedbackHash;
        uint256 timestamp;
        address submitter;
    }

    mapping(uint256 => Feedback[]) private _agentFeedback;

    event FeedbackGiven(
        uint256 indexed agentId,
        int128  value,
        uint8   valueDecimals,
        string  tag1,
        string  tag2,
        address indexed submitter
    );

    constructor() Ownable() {}

    function giveFeedback(
        uint256 agentId,
        int128  value,
        uint8   valueDecimals,
        string  calldata tag1,
        string  calldata tag2,
        string  calldata endpoint,
        string  calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        _agentFeedback[agentId].push(Feedback({
            value: value,
            valueDecimals: valueDecimals,
            tag1: tag1,
            tag2: tag2,
            endpoint: endpoint,
            feedbackURI: feedbackURI,
            feedbackHash: feedbackHash,
            timestamp: block.timestamp,
            submitter: msg.sender
        }));

        emit FeedbackGiven(agentId, value, valueDecimals, tag1, tag2, msg.sender);
    }

    function getSummary(
        uint256   agentId,
        address[] calldata,
        string    memory tag1,
        string    memory tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals) {
        Feedback[] storage feedbacks = _agentFeedback[agentId];
        uint256 len = feedbacks.length;
        int128 total;
        uint8 decimals;

        for (uint256 i = 0; i < len; i++) {
            Feedback storage f = feedbacks[i];
            if (
                keccak256(bytes(f.tag1)) == keccak256(bytes(tag1)) &&
                keccak256(bytes(f.tag2)) == keccak256(bytes(tag2))
            ) {
                total += f.value;
                decimals = f.valueDecimals;
                count++;
            }
        }

        if (count > 0) {
            summaryValue = total / int128(int256(uint256(count)));
        }
        summaryValueDecimals = decimals;
    }

    function getFeedbackCount(uint256 agentId) external view returns (uint256) {
        return _agentFeedback[agentId].length;
    }

    function getFeedback(uint256 agentId, uint256 index)
        external view returns (Feedback memory)
    {
        require(index < _agentFeedback[agentId].length, "RR: invalid index");
        return _agentFeedback[agentId][index];
    }
}
