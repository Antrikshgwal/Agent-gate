import { env } from "./env";
import {
  serviceRegistryAbi,
  agentRegistryAbi,
  attestationLoggerAbi,
  erc20Abi,
} from "./abi";

export const serviceRegistry = {
  address: env.serviceRegistry,
  abi: serviceRegistryAbi,
} as const;

export const agentRegistry = {
  address: env.agentRegistry,
  abi: agentRegistryAbi,
} as const;

export const attestationLogger = {
  address: env.attestationLogger,
  abi: attestationLoggerAbi,
} as const;

export const usdc = {
  address: env.usdc,
  abi: erc20Abi,
} as const;
