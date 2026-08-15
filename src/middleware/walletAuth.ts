import { NextFunction, Request, Response } from "express";
import { HttpError } from "./errorHandler";
import { stellarWalletSchema } from "../lib/validation";

/**
 * Middleware to extract and validate employer wallet from request.
 * Stores the wallet in req.locals.employerWallet for route handlers to use.
 * 
 * Priority:
 * 1. X-Employer-Wallet header
 * 2. employerWallet in query string
 * 3. employerWallet in body
 */
export function walletAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    let wallet: string | undefined;

    // Check header first (most secure)
    if (req.headers["x-employer-wallet"]) {
      wallet = Array.isArray(req.headers["x-employer-wallet"])
        ? req.headers["x-employer-wallet"][0]
        : req.headers["x-employer-wallet"];
    }

    // Fall back to query parameter
    if (!wallet && req.query.employerWallet) {
      const queryWallet = req.query.employerWallet;
      if (typeof queryWallet === "string") {
        wallet = queryWallet;
      } else if (Array.isArray(queryWallet)) {
        wallet = queryWallet[0] as string | undefined;
      }
    }

    // Fall back to body
    if (!wallet && req.body && typeof req.body === "object" && "employerWallet" in req.body) {
      wallet = req.body.employerWallet;
    }

    if (!wallet) {
      throw new HttpError(401, "Missing employer wallet. Provide via X-Employer-Wallet header, query param, or request body.");
    }

    // Validate wallet format
    const validatedWallet = stellarWalletSchema.parse(wallet);

    // Store in res.locals for route handlers
    res.locals.employerWallet = validatedWallet;

    next();
  } catch (err) {
    if (err instanceof Error && err.message.includes("Invalid Stellar")) {
      return next(new HttpError(400, "Invalid employer wallet format"));
    }
    next(err);
  }
}

/**
 * Enforce that the extracted wallet matches the one in the request.
 * Use this on routes that accept wallet in body/query to prevent privilege escalation.
 */
export function verifyWalletMatch(req: Request, res: Response, next: NextFunction) {
  try {
    const providedWallet = req.body?.employerWallet || req.query?.employerWallet;
    const authenticatedWallet = res.locals.employerWallet;

    if (providedWallet && providedWallet !== authenticatedWallet) {
      throw new HttpError(403, "Wallet mismatch: authenticated wallet does not match requested wallet");
    }

    next();
  } catch (err) {
    next(err);
  }
}
