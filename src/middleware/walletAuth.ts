import { NextFunction, Request, Response } from "express";
import { HttpError } from "./errorHandler";
import { resolveSession } from "../lib/stellarAuth";

/**
 * Requires a session token obtained via POST /auth/challenge + /auth/verify
 * (signature proof of wallet ownership). Sets res.locals.employerWallet to the
 * wallet bound to that session — never trust a client-declared wallet directly,
 * since Stellar public keys are public and trivially spoofable.
 */
export function walletAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : undefined;

  if (!token) {
    return next(
      new HttpError(
        401,
        "Missing session token. Authenticate via POST /auth/challenge and /auth/verify, then send Authorization: Bearer <token>."
      )
    );
  }

  const employerWallet = resolveSession(token);
  if (!employerWallet) {
    return next(new HttpError(401, "Invalid or expired session token"));
  }

  res.locals.employerWallet = employerWallet;
  next();
}
