# Gate 2 Functional Coherence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Test whether clipped SlipNSlide proposals that are incoherent in parameter space become coherent when represented by their actual two-terrain rollout effects, and use that functional cluster to trigger structural growth without changing Gate 1.

**Architecture:** Gate 1 remains frozen. Gate 2 adds a parallel experiment runner that uses the same seed, schedule, proposal stream, collision budget, scale bank, residual norm threshold, coherence threshold, and growth predicate. The only gating change is that coherence is computed from canonical `[DeltaH_G, DeltaH_I]` effect vectors. If growth fires, the second route is initialized from the unresolved parameter proposal whose effect vector is most representative of the recent functional cluster, never from an average of parameter vectors.

**Tech Stack:** Static ES modules, Node 20 built-in test runner, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-12-slip-n-slide-design.md`

## Global Constraints

- Gate 1 source constants and frozen `results/seed23.json` must remain byte-for-byte unchanged.
- Gate 2 reference seed is 23.
- Gate 2 reuses `proposalCount=24`, `proposalSigma=0.075`, `minImprovement=0.002`, `collisionBudget=0.085`, `growthThreshold=0.58`, `coherenceWindow=3`, `minCoherence=0.42`, `minClippedForGrowth=2`, and the same `G G G G I I I I G I G I G I` schedule.
- Terrain identity is experiment-harness information only; it never enters controller observations or gate inputs.
- The first seed-23 Gate 2 outcome is frozen whether PASS or FAIL.

---

### Task 1: Functional effect geometry

**Files:**
- Create: `src/functional.js`
- Create: `tests/functional.test.js`

**Interfaces:**
- `functionalEffectVector(baseController, acceptedController, fullController, options?) -> Float64Array`
- `functionalCoherence(history) -> number`
- `representativeResidual(entries) -> { index, residual, similarity }`

- [ ] Write tests showing the effect vector has stable `[G,I]` coordinates, identical effects have cosine coherence near 1, sign-opposed effects are incoherent, and the representative selector chooses the residual whose effect is closest to the cluster centroid.
- [ ] Run `npm test` and verify the new tests fail because `src/functional.js` does not exist.
- [ ] Implement the three pure functions with no Gate 1 modifications.
- [ ] Run `npm test` and verify all tests pass.

### Task 2: Matched Gate 2 runner

**Files:**
- Create: `src/gate2.js`
- Create: `tests/gate2.test.js`

**Interfaces:**
- `runGate2(seed=23) -> result object`

Gate 2 must replay the same ordinary arm and a new functional-coherence arm. On each clipped proposal it stores both the unresolved parameter residual and the canonical functional effect of the unresolved portion from the accepted controller to the full proposed controller. Growth uses `functionalCoherence` over the same 3-event window, while norm remains the cumulative parameter residual norm. On growth, `representativeResidual` chooses the actual unresolved parameter edit used by `growResidualRoute`.

- [ ] Write tests asserting deterministic replay, same proposal stream hashes as Gate 1 until structure differs, no terrain label in controller observations, no growth below the existing thresholds, and growth metadata names the functional coherence and representative event if growth occurs.
- [ ] Verify tests fail before `src/gate2.js` exists.
- [ ] Implement the runner without editing `src/experiment.js` or Gate 1 results.
- [ ] Run all tests.

### Task 3: Freeze the first result

**Files:**
- Create: `scripts/run-gate2.js`
- Create: `results/gate2-seed23.json`
- Create: `GATE2_RESULTS.md`
- Create: `tests/gate2-result.test.js`
- Modify: `package.json`
- Modify: `.github/workflows/test.yml`

- [ ] Add a deterministic result command `npm run gate2 -- 23`.
- [ ] Run it once after all mechanism tests are green and save the untouched output.
- [ ] Write the receipt from that output, including both parameter coherence and functional coherence at every clipped event and the exact growth trigger if any.
- [ ] Add a test that regenerates seed 23 and deep-compares it with the frozen JSON.
- [ ] CI regenerates Gate 1 and Gate 2 receipts and fails on any diff.

### Task 4: Extend the site without rewriting Gate 1

**Files:**
- Modify: `index.html`
- Modify: `src/ui.js`
- Modify: `styles.css`
- Modify: `tests/site.test.js`

- [ ] Add a Gate 2 result section/toggle preserving the existing Gate 1 view.
- [ ] Display parameter coherence and functional coherence side-by-side, the representative residual event, growth state, and Gate 2 predeclared verdict.
- [ ] If Gate 2 fails, display FAIL prominently; no success-only animation.
- [ ] Run all tests and verify the static page imports only committed modules/results.

### Task 5: Final verification and PR

- [ ] Run `npm test`.
- [ ] Run `npm run result -- 23` and verify Gate 1 frozen receipt has no diff.
- [ ] Run `npm run gate2 -- 23` and verify Gate 2 frozen receipt has no diff.
- [ ] Wait for GitHub Actions on the branch to pass.
- [ ] Open a PR with the bounded claim supported by the frozen Gate 2 outcome.
