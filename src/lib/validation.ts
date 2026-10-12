import { z } from "zod";

// Stellar wallet format: 'G' followed by 55 base32 characters
const stellarWalletRegex = /^G[A-Z2-7]{55}$/;

export const stellarWalletSchema = z
  .string()
  .regex(stellarWalletRegex, "Invalid Stellar wallet address format")
  .describe("Stellar public key (G + 55 base32 chars)");

// Shared refinements for numeric-string, txHash, and int32 bounds
export const stroopString = z
  .string()
  .regex(/^\d+$/, "must be a non-negative integer string")
  .refine((s) => {
    try {
      return BigInt(s) <= 0x7fffffffffffffffn;
    } catch {
      return false;
    }
  }, "exceeds i64 stroop range");

export const txHashSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, "must be a 64-char hex tx hash");

export const int32 = z.number().int().nonnegative().max(2_147_483_647);

export const upsertEmployeeSchema = z.object({
  employerWallet: stellarWalletSchema,
  employeeId: int32,
  name: z.string().min(1).max(255, "name must be 255 chars or less"),
  baseSalary: z.number().int().positive().max(2_147_483_647, "baseSalary out of range"),
  hoursThreshold: z.number().int().min(0).max(10000, "hoursThreshold must be between 0 and 10000"),
  bonusRateHours: z.number().int().min(0).max(10000, "bonusRateHours must be between 0 and 10000").optional(),
  bonusRateSales: z.number().int().min(0).max(10000, "bonusRateSales must be between 0 and 10000").optional(),
});

export const listEmployeesQuerySchema = z.object({
  employerWallet: stellarWalletSchema,
});

export const claimEntryInputSchema = z.object({
  employeeId: int32,
  employeeName: z.string().min(1).max(255),
  nullifier: z.string().min(1).max(500, "nullifier too long"),
  amountStroops: stroopString,
  proof: z.unknown(),
  publicSignals: z.array(z.string()).min(1).max(100, "too many public signals"),
});

export const createEpochSchema = z.object({
  epoch: int32,
  employerWallet: stellarWalletSchema,
  totalPayroll: stroopString,
  txHash: txHashSchema.optional(),
  claimEntries: z.array(claimEntryInputSchema).min(1),
});

export const completeClaimSchema = z.object({
  txHash: txHashSchema,
});
