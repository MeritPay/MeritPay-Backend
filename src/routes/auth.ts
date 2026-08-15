import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../middleware/errorHandler";
import { stellarWalletSchema } from "../lib/validation";
import { createSession, issueChallenge, verifyChallengeSignature } from "../lib/stellarAuth";

export const authRouter = Router();

const challengeSchema = z.object({ employerWallet: stellarWalletSchema });
const verifySchema = z.object({
  employerWallet: stellarWalletSchema,
  nonce: z.string().min(1).max(200),
  signature: z.string().min(1).max(500),
});

// Step 1: request a nonce to sign, proving control of the wallet.
authRouter.post("/auth/challenge", (req, res, next) => {
  try {
    const { employerWallet } = challengeSchema.parse(req.body);
    const { nonce, expiresAt } = issueChallenge(employerWallet);
    res.json({ nonce, expiresAt });
  } catch (err) {
    next(err);
  }
});

// Step 2: submit the signed nonce; on success, get a session token for
// subsequent requests (Authorization: Bearer <token>).
authRouter.post("/auth/verify", (req, res, next) => {
  try {
    const { employerWallet, nonce, signature } = verifySchema.parse(req.body);
    const verified = verifyChallengeSignature(employerWallet, nonce, signature);
    if (!verified) {
      throw new HttpError(401, "Invalid or expired signature");
    }
    const { token, expiresAt } = createSession(employerWallet);
    res.json({ token, expiresAt });
  } catch (err) {
    next(err);
  }
});
