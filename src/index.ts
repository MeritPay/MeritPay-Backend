import "dotenv/config";
import cors from "cors";
import express from "express";
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
app.listen(port, () => {
  console.log(`MeritPay backend listening on port ${port}`);
});
