import "dotenv/config";
import cors from "cors";
import express from "express";
import { prisma } from "./db";
import { errorHandler } from "./middleware/errorHandler";
import { healthRouter } from "./routes/health";
import { employeesRouter } from "./routes/employees";
import { epochsRouter } from "./routes/epochs";
import { claimsRouter } from "./routes/claims";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use(express.json());

app.use(healthRouter);
app.use(employeesRouter);
app.use(epochsRouter);
app.use(claimsRouter);

app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
const server = app.listen(port, () => {
  console.log(`MeritPay backend listening on port ${port}`);
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
