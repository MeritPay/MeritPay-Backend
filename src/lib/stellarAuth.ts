/**
 * Wallet-ownership proof via challenge-response signing (Stellar keypairs are
 * Ed25519; the employer's Freighter wallet signs the server-issued nonce).
 * A self-declared wallet header alone proves nothing since public keys are public.
 */

import crypto from "crypto";

interface Challenge {
  nonce: string;
  expiresAt: number;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const challenges = new Map<string, Challenge>(); // key: employerWallet

export function issueChallenge(employerWallet: string): { nonce: string; expiresAt: number } {
  const nonce = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  challenges.set(employerWallet, { nonce, expiresAt });
  return { nonce, expiresAt };
}
