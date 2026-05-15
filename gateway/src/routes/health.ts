import { Router } from "express";
import { config } from "../config.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: Math.floor(Date.now() / 1000),
    version: "0.1.0",
    x402_enabled: true,
    chain_id: config.kite.chainId,
    gateway_wallet: config.gateway.walletAddress(),
    contracts: {
      service_registry: config.contracts.serviceRegistry(),
      agent_registry: config.contracts.agentRegistry(),
      attestation_logger: config.contracts.attestationLogger(),
      payment_splitter: config.contracts.paymentSplitter(),
      usdc: config.contracts.usdc(),
    },
  });
});
