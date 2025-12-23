// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint8, euint32, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SecureVote
/// @notice Encrypted voting with public decryption after poll ends.
contract SecureVote is ZamaEthereumConfig {
    struct Poll {
        string name;
        string[4] options;
        uint8 optionsCount;
        uint64 startTime;
        uint64 endTime;
        address creator;
        bool ended;
        bool publicDecryptionReady;
        bool resultsPublished;
        euint32[4] encryptedCounts;
        uint32[4] publicResults;
    }

    uint256 private _pollCount;
    mapping(uint256 => Poll) private _polls;
    mapping(uint256 => mapping(address => bool)) private _hasVoted;

    event PollCreated(
        uint256 indexed pollId,
        address indexed creator,
        string name,
        uint8 optionsCount,
        uint64 startTime,
        uint64 endTime
    );
    event VoteCast(uint256 indexed pollId, address indexed voter);
    event PollEnded(uint256 indexed pollId);
    event ResultsPublished(uint256 indexed pollId);

    function createPoll(
        string calldata name,
        string[] calldata options,
        uint64 startTime,
        uint64 endTime
    ) external returns (uint256) {
        require(bytes(name).length > 0, "Name required");
        require(options.length >= 2 && options.length <= 4, "Options 2-4");
        require(endTime > startTime, "Invalid time range");

        uint256 pollId = _pollCount;
        _pollCount += 1;

        Poll storage poll = _polls[pollId];
        poll.name = name;
        poll.optionsCount = uint8(options.length);
        poll.startTime = startTime;
        poll.endTime = endTime;
        poll.creator = msg.sender;

        for (uint8 i = 0; i < poll.optionsCount; i++) {
            poll.options[i] = options[i];
            poll.encryptedCounts[i] = FHE.asEuint32(0);
            FHE.allowThis(poll.encryptedCounts[i]);
        }

        emit PollCreated(pollId, msg.sender, name, poll.optionsCount, startTime, endTime);
        return pollId;
    }

    function vote(uint256 pollId, externalEuint8 encryptedChoice, bytes calldata inputProof) external {
        Poll storage poll = _polls[pollId];
        require(poll.creator != address(0), "Poll not found");
        require(block.timestamp >= poll.startTime, "Poll not started");
        require(block.timestamp <= poll.endTime, "Poll ended");
        require(!_hasVoted[pollId][msg.sender], "Already voted");

        euint8 choice = FHE.fromExternal(encryptedChoice, inputProof);

        for (uint8 i = 0; i < poll.optionsCount; i++) {
            ebool isChoice = FHE.eq(choice, FHE.asEuint8(i));
            euint32 increment = FHE.select(isChoice, FHE.asEuint32(1), FHE.asEuint32(0));
            poll.encryptedCounts[i] = FHE.add(poll.encryptedCounts[i], increment);
            FHE.allowThis(poll.encryptedCounts[i]);
        }

        _hasVoted[pollId][msg.sender] = true;
        emit VoteCast(pollId, msg.sender);
    }

    function endPoll(uint256 pollId) external {
        Poll storage poll = _polls[pollId];
        require(poll.creator != address(0), "Poll not found");
        require(block.timestamp > poll.endTime, "Poll still active");
        require(!poll.publicDecryptionReady, "Already ended");

        poll.ended = true;
        poll.publicDecryptionReady = true;

        for (uint8 i = 0; i < poll.optionsCount; i++) {
            FHE.makePubliclyDecryptable(poll.encryptedCounts[i]);
        }

        emit PollEnded(pollId);
    }

    function publishResults(uint256 pollId, bytes calldata cleartextValues, bytes calldata decryptionProof) external {
        Poll storage poll = _polls[pollId];
        require(poll.creator != address(0), "Poll not found");
        require(poll.publicDecryptionReady, "Public decrypt not ready");
        require(!poll.resultsPublished, "Results already published");

        bytes32[] memory handles = new bytes32[](poll.optionsCount);
        for (uint8 i = 0; i < poll.optionsCount; i++) {
            handles[i] = euint32.unwrap(poll.encryptedCounts[i]);
        }

        FHE.checkSignatures(handles, cleartextValues, decryptionProof);

        uint32[] memory decoded = abi.decode(cleartextValues, (uint32[]));
        require(decoded.length == poll.optionsCount, "Result length mismatch");

        for (uint8 i = 0; i < poll.optionsCount; i++) {
            poll.publicResults[i] = decoded[i];
        }

        poll.resultsPublished = true;
        emit ResultsPublished(pollId);
    }

    function pollCount() external view returns (uint256) {
        return _pollCount;
    }

    function getPollInfo(
        uint256 pollId
    )
        external
        view
        returns (
            string memory name,
            string[] memory options,
            uint64 startTime,
            uint64 endTime,
            address creator,
            bool ended,
            bool publicDecryptionReady,
            bool resultsPublished
        )
    {
        Poll storage poll = _polls[pollId];
        require(poll.creator != address(0), "Poll not found");

        options = new string[](poll.optionsCount);
        for (uint8 i = 0; i < poll.optionsCount; i++) {
            options[i] = poll.options[i];
        }

        return (
            poll.name,
            options,
            poll.startTime,
            poll.endTime,
            poll.creator,
            poll.ended,
            poll.publicDecryptionReady,
            poll.resultsPublished
        );
    }

    function getEncryptedCounts(uint256 pollId) external view returns (euint32[4] memory counts, uint8 optionsCount) {
        Poll storage poll = _polls[pollId];
        require(poll.creator != address(0), "Poll not found");
        return (poll.encryptedCounts, poll.optionsCount);
    }

    function getPublishedResults(uint256 pollId) external view returns (uint32[] memory results, bool published) {
        Poll storage poll = _polls[pollId];
        require(poll.creator != address(0), "Poll not found");
        results = new uint32[](poll.optionsCount);
        for (uint8 i = 0; i < poll.optionsCount; i++) {
            results[i] = poll.publicResults[i];
        }
        return (results, poll.resultsPublished);
    }

    function hasVoted(uint256 pollId, address voter) external view returns (bool) {
        return _hasVoted[pollId][voter];
    }
}
