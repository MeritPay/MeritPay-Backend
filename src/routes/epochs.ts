import { Router } from "express";
import { ClaimEntry } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../middleware/errorHandler";
import { createEpochSchema } from "../lib/validation";

export const epochsRouter = Router();

function serializeClaimEntry(entry: ClaimEntry) {
  try {
    return {
      ...entry,
      proof: JSON.parse(entry.proof),
      publicSignals: JSON.parse(entry.publicSignals),
    };
  } catch (err) {
    console.error(`Failed to parse JSON for claim entry ${entry.id}:`, err);
    throw new Error(`Failed to deserialize claim entry ${entry.id}: invalid JSON`);
  }
}

// Create a payroll epoch + its claim bundle in one call, right after execute_payroll succeeds.
epochsRouter.post("/epochs", async (req, res, next) => {
  try {
    const body = createEpochSchema.parse(req.body);
    const authenticatedWallet = res.locals.employerWallet;

    // Verify wallet authorization: can only create epochs for own wallet
    if (body.employerWallet !== authenticatedWallet) {
      throw new HttpError(403, "Unauthorized: cannot create epochs for other employers");
    }

    const epoch = await prisma.payrollEpoch.create({
      data: {
        epoch: body.epoch,
        employerWallet: body.employerWallet,
        totalPayroll: body.totalPayroll,
        txHash: body.txHash,
        claimEntries: {
          create: body.claimEntries.map((entry) => ({
            employeeId: entry.employeeId,
            employeeName: entry.employeeName,
            nullifier: entry.nullifier,
            amountStroops: entry.amountStroops,
            proof: JSON.stringify(entry.proof),
            publicSignals: JSON.stringify(entry.publicSignals),
          })),
        },
      },
      include: { claimEntries: true },
    });

    res.status(201).json({
      ...epoch,
      claimEntries: epoch.claimEntries.map(serializeClaimEntry),
    });
  } catch (err) {
    next(err);
  }
});

epochsRouter.get("/epochs/:epoch", async (req, res, next) => {
  try {
    const epochNumber = Number(req.params.epoch);
    if (!Number.isInteger(epochNumber) || epochNumber < 0) {
      throw new HttpError(400, "epoch must be a non-negative integer");
    }

    const epoch = await prisma.payrollEpoch.findUnique({
      where: { epoch: epochNumber },
      include: { claimEntries: true },
    });

    if (!epoch) {
      throw new HttpError(404, "Epoch not found");
    }

    const authenticatedWallet = res.locals.employerWallet;

    // Verify wallet authorization: can only read own epochs
    if (epoch.employerWallet !== authenticatedWallet) {
      throw new HttpError(403, "Unauthorized: cannot access other employers' epochs");
    }

    res.json({
      ...epoch,
      claimEntries: epoch.claimEntries.map(serializeClaimEntry),
    });
  } catch (err) {
    next(err);
  }
});

// The single claim entry an employee needs (proof + signals + amount) to call claim_payout.
epochsRouter.get("/epochs/:epoch/claims/:employeeId", async (req, res, next) => {
  try {
    const epochNumber = Number(req.params.epoch);
    const employeeId = Number(req.params.employeeId);
    if (!Number.isInteger(epochNumber) || epochNumber < 0 || !Number.isInteger(employeeId) || employeeId < 0) {
      throw new HttpError(400, "epoch and employeeId must be non-negative integers");
    }

    const epoch = await prisma.payrollEpoch.findUnique({ where: { epoch: epochNumber } });
    if (!epoch) {
      throw new HttpError(404, "Epoch not found");
    }

    const authenticatedWallet = res.locals.employerWallet;

    // Verify wallet authorization: can only read own epochs
    if (epoch.employerWallet !== authenticatedWallet) {
      throw new HttpError(403, "Unauthorized: cannot access other employers' epochs");
    }

    const claimEntry = await prisma.claimEntry.findFirst({
      where: { epochId: epoch.id, employeeId },
    });

    if (!claimEntry) {
      throw new HttpError(404, "Claim entry not found");
    }

    res.json(serializeClaimEntry(claimEntry));
  } catch (err) {
    next(err);
  }
});
