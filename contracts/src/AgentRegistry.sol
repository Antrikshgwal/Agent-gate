// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentRegistry
/// @notice Tracks agent identities (Kite Passport DIDs) and reputation.
///         Per-call stats are written by AttestationLogger after every
///         x402 payment is recorded. Reputation is recomputed on every
///         update and ranges 0–1000.
contract AgentRegistry is Ownable {
    struct Agent {
        bytes32 did;
        address owner;
        uint256 reputationScore;
        uint256 totalSpent;
        uint256 successfulCalls;
        uint256 failedCalls;
        uint64 createdAt;
        bool isActive;
    }

    // Reputation weights (sum to 1000): success rate / account age / volume.
    uint256 public constant REP_SUCCESS_MAX = 700;
    uint256 public constant REP_AGE_MAX = 200;
    uint256 public constant REP_VOLUME_MAX = 100;
    uint256 public constant REP_AGE_CAP_DAYS = 60;
    uint256 public constant REP_VOLUME_CAP = 1000e6; // 1,000 USDC

    mapping(bytes32 => Agent) public agents;
    mapping(address => bytes32[]) internal _ownerToAgents;

    address public attestationLogger;

    event AgentRegistered(bytes32 indexed did, address indexed owner);
    event ReputationUpdated(bytes32 indexed did, uint256 newScore);
    event AttestationLoggerSet(address indexed logger);

    error AgentAlreadyExists(bytes32 did);
    error AgentInactive(bytes32 did);
    error NotAttestationLogger(address caller);

    modifier onlyAttestationLogger() {
        if (msg.sender != attestationLogger) revert NotAttestationLogger(msg.sender);
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setAttestationLogger(address _logger) external onlyOwner {
        attestationLogger = _logger;
        emit AttestationLoggerSet(_logger);
    }

    function registerAgent(bytes32 _did) external returns (bool) {
        if (agents[_did].did != bytes32(0)) revert AgentAlreadyExists(_did);

        agents[_did] = Agent({
            did: _did,
            owner: msg.sender,
            reputationScore: 500, // neutral starting score
            totalSpent: 0,
            successfulCalls: 0,
            failedCalls: 0,
            createdAt: uint64(block.timestamp),
            isActive: true
        });
        _ownerToAgents[msg.sender].push(_did);

        emit AgentRegistered(_did, msg.sender);
        return true;
    }

    function updateAgentStats(
        bytes32 _did,
        uint256 _amountSpent,
        bool _callSuccess
    ) external onlyAttestationLogger {
        Agent storage agent = agents[_did];
        if (!agent.isActive) revert AgentInactive(_did);

        agent.totalSpent += _amountSpent;
        if (_callSuccess) {
            agent.successfulCalls++;
        } else {
            agent.failedCalls++;
        }

        agent.reputationScore = calculateReputation(_did);
        emit ReputationUpdated(_did, agent.reputationScore);
    }

    function calculateReputation(bytes32 _did) public view returns (uint256) {
        Agent memory agent = agents[_did];

        uint256 totalCalls = agent.successfulCalls + agent.failedCalls;
        if (totalCalls == 0) return 500;

        uint256 successRate = (agent.successfulCalls * REP_SUCCESS_MAX) / totalCalls;

        uint256 ageDays = (block.timestamp - agent.createdAt) / 1 days;
        uint256 ageBonus = ageDays > REP_AGE_CAP_DAYS
            ? REP_AGE_MAX
            : (ageDays * REP_AGE_MAX) / REP_AGE_CAP_DAYS;

        uint256 volumeBonus = agent.totalSpent > REP_VOLUME_CAP
            ? REP_VOLUME_MAX
            : (agent.totalSpent * REP_VOLUME_MAX) / REP_VOLUME_CAP;

        return successRate + ageBonus + volumeBonus;
    }

    function getAgent(bytes32 _did) external view returns (Agent memory) {
        return agents[_did];
    }

    function getAgentsByOwner(address _owner) external view returns (bytes32[] memory) {
        return _ownerToAgents[_owner];
    }
}
