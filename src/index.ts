import "dotenv/config";
import cors from "cors";
import express from "express";
import { prisma } from "./db";
import { errorHandler } from "./middleware/errorHandler";
import { walletAuthMiddleware } from "./middleware/walletAuth";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { healthRouter } from "./routes/health";
import { employeesRouter } from "./routes/employees";
import { epochsRouter } from "./routes/epochs";
import { claimsRouter } from "./routes/claims";

const app = express();

// Security: Enforce explicit CORS origin in production
const corsOrigin = process.env.CORS_ORIGIN;
if (!corsOrigin && process.env.NODE_ENV === "production") {
  console.warn("WARNING: CORS_ORIGIN not set in production. Requests will be rejected.");
}

app.use(
  cors({
    origin: corsOrigin || (process.env.NODE_ENV === "development" ? "*" : false),
    credentials: true,
    maxAge: 86400, // 24 hours
  })
);

// Security: Limit request size to prevent payload bomb attacks
app.use(express.json({ limit: "1mb" }));

// Security: Add request timeout (5 seconds for all requests)
app.use((req, res, next) => {
  res.setTimeout(5000, () => {
    res.status(408).json({ error: "Request timeout" });
  });
  next();
});

// Security: Apply rate limiting globally
app.use(rateLimitMiddleware(60000, 100)); // 100 req/min per IP/wallet

// Health check endpoint (no auth required)
app.use(healthRouter);

// Security: All other routes require wallet authentication
app.use(walletAuthMiddleware);

// Apply wallet-protected routes
app.use(employeesRouter);
app.use(epochsRouter);
app.use(claimsRouter);

// Error handling (must be last)
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
const server = app.listen(port, () => {
  console.log(`MeritPay backend listening on port ${port}`);
  console.log(`CORS origin: ${corsOrigin || "development mode"}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

server.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});
