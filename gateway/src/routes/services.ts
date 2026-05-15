import { Router } from "express";
import { formatUnits } from "ethers";
import { getAllServices } from "../blockchain/contracts.js";

const PROVIDER_BPS = 9500n;
const TOTAL_BPS = 10_000n;

export const servicesRouter = Router();

servicesRouter.get("/api/v1/services", async (_req, res) => {
  try {
    const services = await getAllServices();
    const services_out = services.map((s) => {
      // pricePerCall is the gross amount; splitter fans 95/5.
      const providerShare = (s.pricePerCall * PROVIDER_BPS) / TOTAL_BPS;
      const protocolShare = s.pricePerCall - providerShare;
      const uptime =
        s.totalCalls === 0n
          ? 0
          : Number((s.successfulCalls * 10000n) / s.totalCalls) / 100;
      return {
        id: s.id,
        name: s.name,
        endpoint: s.endpoint,
        provider: s.provider,
        pricePerCall: formatUnits(s.pricePerCall, 6),
        providerShare: formatUnits(providerShare, 6),
        protocolShare: formatUnits(protocolShare, 6),
        reputationStake: formatUnits(s.reputationStake, 6),
        totalCalls: Number(s.totalCalls),
        successfulCalls: Number(s.successfulCalls),
        uptime,
        isActive: s.isActive,
      };
    });
    res.json({ services: services_out });
  } catch (err) {
    res.status(500).json({
      error: "BLOCKCHAIN_READ_FAILED",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
