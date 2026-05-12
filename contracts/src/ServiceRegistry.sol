// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ServiceRegistry
/// @notice On-chain directory of services available through AgentGate.
///         Each registered service stakes USDC; stake can be slashed by the
///         protocol owner if the SLA is violated. Per-call stats are written
///         by AttestationLogger after every x402 payment is recorded.
contract ServiceRegistry is Ownable {
    struct Service {
        bytes32 id;
        string name;
        string endpoint;
        bytes32 schemaHash;
        address provider;
        uint256 pricePerCall;
        uint256 reputationStake;
        uint256 totalCalls;
        uint256 successfulCalls;
        bool isActive;
        uint64 createdAt;
    }

    struct SLA {
        uint256 maxLatencyMs;
        uint256 minUptimePercent; // basis points * 100, e.g. 9990 = 99.90%
        uint256 penaltyPerViolation;
    }

    IERC20 public immutable usdcToken;

    
    uint256 public constant MIN_STAKE = 100e6;

    mapping(bytes32 => Service) public services;
    mapping(bytes32 => SLA) public serviceSLAs;
    bytes32[] public serviceIds;

    address public attestationLogger;

    event ServiceRegistered(
        bytes32 indexed serviceId,
        string name,
        address indexed provider,
        uint256 stake
    );
    event ServiceCalled(bytes32 indexed serviceId, bool success);
    event StakeSlashed(bytes32 indexed serviceId, uint256 amount, string reason);
    event ServiceDeactivated(bytes32 indexed serviceId);
    event AttestationLoggerSet(address indexed logger);

    error InsufficientStake(uint256 provided, uint256 required);
    error NotAttestationLogger(address caller);
    error NotProvider(address caller, address provider);
    error ServiceInactive(bytes32 serviceId);
    error InsufficientStakeForSlash(uint256 stake, uint256 amount);

    modifier onlyAttestationLogger() {
        if (msg.sender != attestationLogger) revert NotAttestationLogger(msg.sender);
        _;
    }

    constructor(address _usdcToken) Ownable(msg.sender) {
        usdcToken = IERC20(_usdcToken);
    }

    function setAttestationLogger(address _logger) external onlyOwner {
        attestationLogger = _logger;
        emit AttestationLoggerSet(_logger);
    }

    function registerService(
        string memory _name,
        string memory _endpoint,
        bytes32 _schemaHash,
        uint256 _pricePerCall,
        uint256 _stakeAmount,
        SLA memory _sla
    ) external returns (bytes32 serviceId) {
        if (_stakeAmount < MIN_STAKE) revert InsufficientStake(_stakeAmount, MIN_STAKE);

        // Pull stake before storing — fails closed if approval/balance is missing.
        require(
            usdcToken.transferFrom(msg.sender, address(this), _stakeAmount),
            "Stake transfer failed"
        );

        // abi.encode (not encodePacked) so two distinct (name, endpoint) pairs
        // can never collide via string concatenation.
        serviceId = keccak256(
            abi.encode(_name, _endpoint, block.timestamp, msg.sender)
        );

        services[serviceId] = Service({
            id: serviceId,
            name: _name,
            endpoint: _endpoint,
            schemaHash: _schemaHash,
            provider: msg.sender,
            pricePerCall: _pricePerCall,
            reputationStake: _stakeAmount,
            totalCalls: 0,
            successfulCalls: 0,
            isActive: true,
            createdAt: uint64(block.timestamp)
        });
        serviceSLAs[serviceId] = _sla;
        serviceIds.push(serviceId);

        emit ServiceRegistered(serviceId, _name, msg.sender, _stakeAmount);
    }

    function updateServiceStats(bytes32 _serviceId, bool _success)
        external
        onlyAttestationLogger
    {
        Service storage svc = services[_serviceId];
        if (!svc.isActive) revert ServiceInactive(_serviceId);

        unchecked {
            svc.totalCalls++;
            if (_success) svc.successfulCalls++;
        }

        emit ServiceCalled(_serviceId, _success);
    }

    function slashStake(
        bytes32 _serviceId,
        uint256 _amount,
        string memory _reason
    ) external onlyOwner {
        Service storage svc = services[_serviceId];
        if (svc.reputationStake < _amount) {
            revert InsufficientStakeForSlash(svc.reputationStake, _amount);
        }

        svc.reputationStake -= _amount;
        require(usdcToken.transfer(owner(), _amount), "Slash transfer failed");

        emit StakeSlashed(_serviceId, _amount, _reason);
    }

    function deactivateService(bytes32 _serviceId) external {
        Service storage svc = services[_serviceId];
        if (msg.sender != svc.provider) revert NotProvider(msg.sender, svc.provider);
        svc.isActive = false;
        emit ServiceDeactivated(_serviceId);
    }

    function getServiceById(bytes32 _serviceId) external view returns (Service memory) {
        return services[_serviceId];
    }

    function getAllServices() external view returns (Service[] memory) {
        Service[] memory all = new Service[](serviceIds.length);
        for (uint256 i = 0; i < serviceIds.length; i++) {
            all[i] = services[serviceIds[i]];
        }
        return all;
    }

    function getServiceCount() external view returns (uint256) {
        return serviceIds.length;
    }
}
