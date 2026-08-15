import { NextFunction, Request, Response } from "express";
import { HttpError } from "./errorHandler";

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const store: RateLimitStore = {};

/**
 * Basic in-memory rate limiter by IP/wallet combination.
 * For production, use Redis-based rate limiting (e.g., redis-rate-limit package).
 */
export function rateLimitMiddleware(
  windowMs: number = 60000, // 1 minute
  maxRequests: number = 100 // 100 requests per window
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Use wallet if available (from walletAuth middleware), else use IP
    const key = res.locals.employerWallet || req.ip || "unknown";

    const now = Date.now();
    const record = store[key];

    if (!record || now > record.resetTime) {
      // Initialize or reset
      store[key] = { count: 1, resetTime: now + windowMs };
      return next();
    }

    record.count++;

    if (record.count > maxRequests) {
      throw new HttpError(429, `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs}ms`);
    }

    next();
  };
}
