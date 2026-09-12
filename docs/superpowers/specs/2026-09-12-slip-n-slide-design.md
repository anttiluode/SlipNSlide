# SlipNSlide — ThirdWay-inspired slip-and-grip browser experiment

## Goal

Build an auditable static HTML experiment showing whether a ThirdWay-inspired compatibility mechanism can preserve two conflicting control strategies in a minimal robot world better than an ordinary shared controller.

The demo must not hard-code which route is for ice or gravel, must not expose terrain identity to the controller, and must allow the result to fail visibly.

## Scientific question

Can a learner that decomposes proposed recurrent-weight changes into a compatible absorbed component plus a persistent signed residual, and grows a new route only after coherent incompatibility accumulates, preserve both high-traction and low-traction control behaviors better than an ordinary shared recurrent controller trained with the same proposal budget?

This repository is not a claim that ThirdWay T7B already proved repair or structural growth. T7B showed useful signed residual geometry but failed its frozen gate and produced zero genuine repair events. SlipNSlide tests the next stronger mechanism: measured collision, residual carry, and residual-triggered route growth.

## Frozen evaluation protocol

The first complete comparative run is the evaluation. Its default seed is **23**. Once the source containing the constants below is committed, the default seed-23 outcome is not used to tune them. If the gate fails, the site reports failure.

Unit tests may use other seeds and synthetic forced states to verify arithmetic and trigger logic, but they may not be used to optimize the comparative outcome. Physics sanity tests may establish that the two terrains really have different traction optima before the full learner comparison is run.

Frozen first-gate constants:

```text
evaluation seed                 23
episode physics steps           240
dt                              0.025 s
target speed                    1.0
initial route hidden width      4
candidate proposals / episode   20
proposal sigma                  0.08
minimum target improvement      0.002
safe scale bank                 1, .75, .5, .25, .125, 0
protected collision budget C    0.08
signed residual decay beta      1.0
residual growth threshold B     0.09
coherence window                3 nonzero residuals
coherence threshold             0.75
recent clipped-conflict count   2 of last 3 learning episodes
new-route residual RMS cap      0.15
new-route gate bias             -1.5
```

These values are part of the experimental object, not knobs to optimize after observing seed 23.

## Environment

The browser simulates a small 1D crawler moving left-to-right.

State variables:

- body position `x`
- body velocity `v`
- wheel angular velocity `omega`
- chassis pitch proxy `phi`
- previous motor command `u_prev`

Controller observations are exactly five physically plausible normalized values:

1. target-speed error
2. body velocity
3. wheel/body slip ratio
4. previous motor command
5. chassis pitch proxy

The controller never receives a terrain label.

Two hidden terrain regimes exist.

### Gravel

High available traction. Sustained stronger torque is effective and excessive caution causes under-speed/stalling.

### Ice

Low traction with a sharp low-slip peak. Excessive wheel torque increases wheelspin and reduces useful longitudinal traction, so gentler/modulated commands are favored.

## Dynamics

The simulation is deterministic at fixed seed and uses explicit fixed-step dynamics in JavaScript.

Frozen physical constants:

```text
mass m                 1.0
wheel radius r         0.10
wheel inertia I        0.02
normal force N         9.81
max motor torque       1.20
body drag              0.35
wheel damping          0.04
pitch drive            0.35
pitch relaxation       1.8
```

Signed slip is

```math
s = \frac{r\omega-v}{\max(|v|,0.2)}.
```

For each terrain, traction uses a peaked slip curve rather than a force clip. With

```math
q = |s|/s_* ,
```

traction coefficient magnitude is

```math
\mu(s)=\mu_* q\exp(1-q).
```

The longitudinal traction force is `sign(s) * mu(s) * N`.

Frozen terrain parameters:

```text
                mu_peak      slip_peak
gravel             0.90          0.55
ice                0.18          0.08
```

Thus useful traction genuinely falls again after excessive slip, especially on ice. The experiment must include an automated physics test showing distinct gravel/ice optimum command regimes before the learner result is interpreted.

Wheel/body integration:

```text
motor command -> motor torque -> wheel acceleration
wheel speed + body speed -> slip -> terrain traction
traction - drag -> body acceleration -> next body state
```

The pitch proxy is driven by command magnitude and relaxes toward zero. It exists only to give the controller a second dynamical consequence of aggressive actuation; it is not a hidden terrain cue.

This is an intentionally minimal kinematic/dynamic testbed, not a physically complete vehicle simulator.

## Controller

The initial controller contains one recurrent route with hidden width 4:

```text
5 observations -> 4 recurrent hidden units -> motor command
```

Each route has input, recurrent, bias, output, and output-bias parameters. Hidden activation and output use `tanh`.

Initial weights are generated from the seeded PRNG with zero mean and standard deviation 0.18.

When structural growth occurs, the residual-growth learner gains a second width-4 recurrent route plus a gate. The gate receives the same five physical observations plus a bias, never terrain identity.

The motor command becomes

```math
u_t=(1-g_t)u_t^{(0)}+g_tu_t^{(1)},
```

with `g_t = sigmoid(w_g^T o_t + b_g)`.

The ordinary arm remains a one-route network for the entire run.

## Search and proposals

Learning uses seeded evolutionary proposals, not backpropagation.

For every learning episode:

1. Start from the current parameter state.
2. Generate 20 candidate perturbations with proposal RMS scale 0.08 from a keyed deterministic PRNG stream.
3. Simulate each candidate on the current training terrain.
4. Select the candidate with greatest target-terrain reward improvement.
5. If improvement is below 0.002, commit nothing.
6. Otherwise pass the selected `Delta W` to the arm-specific commit policy.

Before structural growth, both arms receive byte-identical candidate perturbations for their common parameter vector. After growth, candidate identity remains keyed by episode/candidate/parameter-role so the common old-route coordinates continue to receive identical proposal values; extra route/gate coordinates exist only in the grown arm. Both arms always receive the same **number of candidates and rollouts** per learning episode.

All candidate scores are stored in the audit log.

## Reward

Every terrain uses the same reward formula. There is no terrain-specific reward shaping.

Per physics step, define:

```math
tracking = \exp(-2|v-v_*|)
progress = \operatorname{clip}(v/v_*,0,1.5)/1.5
slipPenalty = \min(1,|s|/3)
energyPenalty = u^2
stabilityPenalty = \min(1,(\phi/0.5)^2)
```

and

```math
r = tracking
  + 0.25\,progress
  - 0.35\,slipPenalty
  - 0.03\,energyPenalty
  - 0.05\,stabilityPenalty.
```

Episode reward is mean step reward.

## Comparison arms

### Ordinary shared controller

The ordinary learner commits the full best improving proposal whenever it clears the 0.002 improvement threshold.

It has no protected-rollout compatibility test, residual memory, or structural growth.

### ThirdWay-inspired residual-growth controller

The same selected proposal first undergoes compatibility measurement against frozen probe rollouts representing previously accepted behavior.

The experiment harness knows which physical terrain to replay for a protected probe, but that terrain identity never appears in controller observations.

## Protected anchors and causal collision radar

When a terrain first achieves an accepted episode reward at least 0.02 above that terrain's initial untrained reward, freeze a protected probe anchor for it. A later intentional accepted improvement on that same terrain may move its own anchor forward to the newly accepted behavior; collateral edits from another terrain do not move it.

For protected probe `k`, response trajectory `H_k(W)` concatenates normalized samples at every fourth physics step of:

- recurrent hidden state of route 0
- motor output
- body velocity divided by 1.5
- slip divided by 3 and clipped to [-1,1]

For candidate write `W -> W + Delta W`, finite collision is

```math
c_k(\Delta W)=\operatorname{RMS}(H_k(W+\Delta W)-H_k(W)).
```

This is measured by actual counterfactual rollout, not parameter distance or a local derivative.

## Safe absorption

For the residual-growth arm, evaluate the frozen scale bank

```text
1.0, 0.75, 0.5, 0.25, 0.125, 0
```

in descending order. Choose the largest `alpha` satisfying both:

- current-target reward improvement remains at least 0.002;
- every already-protected non-target probe has finite collision `<= C = 0.08` relative to the pre-write controller.

Commit only

```math
\alpha\Delta W.
```

The unresolved proposal component is

```math
r=(1-\alpha)\Delta W.
```

A full safe write has zero residual. A fully blocked proposal contributes the full proposal as residual.

## Signed residual memory

Before growth, unresolved incompatible components accumulate with no decay:

```math
R\leftarrow R+r.
```

`R` lives in the original route-0 parameter coordinates. Its displayed magnitude is parameter RMS.

For directional coherence, retain the last three nonzero residual vectors. Normalize each to unit Euclidean norm and compute

```math
coherence = \frac{\|\hat r_1+\hat r_2+\hat r_3\|}{3}.
```

This equals 1 for perfectly aligned residuals and approaches 0 for cancelling directions.

## Structural growth trigger

A second route grows only when all three conditions are true:

1. `RMS(R) > B = 0.09`;
2. three nonzero residuals exist and coherence is `>= 0.75`;
3. at least two of the last three learning episodes contained a target-improving proposal that had to be clipped (`alpha < 1`) because of a protected non-target probe.

No terrain or episode number appears in this trigger.

Only one growth event is allowed in the first gate. Further route proliferation is out of scope.

## Route initialization from residual

At growth, route 0 remains unchanged.

Construct a residual-derived alternative route as follows:

1. Take `R` in route-0 parameter coordinates.
2. If its RMS exceeds 0.15, scale the whole vector down uniformly to RMS 0.15; otherwise leave it unchanged.
3. Initialize route 1 as `route0 + R_clipped` for corresponding input/recurrent/bias/output coordinates.
4. Initialize gate weights to zero and gate bias to -1.5.

This means the new route begins near the preserved route but displaced specifically in the direction repeatedly proposed and repeatedly unsafe to absorb. No terrain-specific parameter is consulted.

After growth, evolutionary candidates mutate route 0, route 1, and gate parameters. Compatibility protection remains active using actual probe rollouts. Signed pre-growth residual is frozen in the audit log and no longer triggers additional growth.

## Default episode schedule

The frozen learning schedule is

```text
G G G G  I I I I  G I G I G I
```

`G` and `I` select only the harness physics. The controller never receives these symbols.

The final six alternating episodes form the primary switching tail.

## Primary metrics

For each arm report:

- post-training mean gravel reward from three no-learning evaluation episodes
- post-training mean ice reward from three no-learning evaluation episodes
- mean reward over the six alternating learning-tail episodes
- gravel retention: final gravel evaluation minus reward at the end of the initial four-gravel block
- ice retention: final ice evaluation minus reward at the end of the four-ice block
- cumulative absolute slip
- cumulative motor energy
- accepted writes
- clipped/rejected writes
- total candidate rollouts
- growth events and final route count

For the residual-growth arm also report:

- collision magnitude per protected probe
- selected `alpha`
- signed residual RMS
- residual coherence
- gate activation mean and variance by terrain on final evaluation rollouts

## Frozen success gate

The first seed-23 gate is **PASS** only if all conditions hold:

1. **There is a real conflict to solve.** Ordinary gravel retention after the four-ice block is at most `-0.03`, or its alternating-tail mean reward is at least `0.03` below the better of its single-terrain block-end rewards.
2. **Growth is causal.** Residual-growth produces exactly one growth event, and its audit trail contains at least two clipped target-improving proposals before growth.
3. **Growth beats the matched ordinary learner.** Residual-growth final mean of gravel+ice evaluation rewards is at least `ordinary + 0.04`, and its alternating-tail mean is at least `ordinary + 0.04`.
4. **Retention improves.** Residual-growth gravel retention is at least `ordinary gravel retention + 0.03`.
5. **Both routes are behaviorally used.** On final no-learning evaluations, mean gate activation differs between gravel and ice by at least 0.15, while neither terrain's mean gate is below 0.05 or above 0.95.
6. **The full causal chain exists in the event log.** At least one sequence can be shown as target-improving proposal -> protected collision -> alpha clipping -> signed residual accumulation -> threshold/coherence trigger -> route growth.

If any condition fails, the dashboard prints **FAIL** and names the failed clauses. There is no automatic retuning or reseeding.

## Anti-cheat rules

- Terrain identity is never a controller input.
- No route is manually assigned to ice or gravel.
- No prewritten ice or gravel policy exists.
- Both arms use the same seed, episode schedule, candidate count, and rollout budget.
- Before growth, common-coordinate candidate perturbations are identical across arms.
- Every candidate score shown comes from an actual rollout.
- Compatibility is measured by finite counterfactual rollouts.
- Growth can occur only through the frozen residual/coherence/conflict rule.
- The seed-23 full result is run only after constants and gate are committed.
- No constants are changed in response to the seed-23 result.
- Reset with seed 23 reproduces the run bit-for-bit modulo browser floating-point implementation details.
- Alternate seeds are allowed to fail visibly.
- No prerecorded success animation or fabricated trace is allowed.

## User interface

The static GitHub Pages site is a single experiment dashboard.

### Robot view

Two animated crawlers run side-by-side:

- Ordinary Shared Controller
- Residual Growth Controller

The human viewer sees whether the track is gravel or ice; the controller does not. Wheel rotation is driven from simulated `omega`, body motion from `x`, and slip effects from the actual slip state.

### Live traces

Show actual simulation traces for:

- velocity and target velocity
- motor command
- slip
- episode reward
- route gate activation

### ThirdWay machinery panel

Show:

```text
proposal id
best candidate improvement
protected collision(s)
safe alpha
absorbed fraction
residual RMS / B
residual coherence
recent clipped conflicts
route count
gate activation
```

When growth occurs, a small network diagram visibly gains route 1.

### Audit drawer

Expose:

- seed and PRNG counters/keys
- all frozen constants
- physics constants
- reward constants
- current controller matrices
- current proposal vector summary
- all candidate rollout scores
- protected anchor summaries/hashes
- collision values for every tested alpha
- residual vector summary and RMS
- coherence vectors/value
- growth trigger clause states
- complete chronological event log
- frozen success-gate evaluation

### Controls

- Run / Pause
- Step one learning episode
- Reset same seed
- editable seed (changing it marks the run `exploratory`, not the frozen gate)
- simulation speed multiplier
- Show machinery / audit

## Implementation shape

Keep the deployed site dependency-free:

```text
index.html                 page structure
styles.css                 presentation
src/config.js              all frozen experimental constants
src/prng.js                keyed deterministic PRNG
src/physics.js             terrain and crawler dynamics
src/controller.js          recurrent routes and gating
src/search.js              candidate generation and scoring
src/compatibility.js       anchors, finite collision, alpha, residual, growth
src/experiment.js          matched two-arm episode runner and frozen gate
src/ui.js                  animation, charts, audit drawer
```

Pure simulation modules use standard ES modules and avoid DOM dependencies. A Node test runner imports them directly.

## Automated tests

Fast deterministic CI tests cover:

- seeded/keyed PRNG reproducibility
- terrain label absent from the observation vector
- high torque/high slip can reduce useful traction on ice
- gravel and ice have distinct traction-optimum regimes
- same pre-growth common-coordinate proposals across arms
- candidate scoring uses actual rollout results
- collision calculation from finite rollouts
- descending largest-legal-alpha selection
- clipped/rejected accounting
- signed residual addition with beta fixed at 1
- coherence calculation for aligned and cancelling residuals
- no growth below B
- no growth with incoherent residuals above B
- no growth without repeated clipped conflicts
- deterministic growth when all three clauses are met
- route-1 initialization equals route0 plus clipped residual and does not consult terrain
- complete reset/same-seed reproducibility
- frozen success-gate evaluator reports named failures rather than coercing pass

CI does not need a browser or heavy compute.

## Claim boundary

A successful SlipNSlide result would support only:

> In this frozen minimal control world, an online finite-rollout compatibility test plus persistent signed residual and residual-triggered route growth preserved conflicting behaviors better than a matched single-route evolutionary controller.

It would not establish a general continual-learning solution, a biological mechanism, or universal superiority over standard neural architectures.
