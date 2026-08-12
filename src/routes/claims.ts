import { Router } from "express";
import { prisma } from "../db";
import { HttpError } from "../middleware/errorHandler";
import { completeClaimSchema } from "../lib/validation";

export const claimsRouter = Router();

// Mark a claim complete after a successful on-chain claim_payout tx.
// Note: the on-chain nullifier check (payroll.is_nullifier_spent) is the real
// source of truth; this just mirrors status for fast reads by the frontend.
claimsRouter.post("/claims/:nullifier/complete", async (req, res, next) => {
  try {
    const { txHash } = completeClaimSchema.parse(req.body);

    const claimEntry = await prisma.claimEntry.findUnique({
      where: { nullifier: req.params.nullifier },
    });
    if (!claimEntry) {
      throw new HttpError(404, "Claim entry not found");
    }

    const updated = await prisma.claimEntry.update({
      where: { nullifier: req.params.nullifier },
      data: { claimed: true, claimTxHash: txHash, claimedAt: new Date() },
    });

    res.json({
      nullifier: updated.nullifier,
      claimed: updated.claimed,
      claimTxHash: updated.claimTxHash,
      claimedAt: updated.claimedAt,
    });
  } catch (err) {
    next(err);
  }
});

claimsRouter.get("/claims/:nullifier", async (req, res, next) => {
  try {
    const claimEntry = await prisma.claimEntry.findUnique({
      where: { nullifier: req.params.nullifier },
    });
    if (!claimEntry) {
      throw new HttpError(404, "Claim entry not found");
    }

    res.json({
      nullifier: claimEntry.nullifier,
      claimed: claimEntry.claimed,
      claimTxHash: claimEntry.claimTxHash,
      claimedAt: claimEntry.claimedAt,
    });
  } catch (err) {
    next(err);
  }
});
