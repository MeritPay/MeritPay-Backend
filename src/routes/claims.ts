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
    const authenticatedWallet = res.locals.employerWallet;

    const claimEntry = await prisma.claimEntry.findUnique({
      where: { nullifier: req.params.nullifier },
      include: { epoch: true },
    });
    if (!claimEntry) {
      throw new HttpError(404, "Claim entry not found");
    }

    // Verify wallet authorization: can only mark claims complete for own epochs
    if (claimEntry.epoch.employerWallet !== authenticatedWallet) {
      throw new HttpError(403, "Unauthorized: cannot mark other employers' claims as complete");
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
      include: { epoch: true },
    });
    if (!claimEntry) {
      throw new HttpError(404, "Claim entry not found");
    }

    const authenticatedWallet = res.locals.employerWallet;

    // Verify wallet authorization: can only read own claims
    if (claimEntry.epoch.employerWallet !== authenticatedWallet) {
      throw new HttpError(403, "Unauthorized: cannot access other employers' claims");
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
