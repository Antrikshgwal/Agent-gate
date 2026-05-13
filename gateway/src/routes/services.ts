import { Router } from "express";
import { formatUnits } from "ethers";
import { getAllServices } from "../blockchain/contracts.js";
import { config } from "../config.js";

export const servicesRouter = Router();

servicesRouter.get("/api/v1/services", async (_req, res) => {
  try {
    const services = await getAllServices();
    const feeBps = BigInt(config.gateway.feeBps);
    const services_out = services.map((s) => {
      const gatewayFee = (s.pricePerCall * feeBps) / 10_000n;
      const total = s.pricePerCall + gatewayFee;
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
        gatewayFee: formatUnits(gatewayFee, 6),
        totalPrice: formatUnits(total, 6),
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
