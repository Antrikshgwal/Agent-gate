// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ServiceRegistry} from "./ServiceRegistry.sol";

/// @title PaymentSplitter
/// @notice Receives x402 settlements and fans them out 95% / 5% between the
///         on-chain service provider and the protocol treasury. The gateway
///         calls `distribute` after the Pieverse facilitator credits this
///         contract via EIP-3009 `transferWithAuthorization`.
///
///         Single signature from the agent, atomic split, fully visible on
///         chain.
contract PaymentSplitter is Ownable {
    IERC20 public immutable usdc;
    ServiceRegistry public immutable serviceRegistry;
    address public immutable protocolTreasury;

    /// Provider share in basis points (10_000 = 100%). Set at deploy time;
    uint256 public constant PROVIDER_BPS = 9500;
    uint256 public constant TOTAL_BPS = 10_000;

    event Distributed(
        bytes32 indexed serviceId,
        address indexed provider,
        uint256 toProvider,
        uint256 toProtocol
    );

    error UnknownService(bytes32 serviceId);
    error InsufficientBalance(uint256 have, uint256 need);
    error TransferFailed();

    constructor(
        address _usdc,
        address _serviceRegistry,
        address _protocolTreasury
    ) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        serviceRegistry = ServiceRegistry(_serviceRegistry);
        protocolTreasury = _protocolTreasury;
    }

    /// @notice Distribute `amount` of USDC currently held by this contract
    ///         between the service's registered provider and the protocol
    ///         treasury.
    ///         Reverts if the splitter doesn't hold at least `amount` 
    function distribute(bytes32 _serviceId, uint256 _amount) external onlyOwner {
        ServiceRegistry.Service memory svc =
            serviceRegistry.getServiceById(_serviceId);
        if (svc.provider == address(0)) revert UnknownService(_serviceId);

        uint256 balance = usdc.balanceOf(address(this));
        if (balance < _amount) revert InsufficientBalance(balance, _amount);

        uint256 toProvider = (_amount * PROVIDER_BPS) / TOTAL_BPS;
        uint256 toProtocol = _amount - toProvider;

        if (!usdc.transfer(svc.provider, toProvider)) revert TransferFailed();
        if (toProtocol > 0) {
            if (!usdc.transfer(protocolTreasury, toProtocol)) revert TransferFailed();
        }

        emit Distributed(_serviceId, svc.provider, toProvider, toProtocol);
    }

    /// @notice Sweep any residual USDC to the protocol treasury.
    function sweep() external onlyOwner returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) return 0;
        if (!usdc.transfer(protocolTreasury, balance)) revert TransferFailed();
        return balance;
    }
}
