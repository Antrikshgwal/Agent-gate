import { publicClient } from "./chain";
import {
  serviceRegistry,
  agentRegistry,
  attestationLogger,
} from "./contracts";

export interface Service {
  id: `0x${string}`;
  name: string;
  endpoint: string;
  schemaHash: `0x${string}`;
  provider: `0x${string}`;
  pricePerCall: bigint;
  reputationStake: bigint;
  totalCalls: bigint;
  successfulCalls: bigint;
  isActive: boolean;
  createdAt: bigint;
}

export interface Agent {
  did: `0x${string}`;
  owner: `0x${string}`;
  reputationScore: bigint;
  totalSpent: bigint;
  successfulCalls: bigint;
  failedCalls: bigint;
  createdAt: bigint;
  isActive: boolean;
}

export interface Attestation {
  serviceId: `0x${string}`;
  agentDID: `0x${string}`;
  amountPaid: bigint;
  x402PaymentHash: `0x${string}`;
  timestamp: bigint;
  success: boolean;
  latencyMs: bigint;
}

export async function getAllServices(): Promise<Service[]> {
  const raw = (await publicClient.readContract({
    ...serviceRegistry,
    functionName: "getAllServices",
  })) as Service[];
  return raw.filter((s) => !/localhost|127\.0\.0\.1/i.test(s.endpoint));
}

export async function getServiceById(
  id: `0x${string}`,
): Promise<Service | null> {
  const raw = (await publicClient.readContract({
    ...serviceRegistry,
    functionName: "getServiceById",
    args: [id],
  })) as Service;
  if (
    raw.id ===
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  ) {
    return null;
  }
  return raw;
}

export async function getAgent(did: `0x${string}`): Promise<Agent | null> {
  const raw = (await publicClient.readContract({
    ...agentRegistry,
    functionName: "getAgent",
    args: [did],
  })) as Agent;
  if (
    raw.did ===
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  ) {
    return null;
  }
  return raw;
}

export async function getAttestationsByAgent(
  did: `0x${string}`,
  limit = 50,
): Promise<Attestation[]> {
  const raw = (await publicClient.readContract({
    ...attestationLogger,
    functionName: "getAttestationsByAgent",
    args: [did, BigInt(limit)],
  })) as Attestation[];
  return raw;
}

export async function getTotalAttestations(): Promise<bigint> {
  return (await publicClient.readContract({
    ...attestationLogger,
    functionName: "getTotalAttestations",
  })) as bigint;
}

/// Sum every service's lifetime USDC volume (totalCalls * pricePerCall).
/// Approximate (doesn't include gateway fees) but good enough for a landing
/// hero stat. Reads-many; cheap on-chain.
export async function getTotalVolumeMicroUsdc(): Promise<bigint> {
  const services = await getAllServices();
  let total = 0n;
  for (const s of services) total += s.totalCalls * s.pricePerCall;
  return total;
}
