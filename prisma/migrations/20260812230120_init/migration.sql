-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employerWallet" TEXT NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "baseSalary" INTEGER NOT NULL,
    "hoursThreshold" INTEGER NOT NULL,
    "bonusRateHours" INTEGER NOT NULL DEFAULT 20,
    "bonusRateSales" INTEGER NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PayrollEpoch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "epoch" INTEGER NOT NULL,
    "employerWallet" TEXT NOT NULL,
    "totalPayroll" TEXT NOT NULL,
    "txHash" TEXT,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ClaimEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "epochId" TEXT NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "employeeName" TEXT NOT NULL,
    "nullifier" TEXT NOT NULL,
    "amountStroops" TEXT NOT NULL,
    "proof" TEXT NOT NULL,
    "publicSignals" TEXT NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimTxHash" TEXT,
    "claimedAt" DATETIME,
    CONSTRAINT "ClaimEntry_epochId_fkey" FOREIGN KEY ("epochId") REFERENCES "PayrollEpoch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employerWallet_employeeId_key" ON "Employee"("employerWallet", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEpoch_epoch_key" ON "PayrollEpoch"("epoch");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimEntry_nullifier_key" ON "ClaimEntry"("nullifier");

-- CreateIndex
CREATE INDEX "ClaimEntry_epochId_idx" ON "ClaimEntry"("epochId");
