// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AttestationLogger} from "../src/AttestationLogger.sol";
import {ServiceRegistry} from "../src/ServiceRegistry.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @notice Unit tests for AttestationLogger isolated against real
///         ServiceRegistry / AgentRegistry instances (small enough that real
///         deps are clearer than mocks). The full deploy-wiring lifecycle
///         lives in Integration.t.sol.
contract AttestationLoggerTest is Test {
    AttestationLogger logger;
    ServiceRegistry serviceRegistry;
    AgentRegistry agentRegistry;
    MockUSDC usdc;

    address provider = address(0xA11CE);
    address agentOwner = address(0xB0B);
    address outsider = address(0xBAD);

    bytes32 constant DID = keccak256("did:kite:test");
    bytes32 serviceId;

    function setUp() public {
        usdc = new MockUSDC();
        serviceRegistry = new ServiceRegistry(address(usdc));
        agentRegistry = new AgentRegistry();
        logger = new AttestationLogger(address(serviceRegistry), address(agentRegistry));

        // Wire registries to accept stat updates from the logger.
        serviceRegistry.setAttestationLogger(address(logger));
        agentRegistry.setAttestationLogger(address(logger));

        // Fund + register a service.
        usdc.mint(provider, 1_000e6);
        vm.prank(provider);
        usdc.approve(address(serviceRegistry), type(uint256).max);
        vm.prank(provider);
        serviceId = serviceRegistry.registerService(
            "OpenWeather",
            "https://api.openweathermap.org",
            bytes32(0),
            10_000,
            100e6,
            ServiceRegistry.SLA({
                maxLatencyMs: 500,
                minUptimePercent: 9990,
                penaltyPerViolation: 1e6
            })
        );

        // Register an agent.
        vm.prank(agentOwner);
        agentRegistry.registerAgent(DID);
    }

    function _log(bool success) internal returns (bytes32) {
        return logger.logAttestation(
            serviceId,
            DID,
            10_200,
            keccak256("x402-tx"),
            success,
            150
        );
    }

    // --- logAttestation ------------------------------------------------

    function test_LogAttestation_StoresAndFansOut() public {
        bytes32 attId = _log(true);

        AttestationLogger.Attestation memory att = logger.getAttestation(attId);
        assertEq(att.serviceId, serviceId);
        assertEq(att.agentDID, DID);
        assertEq(att.amountPaid, 10_200);
        assertEq(att.x402PaymentHash, keccak256("x402-tx"));
        assertEq(att.timestamp, uint64(block.timestamp));
        assertTrue(att.success);
        assertEq(att.latencyMs, 150);

        // ServiceRegistry counters bumped.
        ServiceRegistry.Service memory svc = serviceRegistry.getServiceById(serviceId);
        assertEq(svc.totalCalls, 1);
        assertEq(svc.successfulCalls, 1);

        // AgentRegistry stats bumped and reputation recomputed (700 for 1/1 success).
        AgentRegistry.Agent memory ag = agentRegistry.getAgent(DID);
        assertEq(ag.successfulCalls, 1);
        assertEq(ag.failedCalls, 0);
        assertEq(ag.totalSpent, 10_200);
        assertEq(ag.reputationScore, 700);

        assertEq(logger.getTotalAttestations(), 1);
        assertEq(logger.getAgentAttestationCount(DID), 1);
    }

    function test_LogAttestation_Failure() public {
        _log(false);

        ServiceRegistry.Service memory svc = serviceRegistry.getServiceById(serviceId);
        assertEq(svc.totalCalls, 1);
        assertEq(svc.successfulCalls, 0);

        AgentRegistry.Agent memory ag = agentRegistry.getAgent(DID);
        assertEq(ag.successfulCalls, 0);
        assertEq(ag.failedCalls, 1);
        // 0/1 success → 0 successRate; age=0; tiny spend → 0 volume → 0
        assertEq(ag.reputationScore, 0);
    }

    function test_LogAttestation_OnlyOwner() public {
        vm.prank(outsider);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, outsider)
        );
        _log(true);
    }

    function test_LogAttestation_EmitsEvent() public {
        vm.expectEmit(false, true, true, true, address(logger));
        emit AttestationLogger.AttestationLogged(
            bytes32(0), // not asserted (indexed but topic check disabled)
            serviceId,
            DID,
            10_200,
            true
        );
        _log(true);
    }

    function test_LogAttestation_RevertsOnDuplicate() public {
        _log(true);
        // Same args + same block.timestamp ⇒ same attestationId.
        vm.expectRevert(); // AttestationExists or the downstream stat revert
        _log(true);
    }

    function test_LogAttestation_RevertsIfServiceInactive() public {
        vm.prank(provider);
        serviceRegistry.deactivateService(serviceId);

        vm.expectRevert(
            abi.encodeWithSelector(ServiceRegistry.ServiceInactive.selector, serviceId)
        );
        _log(true);
    }

    // --- getAttestationsByAgent ----------------------------------------

    function test_GetAttestationsByAgent_ReturnsMostRecentFirst() public {
        // First attestation.
        bytes32 a1 = _log(true);

        // Bump time so the second attestationId differs and stats stay sane.
        vm.warp(block.timestamp + 10);
        bytes32 a2 = _log(false);

        vm.warp(block.timestamp + 10);
        bytes32 a3 = _log(true);

        AttestationLogger.Attestation[] memory recent =
            logger.getAttestationsByAgent(DID, 10);
        assertEq(recent.length, 3);
        // Most-recent-first ordering.
        assertEq(recent[0].x402PaymentHash, keccak256("x402-tx")); // a3
        assertTrue(recent[0].success);
        assertEq(recent[1].success, false); // a2
        assertEq(recent[2].success, true); // a1

        assertEq(a1 != a2 && a2 != a3 && a1 != a3, true, "ids unique");
    }

    function test_GetAttestationsByAgent_RespectsLimit() public {
        _log(true);
        vm.warp(block.timestamp + 1);
        _log(true);
        vm.warp(block.timestamp + 1);
        _log(true);

        AttestationLogger.Attestation[] memory limited =
            logger.getAttestationsByAgent(DID, 2);
        assertEq(limited.length, 2);
    }
}
