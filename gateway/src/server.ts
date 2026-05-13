import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { healthRouter } from "./routes/health.js";
import { servicesRouter } from "./routes/services.js";
import { callRouter } from "./routes/call.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use(healthRouter);
app.use(servicesRouter);
app.use(callRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[unhandled]", err);
  if (res.headersSent) return;
  res.status(500).json({
    error: "INTERNAL_ERROR",
    message: err instanceof Error ? err.message : String(err),
  });
});

app.listen(config.port, () => {
  console.log(`AgentGate gateway listening on http://localhost:${config.port}`);
  console.log(`  facilitator : ${config.kite.facilitatorUrl()}`);
  console.log(`  chain id    : ${config.kite.chainId}`);
});
