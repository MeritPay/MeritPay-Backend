import { z } from "zod";

// Stellar wallet format: 'G' followed by 55 base32 characters
const stellarWalletRegex = /^G[A-Z2-7]{55}$/;

export const stellarWalletSchema = z
  .string()
  .regex(stellarWalletRegex, "Invalid Stellar wallet address format")
  .describe("Stellar public key (G + 55 base32 chars)");

export const upsertEmployeeSchema = z.object({
  employerWallet: stellarWalletSchema,
  employeeId: z.number().int().min(0).max(1000000, "employeeId must be between 0 and 1000000"),
  name: z.string().min(1).max(255, "name must be 255 chars or less"),
  baseSalary: z.number().int().min(1).max(9007199254740991, "baseSalary out of range"),
  hoursThreshold: z.number().int().min(0).max(10000, "hoursThreshold must be between 0 and 10000"),
  bonusRateHours: z.number().int().min(0).max(10000, "bonusRateHours must be between 0 and 10000").optional(),
  bonusRateSales: z.number().int().min(0).max(10000, "bonusRateSales must be between 0 and 10000").optional(),
});

export const listEmployeesQuerySchema = z.object({
  employerWallet: stellarWalletSchema,
});

export const claimEntryInputSchema = z.object({
  employeeId: z.number().int().min(0).max(1000000),
  employeeName: z.string().min(1).max(255),
  nullifier: z.string().min(1).max(500, "nullifier too long"),
  amountStroops: z.string().regex(/^\d+$/, "amountStroops must be numeric").min(1),
  proof: z.unknown(),
  publicSignals: z.array(z.string()).min(1).max(100, "too many public signals"),
});

export const createEpochSchema = z.object({
  epoch: z.number().int().min(0).max(1000000, "epoch must be between 0 and 1000000"),
  employerWallet: stellarWalletSchema,
  totalPayroll: z.string().regex(/^\d+$/, "totalPayroll must be numeric").min(1),
  txHash: z.string().min(1).max(500, "txHash too long").optional(),
  claimEntries: z.array(claimEntryInputSchema).min(1),
});

export const completeClaimSchema = z.object({
  txHash: z.string().min(1).max(500, "txHash too long"),
});
