# Gate 3 Earned Responsibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Determine why Gate 2's correctly triggered second route failed to become useful by testing gate-only routing, route-1 specialization, and counterfactual responsibility under the frozen seed-23 schedule.

**Architecture:** Gate 2 remains unchanged through its first 1→2 growth event. From that exact grown controller, three deterministic post-growth arms receive matched proposal budgets with increasingly permissive edit masks: gate only; route 1 plus gate; and route 1 plus a gate trained from measured counterfactual route advantage. Terrain labels are never controller inputs or gate targets.

**Tech Stack:** Browser/Node ES modules, Float64Array, Node `node:test`, deterministic seeded evolutionary search.

**Spec:** `GATE2_RESULTS.md` (frozen Gate-2 failure and claim boundary), plus the approved Gate-3 bounded design in this conversation.

## Global Constraints

- Keep seed `23`, schedule `G G G G I I I I G I G I G I`, physics, reward, collision budget `0.085`, Gate-2 growth trigger, and Gate-2 frozen receipt unchanged.
- No ICE/GRAVEL label may enter the controller, gate, candidate generator, or responsibility target.
- Gate 3 starts from the exact Gate-2 controller immediately after its first growth event; it must not re-run a modified growth rule.
- All candidate scores and counterfactual responsibility scores come from real deterministic rollouts.
- Gate-3 success requires: two routes, gate separation ≥ existing `CONFIG.gateSeparationMin` (`0.05`), and alternating-tail mean ≥ ordinary alternating-tail mean + existing `CONFIG.successMargin` (`0.04`).
- Evaluate the three arms in the fixed order `gateOnly`, `specialist`, `responsibility`; freeze the first seed-23 result before changing any constant.
- If no arm passes, write `GATE3_RESULTS.md`, freeze `results/gate3-seed23.json`, update README with the negative conclusion, and stop. Do not polish the HTML sim.
- If an arm passes, freeze the receipt first, then expose only the passing mechanism in the existing HTML sim with live route/gate responsibility traces.

---

### Task 1: Edit masks and forced-route counterfactuals

**Files:**
- Modify: `src/controller.js`
- Modify: `src/search.js`
- Create: `tests/gate3-mechanics.test.js`

**Interfaces:**
- Produces: `controllerSlices(controller)` returning index ranges for route 0, route 1, and gate in the flattened vector.
- Produces: `maskedProposalBatch(controller, rng, count, sigma, mask)` returning deterministic deltas with zero outside the named slices.
- Produces: `evaluateForcedRoute(controller, terrain, routeIndex, options={})` using the same physics/reward rollout while forcing one route's motor output and preserving ordinary recurrent state evolution.

- [ ] **Step 1: Write failing tests** asserting gate-only deltas touch only gate indices, specialist deltas touch only route-1+gate indices, masks reproduce deterministically, and forced-route evaluation produces finite real rollout scores without terrain entering controller observations.
- [ ] **Step 2: Run** `npm test` and confirm the new tests fail because the interfaces do not exist.
- [ ] **Step 3: Implement** flatten-index slices in `controller.js`, masked deterministic proposals in `search.js`, and forced-route rollout evaluation using controller route outputs rather than terrain labels.
- [ ] **Step 4: Run** `npm test` and require all tests green.
- [ ] **Step 5: Commit** `feat: add Gate 3 edit masks and counterfactual route probes`.

### Task 2: Gate-3 three-arm experiment

**Files:**
- Create: `src/gate3.js`
- Create: `tests/gate3.test.js`

**Interfaces:**
- Consumes: Gate-2 deterministic event stream and grown controller semantics; Task-1 masks and forced-route evaluation.
- Produces: `runGate3(seed=CONFIG.seed)` with `{gateOnly, specialist, responsibility, ordinary, criteria, verdict, events}`.
- Produces per arm: final gravel/ice score, alternating-tail mean, gateG, gateI, gateSeparation, accepted/rejected writes, route count, and responsibility diagnostics.

- [ ] **Step 1: Write failing tests** requiring Gate 3 to reproduce Gate 2 exactly up to and including the first growth event; all three arms must start from byte-identical flattened grown controllers.
- [ ] **Step 2: Add failing tests** requiring matched proposal seeds/budgets after growth, gate-only edits to leave both route parameter blocks unchanged, and specialist edits to leave route 0 unchanged.
- [ ] **Step 3: Add failing tests** for responsibility targets: at each post-growth episode compute both forced-route rollout scores from the current physical controller state; define signed route advantage `a = score(route1)-score(route0)`; fit/select gate-only candidates by ordinary task reward plus a fixed, predeclared responsibility agreement term derived from `a`, never from terrain identity.
- [ ] **Step 4: Run** `npm test` and confirm red.
- [ ] **Step 5: Implement** `runGate3` by running Gate 2 until first growth, cloning that controller three times, then continuing only the remaining frozen schedule with the three edit policies. Keep candidate count/sigma and proposal seeds matched wherever dimensionality permits by generating full-length deltas then masking them.
- [ ] **Step 6: Use a frozen responsibility objective**: gate candidate score = ordinary rollout score + `0.08 * responsibilityAgreement`, where agreement is the mean over rollout states of `tanh(4*a) * (2*gate-1)` using the measured forced-route advantage sign/magnitude. Record both raw task reward and responsibility term; no retuning after seed 23 is seen.
- [ ] **Step 7: Run** `npm test`; require determinism and Gate-2-prefix identity tests green.
- [ ] **Step 8: Commit** `feat: add Gate 3 earned responsibility arms`.

### Task 3: Freeze seed-23 result and branch on outcome

**Files:**
- Create: `scripts/run-gate3.js`
- Modify: `package.json`
- Create after first run: `results/gate3-seed23.json`
- Create: `tests/gate3-result.test.js`

**Interfaces:**
- Produces: `npm run gate3 -- 23` deterministic receipt.

- [ ] **Step 1: Write failing receipt tests** requiring the committed JSON to equal fresh `runGate3(23)` output and requiring explicit per-arm PASS/FAIL criteria.
- [ ] **Step 2: Add** package script `"gate3": "node scripts/run-gate3.js"` and result writer.
- [ ] **Step 3: Run** `npm run gate3 -- 23` exactly once for the decision-making receipt and commit that exact JSON without changing constants afterward.
- [ ] **Step 4: Run** `npm test` and `npm run gate3 -- 23`; verify regeneration is byte-for-byte stable.
- [ ] **Step 5: Commit** `test: freeze Gate 3 seed-23 receipt`.

### Task 4A: If all three Gate-3 arms fail — finish with write-up

**Files:**
- Create: `GATE3_RESULTS.md`
- Modify: `README.md`
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: Write** the measured failure chain for each arm, identifying the earliest stage that fails: selector discovery, specialist acquisition, or counterfactual responsibility.
- [ ] **Step 2: State explicitly** that Gate 1 found collision without growth; Gate 2 fixed growth geometry but not routing; Gate 3 tested responsibility and still failed if applicable. Do not claim a working architecture.
- [ ] **Step 3: Extend CI** to run `npm run gate3 -- 23` and `git diff --exit-code -- results/gate3-seed23.json` while preserving Gate 1 and Gate 2 receipt checks.
- [ ] **Step 4: Run** the full suite and receipt regeneration.
- [ ] **Step 5: Commit** `docs: conclude Gate 3 negative result`.

### Task 4B: If any Gate-3 arm passes — expose the working mechanism in HTML

**Files:**
- Modify: `index.html`
- Modify: `src/ui.js`
- Modify: `styles.css`
- Modify: `tests/site.test.js`
- Modify: `README.md`
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: Write failing site tests** requiring a separate Gate-3 section, live route-0/route-1 forced scores, live gate value, responsibility advantage, and PASS/FAIL criteria computed from `runGate3`, not hard-coded numbers.
- [ ] **Step 2: Implement** only the passing arm in the visual sim; show the exact episode where growth occurs and subsequent state-dependent route responsibility without exposing terrain to the controller.
- [ ] **Step 3: Keep Gate 1 and Gate 2 sections visible** as historical failures; Gate 3 must not overwrite earlier receipts.
- [ ] **Step 4: Extend CI** with Gate-3 receipt regeneration/diff protection.
- [ ] **Step 5: Run** `npm test`, regenerate all receipts, and commit `feat: visualize working Gate 3 responsibility`.

## Self-review

- Spec coverage: frozen Gate-2 prefix, three post-growth arms, no terrain-label cheat, matched proposal budget, explicit success criteria, conditional HTML/write-up path, and frozen receipts are all assigned to tasks.
- Placeholder scan: no TBD/TODO steps remain.
- Type consistency: flattened masks are shared by search and tests; `runGate3` is the single receipt/UI entry point; `evaluateForcedRoute` is the only counterfactual responsibility probe.
