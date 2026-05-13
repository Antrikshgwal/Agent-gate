/// Minimal ABI fragments for the three AgentGate contracts. We declare them
/// inline (rather than importing JSON from contracts/out) so the frontend has
/// zero build-time dependency on the contracts package.

export const serviceRegistryAbi = [
  {
    type: "function",
    name: "getAllServices",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "id", type: "bytes32" },
          { name: "name", type: "string" },
          { name: "endpoint", type: "string" },
          { name: "schemaHash", type: "bytes32" },
          { name: "provider", type: "address" },
          { name: "pricePerCall", type: "uint256" },
          { name: "reputationStake", type: "uint256" },
          { name: "totalCalls", type: "uint256" },
          { name: "successfulCalls", type: "uint256" },
          { name: "isActive", type: "bool" },
          { name: "createdAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getServiceById",
    stateMutability: "view",
    inputs: [{ name: "_serviceId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "bytes32" },
          { name: "name", type: "string" },
          { name: "endpoint", type: "string" },
          { name: "schemaHash", type: "bytes32" },
          { name: "provider", type: "address" },
          { name: "pricePerCall", type: "uint256" },
          { name: "reputationStake", type: "uint256" },
          { name: "totalCalls", type: "uint256" },
          { name: "successfulCalls", type: "uint256" },
          { name: "isActive", type: "bool" },
          { name: "createdAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getServiceCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "MIN_STAKE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "registerService",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_name", type: "string" },
      { name: "_endpoint", type: "string" },
      { name: "_schemaHash", type: "bytes32" },
      { name: "_pricePerCall", type: "uint256" },
      { name: "_stakeAmount", type: "uint256" },
      {
        name: "_sla",
        type: "tuple",
        components: [
          { name: "maxLatencyMs", type: "uint256" },
          { name: "minUptimePercent", type: "uint256" },
          { name: "penaltyPerViolation", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "serviceId", type: "bytes32" }],
  },
] as const;

export const agentRegistryAbi = [
  {
    type: "function",
    name: "getAgent",
    stateMutability: "view",
    inputs: [{ name: "_did", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "did", type: "bytes32" },
          { name: "owner", type: "address" },
          { name: "reputationScore", type: "uint256" },
          { name: "totalSpent", type: "uint256" },
          { name: "successfulCalls", type: "uint256" },
          { name: "failedCalls", type: "uint256" },
          { name: "createdAt", type: "uint64" },
          { name: "isActive", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "calculateReputation",
    stateMutability: "view",
    inputs: [{ name: "_did", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "REP_SUCCESS_MAX",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "REP_AGE_MAX",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "REP_VOLUME_MAX",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "REP_AGE_CAP_DAYS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "REP_VOLUME_CAP",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const attestationLoggerAbi = [
  {
    type: "function",
    name: "getTotalAttestations",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getAgentAttestationCount",
    stateMutability: "view",
    inputs: [{ name: "_agentDID", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getAttestationsByAgent",
    stateMutability: "view",
    inputs: [
      { name: "_agentDID", type: "bytes32" },
      { name: "_limit", type: "uint256" },
    ],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "serviceId", type: "bytes32" },
          { name: "agentDID", type: "bytes32" },
          { name: "amountPaid", type: "uint256" },
          { name: "x402PaymentHash", type: "bytes32" },
          { name: "timestamp", type: "uint64" },
          { name: "success", type: "bool" },
          { name: "latencyMs", type: "uint256" },
        ],
      },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;
