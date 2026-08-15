/**
 * Wallet-ownership proof via challenge-response signing (Stellar keypairs are
 * Ed25519; the employer's Freighter wallet signs the server-issued nonce).
 * A self-declared wallet header alone proves nothing since public keys are public.
 */

import crypto from "crypto";
import { Keypair } from "@stellar/stellar-sdk";

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

// Single-use: the challenge is consumed whether or not verification succeeds,
// so a leaked/failed signature attempt can't be replayed against the same nonce.
export function verifyChallengeSignature(
  employerWallet: string,
  nonce: string,
  signatureBase64: string
): boolean {
  const challenge = challenges.get(employerWallet);
  challenges.delete(employerWallet);

  if (!challenge || challenge.nonce !== nonce || Date.now() > challenge.expiresAt) {
    return false;
  }

  try {
    const keypair = Keypair.fromPublicKey(employerWallet);
    const signature = Buffer.from(signatureBase64, "base64");
    return keypair.verify(Buffer.from(nonce, "utf8"), signature);
  } catch {
    return false;
  }
}
