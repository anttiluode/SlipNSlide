# SlipNSlide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-free GitHub Pages experiment that compares an ordinary single-route evolutionary controller with a ThirdWay-inspired controller using finite-rollout compatibility checks, signed residual carry, and residual-triggered recurrent route growth in a hidden-terrain slip-and-grip robot world.

**Architecture:** Pure ES modules separate deterministic PRNG/config, physics, controller, search, compatibility/growth, experiment orchestration, and UI. The browser and Node tests import the same simulation modules. Both learner arms consume matched seeded candidate streams; only their acceptance policies differ.

**Tech Stack:** HTML, CSS, modern JavaScript ES modules, Node 20+ built-in test runner, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-12-slip-n-slide-design.md`

## Global Constraints

- No external runtime dependencies.
- Frozen evaluation seed: `23`.
- Controller input never includes terrain identity.
- Default schedule: `G G G G I I I I G I G I G I`.
- Every candidate score comes from a deterministic rollout.
- Compatibility is finite-rollout response displacement, not parameter distance.
- Residual decay is fixed at `beta = 1.0` for Gate 1.
- Growth is triggered only by residual norm + directional coherence + repeated clipping, never by terrain or episode number.
- Same-seed reset must reproduce the full experiment.
- Failure remains visible; no post-result threshold retuning.

---

### Task 1: Deterministic Core and Physics

**Files:**
- Create: `package.json`
- Create: `src/config.js`
- Create: `src/prng.js`
- Create: `src/physics.js`
- Create: `tests/core.test.js`

**Interfaces:**
- `makeRng(seed:number) -> {next(), normal(), state()}`
- `terrainParams(kind:'G'|'I') -> object`
- `initialState() -> {x,v,omega,phi,uPrev}`
- `observe(state,targetV) -> number[5]`
- `stepPhysics(state,u,terrain,dt) -> {state, slip, traction, energy}`
- `rollout(controller, terrain, options) -> trajectory/result`

- [ ] Write failing tests proving PRNG reproducibility, terrain label absence from observations, deterministic rollout, and that high command can reduce traction on ice while gravel tolerates a higher-slip optimum.
- [ ] Run `npm test` and verify those tests fail because modules do not yet exist.
- [ ] Implement frozen constants in `src/config.js`, seeded xorshift-style PRNG, nonlinear bell-shaped traction curves, deterministic fixed-step dynamics, common reward terms, and rollout recording.
- [ ] Run `npm test` and verify Task 1 passes.
- [ ] Commit `feat: add deterministic slip-and-grip physics`.

### Task 2: Recurrent Controller and Structural Growth Representation

**Files:**
- Create: `src/controller.js`
- Create: `tests/controller.test.js`

**Interfaces:**
- `createController(rng) -> controller`
- `cloneController(controller)`
- `flattenController(controller) -> Float64Array`
- `applyFlatDelta(controller, delta, scale=1)`
- `runControllerStep(controller, obs, memory) -> {u, gate, memory}`
- `growResidualRoute(controller, residual) -> controller`

Controller shape is one recurrent route initially; grown shape adds route 1 plus a sigmoid gate computed only from the same observation vector and internal route states.

- [ ] Write failing tests proving terrain never appears in controller input, flatten/apply/clone are deterministic, one-route output is bounded, and growth creates a second route initialized deterministically from residual coordinates without terrain lookup.
- [ ] Run targeted tests and verify failure.
- [ ] Implement an 8-unit tanh recurrent route, tanh motor head, optional second route, and neutral/small observation-driven gate.
- [ ] Run targeted tests and full `npm test`.
- [ ] Commit `feat: add recurrent controller with residual route growth`.

### Task 3: Matched Evolutionary Proposal Stream

**Files:**
- Create: `src/search.js`
- Create: `tests/search.test.js`

**Interfaces:**
- `proposalBatch(baseController, rng, count, sigma) -> Float64Array[]`
- `scoreProposal(controller, delta, terrain, rolloutOptions) -> score/result`
- `bestProposal(...) -> {id, delta, baseScore, candidateScore, improvement, candidateScores}`

- [ ] Write failing tests showing two learners initialized from the same seed receive byte-identical candidate deltas before acceptance diverges; every candidate has an actual rollout score; and a non-improving batch returns no commit proposal.
- [ ] Run tests and verify failure.
- [ ] Implement fixed-budget Gaussian perturbations over the current flattened parameter vector and deterministic target-terrain scoring.
- [ ] Run targeted and full tests.
- [ ] Commit `feat: add matched evolutionary proposal search`.

### Task 4: Finite-Rollout Collision, Safe Absorption, and Signed Residual

**Files:**
- Create: `src/compatibility.js`
- Create: `tests/compatibility.test.js`

**Interfaces:**
- `makeAnchor(controller, terrain, probeOptions) -> anchor`
- `responseVector(controller, terrain, probeOptions) -> Float64Array`
- `collisionRms(anchor, candidateController) -> number`
- `selectSafeAlpha(context) -> {alpha, evaluations, collisions}`
- `updateResidual(residual, delta, alpha) -> Float64Array`
- `residualCoherence(history) -> number`
- `shouldGrow({norm, threshold, coherence, minCoherence, clippedCount, minClipped}) -> boolean`

- [ ] Write failing tests for finite-rollout RMS collision, largest-legal-alpha selection over the frozen scale bank, exact signed residual arithmetic, no growth below threshold, no growth above threshold with incoherent residuals, and deterministic growth when all three declared conditions hold.
- [ ] Run tests and verify failure.
- [ ] Implement protected anchors containing hidden, motor, velocity and slip response coordinates; compatible scale search; `R <- R + (1-alpha) delta`; cosine-based recent residual coherence; and frozen growth predicate.
- [ ] Run targeted and full tests.
- [ ] Commit `feat: add compatibility radar and residual growth trigger`.

### Task 5: Two-Arm Frozen Experiment

**Files:**
- Create: `src/experiment.js`
- Create: `tests/experiment.test.js`

**Interfaces:**
- `createExperiment(seed=23) -> experimentState`
- `stepEpisode(experimentState) -> event`
- `runAll(seed=23) -> finalResult`
- `evaluateFinal(controller) -> metrics`

- [ ] Write failing tests that reset seed 23 reproduces the complete event/metric receipt, ordinary and ThirdWay arms share the candidate stream per episode, growth never depends on terrain string, and the result object always contains explicit PASS/FAIL criteria rather than assuming success.
- [ ] Run tests and verify failure.
- [ ] Implement schedule execution, ordinary direct acceptance, ThirdWay protected-anchor update policy, clipping/residual/growth events, route expansion, matched accounting, final gravel/ice/alternating evaluations, and frozen Gate-1 verdict.
- [ ] Run full `npm test` and save the seed-23 deterministic result generated by code, without changing constants based on the outcome.
- [ ] Commit `feat: add frozen two-arm SlipNSlide experiment`.

### Task 6: Browser Visualization and Audit Surface

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `src/ui.js`
- Create: `README.md`
- Create: `tests/site.test.js`

**Interfaces:**
- UI imports only `createExperiment`, `stepEpisode`, `runAll`, and config exports.
- DOM controls: Run/Pause, Step Episode, Reset Same Seed, seed input, speed selector, machinery/audit toggle.

- [ ] Write failing static-contract tests that `index.html` loads ES modules, required controls/audit fields exist, terrain is labelled as viewer-only, and no hard-coded PASS verdict exists in markup.
- [ ] Run tests and verify failure.
- [ ] Build a responsive two-crawler dashboard driven by actual current rollout/event state, SVG/canvas-free CSS robot animation, live metrics, route diagram, traces, machinery cards, full audit JSON/event log, and PASS/FAIL verdict emitted from experiment data.
- [ ] Add README with claim boundary, reproducibility instructions, mechanism summary, and clear statement that T7B previously failed its stronger repair gate.
- [ ] Run `npm test` and a local static-server smoke check.
- [ ] Commit `feat: add auditable SlipNSlide browser demo`.

### Task 7: CI, Result Receipt, and Integration Review

**Files:**
- Modify: `.github/workflows/static.yml`
- Create: `.github/workflows/test.yml`
- Create: `RESULTS.md`

**Interfaces:**
- CI uses Node 20 and runs `npm test` on push/PR.
- Pages deployment continues to publish repository root.

- [ ] Add CI workflow and ensure Pages workflow remains compatible with root `index.html`.
- [ ] Run the frozen seed-23 experiment from Node, copy only its generated metrics/events into `RESULTS.md`, and label the gate PASS or FAIL exactly as computed.
- [ ] Run `npm test` fresh after the receipt is written.
- [ ] Push branch, wait for GitHub Actions, inspect failures if any, and fix only implementation defects—not scientific thresholds.
- [ ] Open a PR to `main` summarizing the frozen result, anti-cheat guarantees, and claim boundary.
