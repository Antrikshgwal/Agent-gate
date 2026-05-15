// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PaymentSplitter} from "../src/PaymentSplitter.sol";
import {ServiceRegistry} from "../src/ServiceRegistry.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract PaymentSplitterTest is Test {
    PaymentSplitter splitter;
    ServiceRegistry registry;
    MockUSDC usdc;

    address gateway = address(0x6A7eA7); // owner of splitter
    address provider = address(0xA11CE);
    address protocolTreasury = address(0xC0FFEE);
    address outsider = address(0xBAD);

    bytes32 serviceId;
    uint256 constant STAKE = 100e6;
    uint256 constant PRICE = 10_000; // 0.01 USDC

    function setUp() public {
        usdc = new MockUSDC();
        registry = new ServiceRegistry(address(usdc));

        // Register a service so the splitter has someone to pay.
        usdc.mint(provider, 1_000e6);
        vm.prank(provider);
        usdc.approve(address(registry), type(uint256).max);
        vm.prank(provider);
        serviceId = registry.registerService(
            "OpenWeather",
            "https://api.openweathermap.org",
            bytes32(0),
            PRICE,
            STAKE,
            ServiceRegistry.SLA({
                maxLatencyMs: 500,
                minUptimePercent: 9990,
                penaltyPerViolation: 1e6
            })
        );

        // Deploy splitter and hand ownership to the gateway wallet, matching
        // the production wiring done by Deploy.s.sol.
        splitter = new PaymentSplitter(
            address(usdc),
            address(registry),
            protocolTreasury
        );
        splitter.transferOwnership(gateway);
    }

    function _fund(uint256 amount) internal {
        // Pretend Pieverse facilitator just credited the splitter via EIP-3009.
        usdc.mint(address(splitter), amount);
    }

    // --- distribute -----------------------------------------------------

    function test_Distribute_HappyPath_95_5() public {
        _fund(10_200); // 0.0102 USDC = the standard gateway 402 quote

        vm.prank(gateway);
        splitter.distribute(serviceId, 10_200);

        // 95% to provider, 5% to protocol treasury.
        assertEq(usdc.balanceOf(provider), 1_000e6 - STAKE + 9_690); // 95% of 10200
        assertEq(usdc.balanceOf(protocolTreasury), 510); // 5% of 10200
        assertEq(usdc.balanceOf(address(splitter)), 0); // nothing stuck
    }

    function test_Distribute_RoundingFavorsProtocol() public {
        // 1 wei amount → toProvider = 0 (95/10000 = 0), toProtocol = 1.
        _fund(1);
        vm.prank(gateway);
        splitter.distribute(serviceId, 1);
        assertEq(usdc.balanceOf(protocolTreasury), 1);
        assertEq(usdc.balanceOf(address(splitter)), 0);
    }

    function test_Distribute_EmitsEvent() public {
        _fund(10_200);
        vm.expectEmit(true, true, false, true, address(splitter));
        emit PaymentSplitter.Distributed(serviceId, provider, 9_690, 510);
        vm.prank(gateway);
        splitter.distribute(serviceId, 10_200);
    }

    function test_Distribute_OnlyOwner() public {
        _fund(10_200);
        vm.prank(outsider);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                outsider
            )
        );
        splitter.distribute(serviceId, 10_200);
    }

    function test_Distribute_RevertsOnUnknownService() public {
        bytes32 fakeId = keccak256("nope");
        _fund(10_200);
        vm.prank(gateway);
        vm.expectRevert(
            abi.encodeWithSelector(PaymentSplitter.UnknownService.selector, fakeId)
        );
        splitter.distribute(fakeId, 10_200);
    }

    function test_Distribute_RevertsOnInsufficientBalance() public {
        _fund(5_000);
        vm.prank(gateway);
        vm.expectRevert(
            abi.encodeWithSelector(
                PaymentSplitter.InsufficientBalance.selector,
                5_000,
                10_200
            )
        );
        splitter.distribute(serviceId, 10_200);
    }

    function test_Distribute_MultipleCallsAccumulate() public {
        _fund(20_400);
        vm.startPrank(gateway);
        splitter.distribute(serviceId, 10_200);
        splitter.distribute(serviceId, 10_200);
        vm.stopPrank();

        assertEq(usdc.balanceOf(provider), 1_000e6 - STAKE + 19_380); // 2 × 9690
        assertEq(usdc.balanceOf(protocolTreasury), 1_020); // 2 × 510
        assertEq(usdc.balanceOf(address(splitter)), 0);
    }

    // --- sweep ----------------------------------------------------------

    function test_Sweep_DrainsResidualToTreasury() public {
        _fund(1_234);
        vm.prank(gateway);
        uint256 swept = splitter.sweep();
        assertEq(swept, 1_234);
        assertEq(usdc.balanceOf(protocolTreasury), 1_234);
        assertEq(usdc.balanceOf(address(splitter)), 0);
    }

    function test_Sweep_NoopOnZeroBalance() public {
        vm.prank(gateway);
        uint256 swept = splitter.sweep();
        assertEq(swept, 0);
    }

    function test_Sweep_OnlyOwner() public {
        _fund(100);
        vm.prank(outsider);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                outsider
            )
        );
        splitter.sweep();
    }
}
