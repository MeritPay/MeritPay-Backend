# MeritPay — Privacy-Preserving, Merit-Based Payroll with Zero-Knowledge Proofs on Stellar

**Hackathon:** Stellar Hacks: Real-World ZK
**Category:** Real-World ZK Application on Stellar Soroban
**Status:** Fully deployed and functional on Stellar Testnet

---

## One-Line Summary

MeritPay is a zero-knowledge payroll system on Stellar where employees prove performance-based bonuses privately, a Groth16 proof batch-verifies the entire payroll on-chain via Soroban, and each employee claims their salary individually through a second ZK proof — without revealing any salary, KPI, or bonus data.

---

## The Problem

Performance-based pay is standard across every industry — remote teams, DAOs, fintech startups, and enterprises all tie compensation to measurable outcomes. But putting performance-linked payroll on-chain creates a fundamental privacy failure:

- Every employee's base salary is permanently visible on the block explorer
- KPI scores (hours worked, sales figures, targets hit) expose confidential business performance
- Bonus calculations reveal the company's internal compensation rules
- Competitors, colleagues, and arbitrageurs can read the entire payroll table

The result: organizations avoid on-chain payroll entirely, losing the auditability, automation, and trustlessness that blockchain uniquely offers.

**The tension is irresolvable without cryptography:** you need to prove a computation is correct without revealing the inputs that drove it.

---

## The Solution

MeritPay resolves this tension with four Circom circuits, two deployed Groth16 verifier contracts on Stellar Soroban, and a two-step payroll protocol:

1. **Employees prove KPI performance privately.** Each employee's hours worked and sales flag are fed into the `KPIProof` circuit locally in the browser. The circuit outputs a Poseidon commitment hash and boolean results (`hoursMet`, `salesMet`) — no raw numbers leave the device.

2. **The employer aggregates without seeing raw data.** The `PayrollAggregator(5)` circuit combines all five employee KPI commitments with base salaries and computes the correct bonus-adjusted payout for each employee. The circuit proves the entire payroll batch is arithmetically correct. A single Groth16 proof represents the full payroll computation.

3. **On-chain batch verification releases escrow.** The employer submits the proof to the `payroll` Soroban contract, which calls the `groth16_verifier` contract to check the BN254 pairing equations using Stellar's native host functions. If valid, nullifiers are marked spent and the total XLM is transferred to the `claim` contract as escrow.

4. **Each employee claims individually with a private proof.** The employee generates a `ClaimPayout` Groth16 proof in their browser — proving they own the nullifier from the executed batch and that the claimed amount matches the bonus formula — and submits it. The claim contract verifies, checks the nullifier was spent in the batch, and transfers XLM directly to the employee's wallet.

---

## What Makes This Genuinely Novel

Most "private payroll" hackathon submissions hide the total amount. MeritPay does three things that are architecturally distinct:

### 1. Provably Correct Performance-Linked Bonus Computation

The `PayrollAggregator` circuit enforces the bonus formula at the constraint level:

```
bonusRate = hoursMet × 20 + salesMet × 10
bonus × 100 = baseSalary × bonusRate   (R1CS constraint — no floats, no approximation)
payout = baseSalary + bonus
```

This means an employer **cannot** manipulate a bonus without invalidating the proof. The employee does not need to trust the employer's calculation — it is cryptographically enforced. This is not attestation or a signed statement; it is a zero-knowledge proof of correct computation over private inputs.

### 2. Nullifier-Based Anti-Replay Across Two Contract Boundaries

Each employee's nullifier is computed inside the circuit as `Poseidon(employeeId, payrollEpoch, salt)`. The payroll contract marks batch nullifiers as spent. The claim contract queries the payroll contract (`is_nullifier_spent`) before accepting a claim proof. The same nullifier therefore prevents both:
- Batch replay: the employer cannot re-execute the same payroll
- Claim replay: the employee cannot double-claim the same payout

This nullifier scheme works across two separate Soroban contracts through a cross-contract call, not a shared storage slot.

### 3. Selective Auditor Disclosure Without Individual Exposure

The `AuditorDisclosure(5)` circuit proves `totalPayroll ≤ budget` and `sum(individualPayouts) = totalPayroll` without revealing any single employee's salary. An auditor receives a cryptographic budget-compliance guarantee — not a signed attestation, not an aggregated average — while seeing zero individual data. This is the ZK primitive that makes the system regulator-friendly.

---

## Technical Architecture

### Circuits (Circom 2.0 + Groth16 / BN254)

| Circuit | Wires | Public Signals | Purpose |
|---|---|---|---|
| `kpi.circom` | 1,195 | 5 | Per-employee KPI commitment + boolean outputs |
| `payroll_aggregator.circom` | 10,903 | 17 | Batch bonus computation, nullifiers, total |
| `auditor_disclosure.circom` | 430 | 2 | Budget compliance without individual data |
| `claim.circom` | 968 | 3 | Individual payout proof (nullifier + amount) |

The `payroll_aggregator` circuit requires 7,065 R1CS constraints, exceeding the `pot12` Powers of Tau limit (4,096). MeritPay uses `pot14` (16,384 capacity) for this circuit specifically — a non-trivial setup detail that most submissions skip.

**Proof serialisation:** All Groth16 proofs are serialised to 256 bytes in the wire format expected by the Soroban BN254 host functions: `pi_a.x(32) | pi_a.y(32) | pi_b.x_im(32) | pi_b.x_re(32) | pi_b.y_im(32) | pi_b.y_re(32) | pi_c.x(32) | pi_c.y(32)`. Public signals are packed as `Vec<BytesN<32>>` big-endian field elements.

### Smart Contracts (Rust / Soroban)

**`groth16_verifier`** — Deployed twice (once per verification key). Stores a serialised VK on-chain via `set_vk`. Exposes `verify(proof_bytes, public_signals) → bool` using Stellar's native `bn254` host functions for G1/G2 point arithmetic and optimal Ate pairing. This is what makes ZK on Stellar viable at production cost.

**`payroll`** — Admin-controlled. Holds an XLM pool. `execute_payroll` calls the verifier, rejects spent nullifiers, records all five batch nullifiers as spent, and transfers the total XLM escrow to the claim contract. Emits a `get_epoch()` counter that increments per execution.

**`claim`** — Permissionless per employee. `claim_payout` calls the claim verifier, checks the nullifier was spent in the payroll contract, asserts `public_signals[2] == amount` (both in stroops, ensuring the proof's committed amount matches the transfer), calls `recipient.require_auth()`, and executes `token.transfer`.

### Deployed Contracts — Stellar Testnet

| Contract | Address |
|---|---|
| Groth16 Verifier (Payroll VK) | `CDMQQPQKM3TXTHG4ZB3QXTTWTBMQOTDKXD6YIATFU7LSQ4QPVDRD5UND` |
| Groth16 Verifier (Claim VK) | `CDKBWRCIWQUP3QM7QUFCOISMNF4LMKZYP5PLXRQ7RL4VGA2RXSBIDBU2` |
| Payroll Contract | `CCIILMFAZLADBR37JZNDOFIQVKOXLIPUHD23CP7CIYZ6VXVRNL2M6EI3` |
| Claim Contract | `CBICM2NFLOY4DMEPFFQBIOXNZNZ2UKI4VIBJ4LTYWHE3H6RZGTD2Q6SI` |
| Deployer | `GAO5NNZVKTORYRUR6E4XH43DFNGIVNDL7UCLDCOYUZITFXZSCC4RW2YX` |
| Deployed | 2026-07-01 |

All four contracts are live. Verification keys are uploaded. The payroll pool is funded with XLM. The full demo flow executes end-to-end on Testnet.

### Frontend (Next.js 16 + snarkjs)

All proof generation runs entirely in the browser using snarkjs WASM. No proving server. No private data leaves the device. The frontend communicates with Stellar Soroban via `@stellar/stellar-sdk` and signs transactions through the Freighter wallet extension.

---

## Two-Step Payroll Protocol

The separation of batch verification from individual payout is the core privacy design:

```
Step 1 — Employer executes payroll:
  Browser: generatePayrollProof() → 256-byte Groth16 proof
  On-chain: payroll.execute_payroll(proof, signals, nullifiers, total)
    → groth16_verifier.verify() → true
    → nullifiers[0..4] marked spent
    → total XLM transferred to claim contract escrow

Step 2 — Employee claims salary:
  Browser: generateClaimProof() → 256-byte Groth16 proof
  On-chain: claim.claim_payout(recipient, proof, signals, nullifier, amount)
    → claim_verifier.verify() → true
    → payroll.is_nullifier_spent(nullifier) → true
    → public_signals[2] == amount (stroops)
    → recipient.require_auth()
    → token.transfer(claim_contract, employee_wallet, amount)
```

What appears on-chain for each employee claim: a nullifier hash, a payroll epoch number, and an amount in stroops. No name, no base salary, no bonus breakdown, no KPI data.

---

## ZK Stack Alignment with Stellar Hacks Theme

This submission directly addresses every dimension of the **Real-World ZK** hackathon criteria:

**Real-world problem:** Performance-linked payroll privacy is a genuine, unsolved problem for DAOs, remote-first companies, and Stellar-native businesses using stablecoins. The inability to prove fair compensation without revealing confidential data is a documented blocker for on-chain HR adoption.

**Zero-knowledge proof depth:** Four custom Circom circuits. Groth16 over BN254. Integer-safe bonus arithmetic in R1CS. Poseidon-based nullifiers. Two independent proof verification steps. Selective auditor disclosure. This is not a sum-hiding wrapper around a single circuit.

**Stellar Soroban integration:** The entire verification and fund-release mechanism is on Soroban. The BN254 pairing check runs in the Soroban host environment using Stellar's native host functions — the contract does not simulate elliptic curve arithmetic in Rust; it calls host-provided builtins, which is the correct and efficient way to do ZK on Stellar. The XLM token movement is native SEP-41.

**End-to-end completeness:** Circuits are compiled with real trusted setup. Verification keys are deployed to live contracts. The frontend generates real Groth16 proofs in WASM, submits real transactions, and employees receive real XLM in their wallets. The demo is not simulated.

---

## Demo Flow (End-to-End, ~3 Minutes)

1. **Employer Dashboard** (`/employer`) — Configure up to 5 employees with name, base salary (XLM), hours threshold, and bonus rates. Fund the payroll pool from Freighter wallet.

2. **Verify Dashboard** (`/verify`) — Generate KPI proofs for all employees (browser, ~5s each). Generate the aggregated payroll proof (~15s). Connect the admin wallet. Click **Execute Payroll on Stellar** — Freighter prompts, transaction submitted, on-chain proof verified, escrow moved.

3. **Employee Portal** (`/employee`) — Employee selects their name from the published claim bundle. Pastes their wallet address or connects Freighter. Clicks **Claim Salary** — claim proof generates (~10s), Freighter prompts the employee to sign, XLM lands in wallet. A Stellar Expert link confirms the transfer.

4. **Auditor Tab** (`/auditor`) — Enter a budget. Generate an auditor disclosure proof. Verify total payroll is within budget — no individual salaries revealed.

---

## What's Live vs MVP Scope

| Feature | Status |
|---|---|
| KPI circuit (kpi.circom) | Live — browser proof generation |
| Payroll aggregator circuit | Live — 5-employee batch |
| Claim circuit | Live — individual private withdrawal |
| Auditor disclosure circuit | Live — budget compliance proof |
| Groth16 verifier contract | Live — Stellar Testnet |
| Payroll contract | Live — Stellar Testnet |
| Claim contract | Live — Stellar Testnet |
| Freighter signing | Live |
| End-to-end demo | Live and tested |
| KPI data from real HR source | MVP: randomly generated per epoch |
| Multi-party trusted setup | MVP: single contributor (hackathon) |
| >5 employees | MVP: fixed circuit size |

---

## Repository and Links

- **GitHub:** [github.com/Samuel1505/MeritPay](https://github.com/Samuel1505/MeritPay)
- **Live App:** [meritpay.vercel.app](#)
- **Payroll Contract (Stellar Expert):** [stellar.expert/explorer/testnet/contract/CCIILMFAZLADBR37JZNDOFIQVKOXLIPUHD23CP7CIYZ6VXVRNL2M6EI3](https://stellar.expert/explorer/testnet/contract/CCIILMFAZLADBR37JZNDOFIQVKOXLIPUHD23CP7CIYZ6VXVRNL2M6EI3)
- **Claim Contract (Stellar Expert):** [stellar.expert/explorer/testnet/contract/CBICM2NFLOY4DMEPFFQBIOXNZNZ2UKI4VIBJ4LTYWHE3H6RZGTD2Q6SI](https://stellar.expert/explorer/testnet/contract/CBICM2NFLOY4DMEPFFQBIOXNZNZ2UKI4VIBJ4LTYWHE3H6RZGTD2Q6SI)

---

## Tech Stack

| Layer | Technology |
|---|---|
| ZK circuits | Circom 2.0 + circomlib (Poseidon) |
| Proof system | Groth16 — snarkjs 0.7 |
| Elliptic curve | BN254 (pairing-friendly, native Stellar host support) |
| On-chain verification | Stellar Soroban (Rust) — BN254 host functions |
| Blockchain | Stellar Testnet |
| Token | XLM (native, SEP-41) |
| Wallet | Freighter — `@stellar/freighter-api` v4 |
| Stellar SDK | `@stellar/stellar-sdk` v14 |
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 |
| Proof generation | snarkjs WASM in-browser (no proving server) |

---

## Future Roadmap

- **Recursive proofs (Plonky2/Nova):** Aggregate proofs for arbitrarily large organisations without increasing on-chain verification cost, removing the 5-employee circuit limit.
- **RISC Zero integration:** Replace Circom for complex payroll rules (tax brackets, PTO accrual, multi-currency) that are impractical in R1CS without specialised gadgets.
- **On-chain KPI oracle:** Integrate Stellar's oracle infrastructure to bring signed HR attestations on-chain, replacing the simulated KPI inputs.
- **Multi-party trusted setup:** Run a production Powers of Tau ceremony with public verifiability and diverse participants, replacing the hackathon single-contributor setup.
- **Stablecoin settlement:** Use Stellar path payments to settle payroll in USDC or other SEP-41 assets while keeping ZK verification on Soroban.
- **Cross-company payroll audits:** Allow external auditors to verify budget compliance across multiple organisations on the same verifier infrastructure.
