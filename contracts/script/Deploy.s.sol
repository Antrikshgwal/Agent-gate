// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ServiceRegistry} from "../src/ServiceRegistry.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {AttestationLogger} from "../src/AttestationLogger.sol";

/// @notice Deploys the three AgentGate contracts in production wiring.
///
/// Required env vars (see .env.example):
///   PRIVATE_KEY              — deployer / protocol owner
///   USDC_ADDR                — payment token (real USDC or our MockUSDC)
///   GATEWAY_WALLET_ADDRESS   — final owner of AttestationLogger
///
/// Usage:
///   source .env
///   forge script script/Deploy.s.sol:DeployScript \
///       --rpc-url $KITE_RPC_URL --broadcast
contract DeployScript is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDR");
        address gateway = vm.envAddress("GATEWAY_WALLET_ADDRESS");

        vm.startBroadcast(deployerPk);

        ServiceRegistry serviceRegistry = new ServiceRegistry(usdc);
        AgentRegistry agentRegistry = new AgentRegistry();
        AttestationLogger attestationLogger = new AttestationLogger(
            address(serviceRegistry),
            address(agentRegistry)
        );

        serviceRegistry.setAttestationLogger(address(attestationLogger));
        agentRegistry.setAttestationLogger(address(attestationLogger));

        // AttestationLogger's owner is the only address that can write
        // attestations. In production that's the gateway service wallet.
        attestationLogger.transferOwnership(gateway);

        vm.stopBroadcast();

        console.log("=== AgentGate deployment ===");
        console.log("USDC                :", usdc);
        console.log("ServiceRegistry     :", address(serviceRegistry));
        console.log("AgentRegistry       :", address(agentRegistry));
        console.log("AttestationLogger   :", address(attestationLogger));
        console.log("Gateway (logger owner):", gateway);

        _writeAddresses(
            usdc,
            address(serviceRegistry),
            address(agentRegistry),
            address(attestationLogger),
            gateway
        );
    }

    function _writeAddresses(
        address usdc,
        address serviceRegistry,
        address agentRegistry,
        address attestationLogger,
        address gateway
    ) internal {
        string memory key = "deployments";
        vm.serializeAddress(key, "USDC", usdc);
        vm.serializeAddress(key, "ServiceRegistry", serviceRegistry);
        vm.serializeAddress(key, "AgentRegistry", agentRegistry);
        vm.serializeAddress(key, "AttestationLogger", attestationLogger);
        string memory json = vm.serializeAddress(key, "GatewayOwner", gateway);

        string memory path = string.concat(
            "./deployments/",
            vm.toString(block.chainid),
            ".json"
        );
        vm.writeJson(json, path);
        console.log("Addresses written to:", path);
    }
}
