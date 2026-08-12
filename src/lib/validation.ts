import { z } from "zod";

export const upsertEmployeeSchema = z.object({
  employerWallet: z.string().min(1),
  employeeId: z.number().int().nonnegative(),
  name: z.string().min(1),
  baseSalary: z.number().int().positive(),
  hoursThreshold: z.number().int().nonnegative(),
  bonusRateHours: z.number().int().nonnegative().optional(),
  bonusRateSales: z.number().int().nonnegative().optional(),
});

export const listEmployeesQuerySchema = z.object({
  employerWallet: z.string().min(1),
});

export const claimEntryInputSchema = z.object({
  employeeId: z.number().int().nonnegative(),
  employeeName: z.string().min(1),
  nullifier: z.string().min(1),
  amountStroops: z.string().min(1),
  proof: z.unknown(),
  publicSignals: z.array(z.string()).min(1),
});

export const createEpochSchema = z.object({
  epoch: z.number().int().nonnegative(),
  employerWallet: z.string().min(1),
  totalPayroll: z.string().min(1),
  txHash: z.string().min(1).optional(),
  claimEntries: z.array(claimEntryInputSchema).min(1),
});

export const completeClaimSchema = z.object({
  txHash: z.string().min(1),
});
