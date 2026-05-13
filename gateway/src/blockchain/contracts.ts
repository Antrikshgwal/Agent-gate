import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { config } from "../config.js";

// Human-readable ABI fragments — only the methods the gateway actually calls.
// Keeping these inline avoids a runtime dependency on the contracts/out/ build.

const SERVICE_REGISTRY_ABI = [
  "function getAllServices() view returns (tuple(bytes32 id, string name, string endpoint, bytes32 schemaHash, address provider, uint256 pricePerCall, uint256 reputationStake, uint256 totalCalls, uint256 successfulCalls, bool isActive, uint64 createdAt)[])",
  "function getServiceById(bytes32) view returns (tuple(bytes32 id, string name, string endpoint, bytes32 schemaHash, address provider, uint256 pricePerCall, uint256 reputationStake, uint256 totalCalls, uint256 successfulCalls, bool isActive, uint64 createdAt))",
];

const AGENT_REGISTRY_ABI = [
  "function getAgent(bytes32) view returns (tuple(bytes32 did, address owner, uint256 reputationScore, uint256 totalSpent, uint256 successfulCalls, uint256 failedCalls, uint64 createdAt, bool isActive))",
];

const ATTESTATION_LOGGER_ABI = [
  "function logAttestation(bytes32 serviceId, bytes32 agentDID, uint256 amountPaid, bytes32 x402PaymentHash, bool success, uint256 latencyMs) returns (bytes32)",
];

let _provider: JsonRpcProvider | null = null;
let _wallet: Wallet | null = null;

export function provider(): JsonRpcProvider {
  if (!_provider) {
    _provider = new JsonRpcProvider(config.kite.rpcUrl(), config.kite.chainId);
  }
  return _provider;
}

export function gatewayWallet(): Wallet {
  if (!_wallet) {
    _wallet = new Wallet(config.gateway.privateKey(), provider());
  }
  return _wallet;
}

export function serviceRegistry(): Contract {
  return new Contract(config.contracts.serviceRegistry(), SERVICE_REGISTRY_ABI, provider());
}

export function agentRegistry(): Contract {
  return new Contract(config.contracts.agentRegistry(), AGENT_REGISTRY_ABI, provider());
}

export function attestationLogger(): Contract {
  return new Contract(config.contracts.attestationLogger(), ATTESTATION_LOGGER_ABI, gatewayWallet());
}

export interface OnChainService {
  id: string;
  name: string;
  endpoint: string;
  schemaHash: string;
  provider: string;
  pricePerCall: bigint;
  reputationStake: bigint;
  totalCalls: bigint;
  successfulCalls: bigint;
  isActive: boolean;
  createdAt: bigint;
}

export async function getServiceById(serviceId: string): Promise<OnChainService | null> {
  const raw = await serviceRegistry().getServiceById(serviceId);
  // Non-existent services return a zero-id struct.
  if (raw.id === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return null;
  }
  return rawToService(raw);
}

export async function getAllServices(): Promise<OnChainService[]> {
  const raw: unknown[] = await serviceRegistry().getAllServices();
  return raw.map(rawToService);
}

function rawToService(raw: any): OnChainService {
  return {
    id: raw.id,
    name: raw.name,
    endpoint: raw.endpoint,
    schemaHash: raw.schemaHash,
    provider: raw.provider,
    pricePerCall: raw.pricePerCall,
    reputationStake: raw.reputationStake,
    totalCalls: raw.totalCalls,
    successfulCalls: raw.successfulCalls,
    isActive: raw.isActive,
    createdAt: raw.createdAt,
  };
}

export async function logAttestationOnChain(args: {
  serviceId: string;
  agentDID: string;
  amountPaid: bigint;
  x402PaymentHash: string;
  success: boolean;
  latencyMs: number;
}): Promise<string> {
  const tx = await attestationLogger().logAttestation(
    args.serviceId,
    args.agentDID,
    args.amountPaid,
    args.x402PaymentHash,
    args.success,
    args.latencyMs,
  );
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}
