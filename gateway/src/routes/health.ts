import { Router } from "express";
import { listAdapterNames } from "../adapters/registry.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: Math.floor(Date.now() / 1000),
    version: "0.1.0",
    x402_enabled: true,
    adapters: listAdapterNames(),
  });
});
