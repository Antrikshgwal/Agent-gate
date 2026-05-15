// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ServiceRegistry} from "../src/ServiceRegistry.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract ServiceRegistryTest is Test {
    ServiceRegistry registry;
    MockUSDC usdc;

    address owner = address(this); // test contract is the deployer/owner
    address provider = address(0xA11CE);
    address logger = address(0x1066E5); // stand-in for the AttestationLogger
    address outsider = address(0xBAD);

    uint256 constant STAKE = 100e6; // 100 USDC (matches MIN_STAKE)
    uint256 constant PRICE = 10_000; // 0.01 USDC

    function setUp() public {
        usdc = new MockUSDC();
        registry = new ServiceRegistry(address(usdc));
        registry.setAttestationLogger(logger);

        // Fund and approve the provider so they can register a service.
        usdc.mint(provider, 1_000e6);
        vm.prank(provider);
        usdc.approve(address(registry), type(uint256).max);
    }

    function _defaultSLA() internal pure returns (ServiceRegistry.SLA memory) {
        return ServiceRegistry.SLA({
            maxLatencyMs: 500,
            minUptimePercent: 9990,
            penaltyPerViolation: 1e6
        });
    }

    function _register(address as_) internal returns (bytes32) {
        vm.prank(as_);
        return registry.registerService(
            "OpenWeather",
            "https://api.openweathermap.org",
            bytes32(uint256(0xABCD)),
            PRICE,
            STAKE,
            _defaultSLA()
        );
    }

    // --- registerService ------------------------------------------------

    function test_RegisterService_HappyPath() public {
        bytes32 id = _register(provider);

        ServiceRegistry.Service memory s = registry.getServiceById(id);
        assertEq(s.id, id, "id");
        assertEq(s.name, "OpenWeather", "name");
        assertEq(s.endpoint, "https://api.openweathermap.org", "endpoint");
        assertEq(s.provider, provider, "provider");
        assertEq(s.pricePerCall, PRICE, "price");
        assertEq(s.reputationStake, STAKE, "stake");
        assertEq(s.totalCalls, 0, "totalCalls");
        assertEq(s.successfulCalls, 0, "successfulCalls");
        assertTrue(s.isActive, "isActive");
        assertEq(s.createdAt, uint64(block.timestamp), "createdAt");

        // Stake actually moved into the registry.
        assertEq(usdc.balanceOf(address(registry)), STAKE);
        assertEq(usdc.balanceOf(provider), 1_000e6 - STAKE);

        // SLA stored.
        (uint256 maxLatency, uint256 minUptime, uint256 penalty) =
            registry.serviceSLAs(id);
        assertEq(maxLatency, 500);
        assertEq(minUptime, 9990);
        assertEq(penalty, 1e6);

        assertEq(registry.getServiceCount(), 1);
    }

    function test_RegisterService_EmitsEvent() public {
        vm.expectEmit(false, true, false, false, address(registry));
        // We don't know the serviceId ahead of time; only assert the indexed
        // provider address and the name/stake in the data.
        emit ServiceRegistry.ServiceRegistered(bytes32(0), "OpenWeather", provider, STAKE);
        _register(provider);
    }

    function test_RegisterService_RevertsBelowMinStake() public {
        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(
                ServiceRegistry.InsufficientStake.selector,
                STAKE - 1,
                STAKE
            )
        );
        registry.registerService(
            "Low",
            "https://x",
            bytes32(0),
            PRICE,
            STAKE - 1,
            _defaultSLA()
        );
    }

    function test_RegisterService_RevertsWithoutApproval() public {
        address noApproval = address(0xDEAD);
        usdc.mint(noApproval, STAKE);
        vm.prank(noApproval);
        // OZ v5 ERC20: insufficient allowance reverts with ERC20InsufficientAllowance.
        vm.expectRevert();
        registry.registerService(
            "NoApproval",
            "https://x",
            bytes32(0),
            PRICE,
            STAKE,
            _defaultSLA()
        );
    }

    function test_RegisterService_MultipleAreEnumerable() public {
        bytes32 a = _register(provider);
        // bump timestamp so the second id derives from a different seed
        vm.warp(block.timestamp + 1);
        bytes32 b = _register(provider);

        assertTrue(a != b, "ids must be unique");
        assertEq(registry.getServiceCount(), 2);

        ServiceRegistry.Service[] memory all = registry.getAllServices();
        assertEq(all.length, 2);
        assertEq(all[0].id, a);
        assertEq(all[1].id, b);
    }

    // --- access control -------------------------------------------------

    function test_SetAttestationLogger_OnlyOwner() public {
        vm.prank(outsider);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, outsider)
        );
        registry.setAttestationLogger(outsider);
    }

    function test_UpdateServiceStats_OnlyAttestationLogger() public {
        bytes32 id = _register(provider);
        vm.prank(outsider);
        vm.expectRevert(
            abi.encodeWithSelector(ServiceRegistry.NotAttestationLogger.selector, outsider)
        );
        registry.updateServiceStats(id, true);
    }

    // --- updateServiceStats --------------------------------------------

    function test_UpdateServiceStats_Success() public {
        bytes32 id = _register(provider);

        vm.prank(logger);
        registry.updateServiceStats(id, true);

        ServiceRegistry.Service memory s = registry.getServiceById(id);
        assertEq(s.totalCalls, 1);
        assertEq(s.successfulCalls, 1);
    }

    function test_UpdateServiceStats_Failure() public {
        bytes32 id = _register(provider);

        vm.prank(logger);
        registry.updateServiceStats(id, false);

        ServiceRegistry.Service memory s = registry.getServiceById(id);
        assertEq(s.totalCalls, 1);
        assertEq(s.successfulCalls, 0);
    }

    function test_UpdateServiceStats_RevertsOnInactive() public {
        bytes32 id = _register(provider);
        vm.prank(provider);
        registry.deactivateService(id);

        vm.prank(logger);
        vm.expectRevert(
            abi.encodeWithSelector(ServiceRegistry.ServiceInactive.selector, id)
        );
        registry.updateServiceStats(id, true);
    }

    // --- slashStake -----------------------------------------------------

    function test_SlashStake_HappyPath() public {
        bytes32 id = _register(provider);
        uint256 slashAmount = 25e6;
        uint256 ownerBefore = usdc.balanceOf(owner);

        registry.slashStake(id, slashAmount, "slow response");

        ServiceRegistry.Service memory s = registry.getServiceById(id);
        assertEq(s.reputationStake, STAKE - slashAmount);
        assertEq(usdc.balanceOf(owner), ownerBefore + slashAmount);
    }

    function test_SlashStake_OnlyOwner() public {
        bytes32 id = _register(provider);
        vm.prank(outsider);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, outsider)
        );
        registry.slashStake(id, 1, "nope");
    }

    function test_SlashStake_RevertsOnInsufficient() public {
        bytes32 id = _register(provider);
        vm.expectRevert(
            abi.encodeWithSelector(
                ServiceRegistry.InsufficientStakeForSlash.selector,
                STAKE,
                STAKE + 1
            )
        );
        registry.slashStake(id, STAKE + 1, "too much");
    }

    // --- deactivateService ---------------------------------------------

    function test_DeactivateService_OnlyProvider() public {
        bytes32 id = _register(provider);
        vm.prank(outsider);
        vm.expectRevert(
            abi.encodeWithSelector(ServiceRegistry.NotProvider.selector, outsider, provider)
        );
        registry.deactivateService(id);
    }

    function test_DeactivateService_SetsInactive() public {
        bytes32 id = _register(provider);
        vm.prank(provider);
        registry.deactivateService(id);

        assertFalse(registry.getServiceById(id).isActive);
    }

    // --- updateEndpoint -------------------------------------------------

    function test_UpdateEndpoint_HappyPath() public {
        bytes32 id = _register(provider);
        vm.prank(provider);
        registry.updateEndpoint(id, "https://new.provider.example");
        assertEq(
            registry.getServiceById(id).endpoint,
            "https://new.provider.example"
        );
    }

    function test_UpdateEndpoint_EmitsEvent() public {
        bytes32 id = _register(provider);
        vm.expectEmit(true, false, false, true, address(registry));
        emit ServiceRegistry.EndpointUpdated(
            id,
            "https://api.openweathermap.org",
            "https://new.provider.example"
        );
        vm.prank(provider);
        registry.updateEndpoint(id, "https://new.provider.example");
    }

    function test_UpdateEndpoint_OnlyProvider() public {
        bytes32 id = _register(provider);
        vm.prank(outsider);
        vm.expectRevert(
            abi.encodeWithSelector(
                ServiceRegistry.NotProvider.selector,
                outsider,
                provider
            )
        );
        registry.updateEndpoint(id, "https://anything");
    }

    function test_UpdateEndpoint_RevertsOnEmpty() public {
        bytes32 id = _register(provider);
        vm.prank(provider);
        vm.expectRevert(ServiceRegistry.EmptyEndpoint.selector);
        registry.updateEndpoint(id, "");
    }
}
