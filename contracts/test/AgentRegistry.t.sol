// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry registry;

    address owner = address(this);
    address userA = address(0xA11CE);
    address userB = address(0xB0B);
    address logger = address(0x1066E5);
    address outsider = address(0xBAD);

    bytes32 constant DID_A = keccak256("did:kite:alice");
    bytes32 constant DID_B = keccak256("did:kite:bob");

    function setUp() public {
        registry = new AgentRegistry();
        registry.setAttestationLogger(logger);
    }

    // --- registerAgent --------------------------------------------------

    function test_RegisterAgent_HappyPath() public {
        vm.prank(userA);
        bool ok = registry.registerAgent(DID_A);
        assertTrue(ok);

        AgentRegistry.Agent memory a = registry.getAgent(DID_A);
        assertEq(a.did, DID_A);
        assertEq(a.owner, userA);
        assertEq(a.reputationScore, 500, "neutral score");
        assertEq(a.totalSpent, 0);
        assertEq(a.successfulCalls, 0);
        assertEq(a.failedCalls, 0);
        assertEq(a.createdAt, uint64(block.timestamp));
        assertTrue(a.isActive);

        bytes32[] memory owned = registry.getAgentsByOwner(userA);
        assertEq(owned.length, 1);
        assertEq(owned[0], DID_A);
    }

    function test_RegisterAgent_RevertsOnDuplicate() public {
        vm.prank(userA);
        registry.registerAgent(DID_A);

        vm.prank(userB);
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.AgentAlreadyExists.selector, DID_A)
        );
        registry.registerAgent(DID_A);
    }

    function test_RegisterAgent_MultiplePerOwner() public {
        vm.startPrank(userA);
        registry.registerAgent(DID_A);
        registry.registerAgent(DID_B);
        vm.stopPrank();

        bytes32[] memory owned = registry.getAgentsByOwner(userA);
        assertEq(owned.length, 2);
        assertEq(owned[0], DID_A);
        assertEq(owned[1], DID_B);
    }

    // --- access control -------------------------------------------------

    function test_SetAttestationLogger_OnlyOwner() public {
        vm.prank(outsider);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, outsider)
        );
        registry.setAttestationLogger(outsider);
    }

    function test_UpdateAgentStats_OnlyAttestationLogger() public {
        vm.prank(userA);
        registry.registerAgent(DID_A);

        vm.prank(outsider);
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.NotAttestationLogger.selector, outsider)
        );
        registry.updateAgentStats(DID_A, 1, true);
    }

    // --- updateAgentStats ----------------------------------------------

    function test_UpdateAgentStats_Success() public {
        vm.prank(userA);
        registry.registerAgent(DID_A);

        vm.prank(logger);
        registry.updateAgentStats(DID_A, 10_200, true);

        AgentRegistry.Agent memory a = registry.getAgent(DID_A);
        assertEq(a.successfulCalls, 1);
        assertEq(a.failedCalls, 0);
        assertEq(a.totalSpent, 10_200);
        // 1/1 success → 700 successRate; ageDays=0 → 0; tiny spend → 0 volume.
        assertEq(a.reputationScore, 700);
    }

    function test_UpdateAgentStats_Failure() public {
        vm.prank(userA);
        registry.registerAgent(DID_A);

        vm.prank(logger);
        registry.updateAgentStats(DID_A, 10_200, false);

        AgentRegistry.Agent memory a = registry.getAgent(DID_A);
        assertEq(a.successfulCalls, 0);
        assertEq(a.failedCalls, 1);
        assertEq(a.totalSpent, 10_200);
        assertEq(a.reputationScore, 0, "0/1 success means 0 successRate");
    }

    // --- calculateReputation -------------------------------------------

    function test_Reputation_NoCallsIsNeutral() public {
        vm.prank(userA);
        registry.registerAgent(DID_A);
        assertEq(registry.calculateReputation(DID_A), 500);
    }

    function test_Reputation_AgeRampsAndCaps() public {
        vm.prank(userA);
        registry.registerAgent(DID_A);

        // single success to lock in 700 successRate
        vm.prank(logger);
        registry.updateAgentStats(DID_A, 0, true);

        // 30 days in → ageBonus = 30 * 200 / 60 = 100 → 800 total
        vm.warp(block.timestamp + 30 days);
        assertEq(registry.calculateReputation(DID_A), 800);

        // past cap → ageBonus = 200 → 900 total
        vm.warp(block.timestamp + 31 days);
        assertEq(registry.calculateReputation(DID_A), 900);

        // stays at 200 even far past cap
        vm.warp(block.timestamp + 365 days);
        assertEq(registry.calculateReputation(DID_A), 900);
    }

    function test_Reputation_VolumeRampsAndCaps() public {
        uint256 cap = registry.REP_VOLUME_CAP();

        vm.prank(userA);
        registry.registerAgent(DID_A);

        vm.startPrank(logger);
        // Spend exactly the cap → +100 volume bonus.
        registry.updateAgentStats(DID_A, cap, true);
        // 1 success / 1 total = 700, ageDays=0 → 0, volume at cap → 100 = 800.
        assertEq(registry.calculateReputation(DID_A), 800);

        // Spending more does not increase volume bonus.
        registry.updateAgentStats(DID_A, cap, true);
        // 2/2 = 700, age=0, volume capped at 100 = 800.
        assertEq(registry.calculateReputation(DID_A), 800);
        vm.stopPrank();
    }

    function test_Reputation_PerfectMaxesAt1000() public {
        uint256 cap = registry.REP_VOLUME_CAP();

        vm.prank(userA);
        registry.registerAgent(DID_A);

        vm.prank(logger);
        registry.updateAgentStats(DID_A, cap + 1, true);

        vm.warp(block.timestamp + 61 days);
        assertEq(registry.calculateReputation(DID_A), 1000);
    }

    function test_Reputation_HalfSuccessRate() public {
        vm.prank(userA);
        registry.registerAgent(DID_A);

        vm.startPrank(logger);
        registry.updateAgentStats(DID_A, 0, true);
        registry.updateAgentStats(DID_A, 0, false);
        vm.stopPrank();

        // 1/2 = 350 successRate, age=0, volume=0 → 350
        assertEq(registry.calculateReputation(DID_A), 350);
    }

    // --- events ---------------------------------------------------------

    function test_RegisterAgent_EmitsEvent() public {
        vm.expectEmit(true, true, false, false, address(registry));
        emit AgentRegistry.AgentRegistered(DID_A, userA);
        vm.prank(userA);
        registry.registerAgent(DID_A);
    }

    function test_UpdateAgentStats_EmitsReputation() public {
        vm.prank(userA);
        registry.registerAgent(DID_A);

        vm.expectEmit(true, false, false, true, address(registry));
        emit AgentRegistry.ReputationUpdated(DID_A, 700);
        vm.prank(logger);
        registry.updateAgentStats(DID_A, 0, true);
    }
}
