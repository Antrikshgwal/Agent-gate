// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ServiceRegistry} from "./ServiceRegistry.sol";
import {AgentRegistry} from "./AgentRegistry.sol";

/// @title AttestationLogger
/// @notice Records x402 payment attestations on-chain. Each log writes one
///         immutable attestation and fans out stat updates to ServiceRegistry
///         and AgentRegistry. Only the owner (the gateway wallet) may log.
contract AttestationLogger is Ownable {
    struct Attestation {
        bytes32 serviceId;
        bytes32 agentDID;
        uint256 amountPaid;
        bytes32 x402PaymentHash;
        uint64 timestamp;
        bool success;
        uint256 latencyMs;
    }

    ServiceRegistry public immutable serviceRegistry;
    AgentRegistry public immutable agentRegistry;

    mapping(bytes32 => Attestation) public attestations;
    bytes32[] public attestationIds;
    mapping(bytes32 => bytes32[]) internal _agentAttestations;

    event AttestationLogged(
        bytes32 indexed attestationId,
        bytes32 indexed serviceId,
        bytes32 indexed agentDID,
        uint256 amountPaid,
        bool success
    );

    error AttestationExists(bytes32 attestationId);

    constructor(address _serviceRegistry, address _agentRegistry)
        Ownable(msg.sender)
    {
        serviceRegistry = ServiceRegistry(_serviceRegistry);
        agentRegistry = AgentRegistry(_agentRegistry);
    }

    function logAttestation(
        bytes32 _serviceId,
        bytes32 _agentDID,
        uint256 _amountPaid,
        bytes32 _x402PaymentHash,
        bool _success,
        uint256 _latencyMs
    ) external onlyOwner returns (bytes32 attestationId) {
        attestationId = keccak256(
            abi.encode(_serviceId, _agentDID, _x402PaymentHash, block.timestamp)
        );
        if (attestations[attestationId].timestamp != 0) {
            revert AttestationExists(attestationId);
        }

        attestations[attestationId] = Attestation({
            serviceId: _serviceId,
            agentDID: _agentDID,
            amountPaid: _amountPaid,
            x402PaymentHash: _x402PaymentHash,
            timestamp: uint64(block.timestamp),
            success: _success,
            latencyMs: _latencyMs
        });
        attestationIds.push(attestationId);
        _agentAttestations[_agentDID].push(attestationId);

        // Fan out — both registries must have this contract set as their
        // attestationLogger or the calls below will revert.
        serviceRegistry.updateServiceStats(_serviceId, _success);
        agentRegistry.updateAgentStats(_agentDID, _amountPaid, _success);

        emit AttestationLogged(
            attestationId,
            _serviceId,
            _agentDID,
            _amountPaid,
            _success
        );
    }

    function getAttestation(bytes32 _attestationId)
        external
        view
        returns (Attestation memory)
    {
        return attestations[_attestationId];
    }

    /// @notice Most-recent-first list of an agent's attestations, capped at _limit.
    function getAttestationsByAgent(bytes32 _agentDID, uint256 _limit)
        external
        view
        returns (Attestation[] memory)
    {
        bytes32[] storage all = _agentAttestations[_agentDID];
        uint256 count = all.length > _limit ? _limit : all.length;
        Attestation[] memory result = new Attestation[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = attestations[all[all.length - 1 - i]];
        }
        return result;
    }

    function getTotalAttestations() external view returns (uint256) {
        return attestationIds.length;
    }

    function getAgentAttestationCount(bytes32 _agentDID)
        external
        view
        returns (uint256)
    {
        return _agentAttestations[_agentDID].length;
    }
}
