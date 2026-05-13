// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ServiceRegistry} from "../src/ServiceRegistry.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {AttestationLogger} from "../src/AttestationLogger.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @notice End-to-end test of the three on-chain contracts in their
///         production wiring: deploy → set loggers → transfer logger
///         ownership to the gateway → register service → register agent
///         → gateway logs attestations → verify both registries stayed
///         consistent through many calls.
contract IntegrationTest is Test {
    ServiceRegistry serviceRegistry;
    AgentRegistry agentRegistry;
    AttestationLogger attestationLogger;
    MockUSDC usdc;

    address protocolOwner = address(this);
    address gatewayWallet = address(0x6A7eA7);
    address provider = address(0xA11CE);
    address agentOwner = address(0xB0B);

    bytes32 constant DID = keccak256("did:kite:integration");
    bytes32 serviceId;

    function setUp() public {
        // 1. Deploy mock token and the three registries.
        usdc = new MockUSDC();
        serviceRegistry = new ServiceRegistry(address(usdc));
        agentRegistry = new AgentRegistry();
        attestationLogger = new AttestationLogger(
            address(serviceRegistry),
            address(agentRegistry)
        );

        // 2. Cross-wire: only the logger can write stats.
        serviceRegistry.setAttestationLogger(address(attestationLogger));
        agentRegistry.setAttestationLogger(address(attestationLogger));

        // 3. Hand the logger over to the gateway wallet (production setup).
        attestationLogger.transferOwnership(gatewayWallet);

        // 4. Provider stakes and registers a service.
        usdc.mint(provider, 10_000e6);
        vm.startPrank(provider);
        usdc.approve(address(serviceRegistry), type(uint256).max);
        serviceId = serviceRegistry.registerService(
            "OpenWeather",
            "https://api.openweathermap.org",
            bytes32(uint256(0xABCD)),
            10_000, // 0.01 USDC per call
            500e6, // 500 USDC stake
            ServiceRegistry.SLA({
                maxLatencyMs: 500,
                minUptimePercent: 9990,
                penaltyPerViolation: 1e6
            })
        );
        vm.stopPrank();

        // 5. Agent registers itself.
        vm.prank(agentOwner);
        agentRegistry.registerAgent(DID);
    }

    function test_FullLifecycle() public {
        // Sanity: only the gateway can log.
        vm.expectRevert(); // Ownable unauthorized
        attestationLogger.logAttestation(serviceId, DID, 10_200, bytes32("tx1"), true, 150);

        // The gateway records 10 calls — 9 successes, 1 failure.
        vm.startPrank(gatewayWallet);
        for (uint256 i = 0; i < 9; i++) {
            vm.warp(block.timestamp + 1);
            attestationLogger.logAttestation(
                serviceId,
                DID,
                10_200,
                keccak256(abi.encode("tx", i)),
                true,
                150
            );
        }
        vm.warp(block.timestamp + 1);
        attestationLogger.logAttestation(
            serviceId,
            DID,
            10_200,
            keccak256(abi.encode("tx", uint256(9))),
            false,
            900
        );
        vm.stopPrank();

        // Service stats add up.
        ServiceRegistry.Service memory svc = serviceRegistry.getServiceById(serviceId);
        assertEq(svc.totalCalls, 10);
        assertEq(svc.successfulCalls, 9);

        // Agent stats add up.
        AgentRegistry.Agent memory ag = agentRegistry.getAgent(DID);
        assertEq(ag.successfulCalls, 9);
        assertEq(ag.failedCalls, 1);
        assertEq(ag.totalSpent, 10_200 * 10);

        // Reputation: 9/10 = 630 successRate, ageDays=0, tiny volume = 0 → 630
        assertEq(ag.reputationScore, 630);

        // Logger keeps the global + per-agent indexes.
        assertEq(attestationLogger.getTotalAttestations(), 10);
        assertEq(attestationLogger.getAgentAttestationCount(DID), 10);
    }

    function test_OwnerSlashesAfterBadCalls() public {
        // 5 failed calls drag reputation down.
        vm.startPrank(gatewayWallet);
        for (uint256 i = 0; i < 5; i++) {
            vm.warp(block.timestamp + 1);
            attestationLogger.logAttestation(
                serviceId,
                DID,
                10_200,
                keccak256(abi.encode("fail", i)),
                false,
                3_000
            );
        }
        vm.stopPrank();

        // Owner (protocol) decides to slash 100 USDC for SLA breach.
        uint256 ownerBefore = usdc.balanceOf(protocolOwner);
        serviceRegistry.slashStake(serviceId, 100e6, "SLA breach: latency over 500ms");

        ServiceRegistry.Service memory svc = serviceRegistry.getServiceById(serviceId);
        assertEq(svc.reputationStake, 400e6, "stake reduced");
        assertEq(usdc.balanceOf(protocolOwner), ownerBefore + 100e6, "treasury credited");
    }

    function test_ServiceCanBeDeactivatedAndBlocksFurtherLogs() public {
        // One successful call.
        vm.prank(gatewayWallet);
        attestationLogger.logAttestation(
            serviceId,
            DID,
            10_200,
            keccak256("ok"),
            true,
            100
        );

        // Provider pulls the service.
        vm.prank(provider);
        serviceRegistry.deactivateService(serviceId);

        // Further logs against this service revert.
        vm.warp(block.timestamp + 1);
        vm.prank(gatewayWallet);
        vm.expectRevert(
            abi.encodeWithSelector(ServiceRegistry.ServiceInactive.selector, serviceId)
        );
        attestationLogger.logAttestation(
            serviceId,
            DID,
            10_200,
            keccak256("post-deactivate"),
            true,
            100
        );
    }
}
