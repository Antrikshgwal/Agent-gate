// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ERC20.sol";

contract DeployScript is Script {
function run() external {
vm.startBroadcast();
new MyToken(1000000 * 10 ** 18);
vm.stopBroadcast();
}
}