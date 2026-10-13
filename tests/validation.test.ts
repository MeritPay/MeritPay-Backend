import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  claimEntryInputSchema,
  groth16ProofSchema,
  decimalString,
  CLAIM_PUBLIC_SIGNALS_COUNT,
  createEpochSchema,
} from "../src/lib/validation";

describe("decimalString schema", () => {
  it("accepts non-negative integer decimal strings", () => {
    assert.equal(decimalString.parse("0"), "0");
    assert.equal(decimalString.parse("1234567890"), "1234567890");
    assert.equal(decimalString.parse("50000000"), "50000000");
  });

  it("rejects negative numbers, decimals, non-numeric and empty strings", () => {
    assert.throws(() => decimalString.parse("-1"));
    assert.throws(() => decimalString.parse("12.34"));
    assert.throws(() => decimalString.parse("abc"));
    assert.throws(() => decimalString.parse(""));
    assert.throws(() => decimalString.parse("123a"));
  });
});

describe("groth16ProofSchema", () => {
  const validProof = {
    pi_a: ["1111", "2222", "1"],
    pi_b: [
      ["3333", "4444"],
      ["5555", "6666"],
      ["1", "0"],
    ],
    pi_c: ["7777", "8888", "1"],
    protocol: "groth16" as const,
    curve: "bn128",
  };

  it("accepts valid Groth16 proof format with passthrough metadata", () => {
    const proofWithExtra = {
      ...validProof,
      extraField: "allowed_by_passthrough",
    };
    const parsed = groth16ProofSchema.parse(proofWithExtra);
    assert.equal(parsed.protocol, "groth16");
    assert.equal((parsed as Record<string, unknown>).extraField, "allowed_by_passthrough");
  });

  it("rejects non-object proofs (strings, numbers, null, undefined)", () => {
    assert.throws(() => groth16ProofSchema.parse("oops"));
    assert.throws(() => groth16ProofSchema.parse(12345));
    assert.throws(() => groth16ProofSchema.parse(null));
    assert.throws(() => groth16ProofSchema.parse(undefined));
    assert.throws(() => groth16ProofSchema.parse([]));
  });

  it("rejects proofs with incorrect array lengths for pi_a, pi_b, pi_c", () => {
    assert.throws(() =>
      groth16ProofSchema.parse({
        ...validProof,
        pi_a: ["1", "2"], // length 2 instead of 3
      })
    );
    assert.throws(() =>
      groth16ProofSchema.parse({
        ...validProof,
        pi_b: [["1", "2"], ["3", "4"]], // length 2 instead of 3
      })
    );
    assert.throws(() =>
      groth16ProofSchema.parse({
        ...validProof,
        pi_c: ["1"], // length 1 instead of 3
      })
    );
  });
});

describe("claimEntryInputSchema", () => {
  const validProof = {
    pi_a: ["111", "222", "1"],
    pi_b: [
      ["333", "444"],
      ["555", "666"],
      ["1", "0"],
    ],
    pi_c: ["777", "888", "1"],
    protocol: "groth16" as const,
    curve: "bn128",
  };

  const validNullifier = "9876543210123456789";
  const validEpoch = "202506";
  const validAmount = "50000000";

  const validEntry = {
    employeeId: 1,
    employeeName: "Alice",
    nullifier: validNullifier,
    amountStroops: validAmount,
    proof: validProof,
    publicSignals: [validNullifier, validEpoch, validAmount],
  };

  it("accepts valid claim entry where signals match nullifier and amountStroops", () => {
    const parsed = claimEntryInputSchema.parse(validEntry);
    assert.equal(parsed.employeeName, "Alice");
    assert.equal(parsed.publicSignals.length, CLAIM_PUBLIC_SIGNALS_COUNT);
    assert.equal(parsed.publicSignals[0], validNullifier);
    assert.equal(parsed.publicSignals[2], validAmount);
  });

  it("rejects omitted or malformed proof", () => {
    const entryMissingProof = { ...validEntry } as Record<string, unknown>;
    delete entryMissingProof.proof;
    assert.throws(() => claimEntryInputSchema.parse(entryMissingProof));

    assert.throws(() =>
      claimEntryInputSchema.parse({
        ...validEntry,
        proof: "not-a-proof-object",
      })
    );

    assert.throws(() =>
      claimEntryInputSchema.parse({
        ...validEntry,
        proof: null,
      })
    );
  });

  it("rejects publicSignals with != 3 elements", () => {
    assert.throws(() =>
      claimEntryInputSchema.parse({
        ...validEntry,
        publicSignals: [validNullifier, validAmount], // 2 elements
      })
    );

    assert.throws(() =>
      claimEntryInputSchema.parse({
        ...validEntry,
        publicSignals: [validNullifier, validEpoch, validAmount, "extra"], // 4 elements
      })
    );

    assert.throws(() =>
      claimEntryInputSchema.parse({
        ...validEntry,
        publicSignals: [], // empty
      })
    );
  });

  it("rejects non-decimal integer strings in nullifier, amountStroops, and publicSignals", () => {
    assert.throws(() =>
      claimEntryInputSchema.parse({
        ...validEntry,
        nullifier: "invalid_nullifier",
      })
    );

    assert.throws(() =>
      claimEntryInputSchema.parse({
        ...validEntry,
        amountStroops: "-100",
      })
    );

    assert.throws(() =>
      claimEntryInputSchema.parse({
        ...validEntry,
        publicSignals: [validNullifier, "not_a_number", validAmount],
      })
    );
  });

  it("rejects bundle when publicSignals[2] does not match amountStroops", () => {
    assert.throws(
      () =>
        claimEntryInputSchema.parse({
          ...validEntry,
          amountStroops: "50000000",
          publicSignals: [validNullifier, validEpoch, "60000000"], // mismatch
        }),
      (err: Error) => {
        assert.match(err.message, /publicSignals\[2\] .* does not match amountStroops/);
        return true;
      }
    );
  });

  it("rejects bundle when publicSignals[0] does not match nullifier", () => {
    assert.throws(
      () =>
        claimEntryInputSchema.parse({
          ...validEntry,
          nullifier: validNullifier,
          publicSignals: ["1111111111", validEpoch, validAmount], // mismatch
        }),
      (err: Error) => {
        assert.match(err.message, /publicSignals\[0\] .* does not match nullifier/);
        return true;
      }
    );
  });
});

describe("createEpochSchema integration", () => {
  const validProof = {
    pi_a: ["111", "222", "1"],
    pi_b: [
      ["333", "444"],
      ["555", "666"],
      ["1", "0"],
    ],
    pi_c: ["777", "888", "1"],
    protocol: "groth16" as const,
    curve: "bn128",
  };

  const validNullifier = "9876543210123456789";
  const validAmount = "50000000";

  it("validates full epoch creation payload with nested claimEntries", () => {
    const payload = {
      epoch: 1,
      employerWallet: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      totalPayroll: "50000000",
      claimEntries: [
        {
          employeeId: 1,
          employeeName: "Alice",
          nullifier: validNullifier,
          amountStroops: validAmount,
          proof: validProof,
          publicSignals: [validNullifier, "1", validAmount],
        },
      ],
    };

    const parsed = createEpochSchema.parse(payload);
    assert.equal(parsed.epoch, 1);
    assert.equal(parsed.claimEntries.length, 1);
  });
});

import { serializeClaimEntry } from "../src/routes/epochs";
import { HttpError } from "../src/middleware/errorHandler";
import type { ClaimEntry } from "@prisma/client";

describe("serializeClaimEntry defensive parsing", () => {
  const mockDbEntry: ClaimEntry = {
    id: 1,
    epochId: 10,
    employeeId: 1,
    employeeName: "Alice",
    nullifier: "12345",
    amountStroops: "50000000",
    proof: JSON.stringify({ pi_a: ["1", "2", "3"] }),
    publicSignals: JSON.stringify(["12345", "1", "50000000"]),
    claimed: false,
    claimedAt: null,
    claimTxHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("deserializes proof and publicSignals into deep-equal objects", () => {
    const serialized = serializeClaimEntry(mockDbEntry);
    assert.deepEqual(serialized.proof, { pi_a: ["1", "2", "3"] });
    assert.deepEqual(serialized.publicSignals, ["12345", "1", "50000000"]);
    assert.equal(serialized.employeeName, "Alice");
  });

  it("throws HttpError 500 when proof in database is corrupt JSON", () => {
    const corruptEntry = { ...mockDbEntry, proof: "corrupt{json" };
    assert.throws(
      () => serializeClaimEntry(corruptEntry),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as HttpError).status, 500);
        assert.match((err as HttpError).message, /Corrupt claim entry 1: invalid proof JSON/);
        return true;
      }
    );
  });

  it("throws HttpError 500 when publicSignals in database is corrupt JSON", () => {
    const corruptEntry = { ...mockDbEntry, publicSignals: "corrupt[signals" };
    assert.throws(
      () => serializeClaimEntry(corruptEntry),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as HttpError).status, 500);
        assert.match((err as HttpError).message, /Corrupt claim entry 1: invalid publicSignals JSON/);
        return true;
      }
    );
  });
});
