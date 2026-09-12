# SlipNSlide — ThirdWay-inspired slip-and-grip browser experiment

## Goal

Build an auditable static HTML experiment showing whether a ThirdWay-inspired compatibility mechanism can preserve two conflicting control strategies in a minimal robot world better than an ordinary shared controller.

The demo must not hard-code which route is for ice or gravel, must not expose terrain identity to the controller, and must allow the result to fail visibly.

## Scientific question

Can a learner that decomposes proposed recurrent-weight changes into a compatible absorbed component plus a persistent signed residual, and grows a new route only after coherent incompatibility accumulates, preserve both high-traction and low-traction control behaviors better than an ordinary shared recurrent controller trained with the same proposal budget?

This repository is not a claim that ThirdWay T7B already proved repair or structural growth. T7B showed useful signed residual geometry but failed its frozen gate and produced zero genuine repair events. SlipNSlide tests the next stronger mechanism: measured collision, residual carry, and residual-triggered route growth.

## Environment

The browser simulates a small 1D crawler moving left-to-right.

State variables include:

- body position `x`
- body velocity `v`
- wheel angular velocity `omega`
- chassis pitch proxy `phi`
- previous motor command `u_prev`

The controller observes only physically plausible quantities derived from these values:

- velocity error relative to a target speed
- body velocity
- wheel/body slip ratio
- previous motor command
- pitch proxy

The controller never receives a terrain label.

Two hidden terrain regimes exist:

### Gravel

High available traction. Sustained stronger torque is effective and excessive caution causes under-speed/stalling.

### Ice

Low traction with a nonlinear slip penalty. Excessive wheel torque increases wheelspin and can reduce useful longitudinal traction, so a gentler, more modulated command is favored.

The exact coefficients are frozen in source and exposed in the audit drawer.

## Dynamics

The simulation uses explicit fixed-step deterministic dynamics in JavaScript with a seeded PRNG for all stochasticity.

At each physics step:

```text
motor command -> wheel drive -> slip ratio -> terrain traction curve
              -> longitudinal force -> body acceleration -> next state
```

The traction function must be nonlinear rather than a simple force clip. On ice, sufficiently large slip lowers effective traction. On gravel, the useful traction peak occurs at a higher command/slip regime.

The environment is intentionally simple enough to audit in one browser page. It is not intended as a physically complete vehicle model.

## Controller

The initial controller is a tiny recurrent network with one hidden route:

```text
observation -> recurrent hidden state -> motor command
```

A parameter vector contains input, recurrent, output, and bias weights. The same controller is evaluated on both hidden terrains.

When structural growth occurs, the ThirdWay-inspired learner gains a second recurrent route plus a small learned gate. The gate receives the same physical observations/history as the controller, not the hidden terrain identity.

The output becomes a learned blend of route outputs:

```math
u_t = (1-g_t)u_t^{(0)} + g_t u_t^{(1)}
```

with `g_t` produced from observable state. The new route must not be wired permanently to either terrain.

## Search and proposals

Learning uses a small seeded evolutionary proposal process rather than backpropagation.

For every learning episode:

1. Start from the current parameter vector.
2. Generate a fixed number of candidate perturbations from the seeded PRNG.
3. Simulate each candidate on the current training terrain.
4. Select the candidate with the largest target-terrain reward improvement.
5. Feed that proposed `Delta W` to the learner policy.

Both comparison arms use the same seed, episode schedule, proposal count, perturbation scale bank, and physics budget.

The demo must record candidate scores so the user can verify that proposals were really evaluated.

## Comparison arms

### 1. Ordinary shared controller

The ordinary learner commits the best improving proposal directly when it clears a frozen minimum-improvement threshold.

This arm has no protected-rollout compatibility test and no structural growth.

### 2. ThirdWay-inspired residual-growth controller

The same proposal first undergoes compatibility measurement against protected rollouts from earlier successfully learned behavior.

The protected behavior is represented by frozen probe episodes and their controller response trajectories. Terrain labels may be used by the experiment harness to replay the correct physical probe environment, but never enter the controller input.

## Causal collision radar

For each protected probe set `k`, store an anchor response trajectory after that behavior is intentionally accepted:

```math
A_k = H_k(W)
```

where `H_k` contains the recurrent hidden trajectory, motor-output trajectory, body velocity, and slip trajectory over the frozen probe rollout.

For a candidate write `W -> W + Delta W`, measure the actual finite rollout displacement:

```math
c_k(Delta W) = RMS(H_k(W + Delta W) - H_k(W)).
```

This is a response-space collision measure, not parameter distance and not a local gradient approximation.

## Safe absorption

Use a frozen scale bank such as:

```text
1.0, 0.75, 0.5, 0.25, 0.125, 0
```

Choose the largest scale `alpha` that:

- still improves the current target terrain by at least the frozen minimum amount; and
- keeps each protected response displacement under the frozen per-probe compatibility budget.

Commit only:

```math
alpha Delta W.
```

The unresolved component is:

```math
r = (1-alpha) Delta W.
```

## Signed residual memory

The unresolved incompatible matrix component is accumulated as a signed parameter-space residual:

```math
R <- beta R + r
```

with frozen decay `beta` (default 1.0 for the first gate unless testing reveals unbounded stale accumulation before any growth event can be interpreted).

The experiment displays the residual norm and directional consistency over time.

This signed residual is not claimed to be a proof of causal repair. It is a persistent record of proposal content that could not be safely absorbed.

## Structural growth trigger

Growth occurs only when all frozen conditions are satisfied:

1. residual norm exceeds threshold `B`;
2. residual direction has remained sufficiently coherent over a frozen recent window, so random conflicting proposals do not trigger growth;
3. the current single-route controller demonstrably has a protected-vs-target conflict, measured by successful target proposals being repeatedly clipped by compatibility.

The threshold and coherence test are fixed before the default run and shown in the audit UI.

## Route initialization from residual

When growth fires, the second route is initialized from a deterministic projection of the accumulated signed residual onto the recurrent/input/output blocks associated with the controller.

The projection must be explicit and inspectable. It may normalize residual magnitude for numerical stability, but it must not encode terrain-specific hand-written behavior.

The gate weights begin neutral/small and are thereafter mutated by the same evolutionary proposal mechanism.

After growth, proposals may target both shared/gating parameters and route-specific parameters. Protected collision continues to be measured by actual probe rollouts.

## Default episode schedule

The default frozen sequence is:

```text
G G G G  I I I I  G I G I G I
```

where `G` and `I` select the physical environment for the experiment harness only.

The controller never receives `G` or `I`.

The first block allows a gravel-capable behavior to form, the second stresses it with ice, and the alternating tail measures retention and routing.

## Reward

Episode reward is a frozen weighted combination of:

- target-speed tracking
- forward progress
- slip penalty
- control-energy penalty
- chassis-stability penalty

The same reward definition is used for both arms and both terrains, except that terrain physics changes the resulting state trajectory.

No separate terrain-specific reward shaping is allowed.

## Primary metrics

For each arm report:

- mean gravel reward after learning
- mean ice reward after learning
- alternating-tail mean reward
- gravel retention after learning ice
- ice retention after switching back to gravel
- cumulative slip
- cumulative motor energy
- accepted writes
- clipped/rejected writes
- growth events
- final route count

For the residual-growth arm also report:

- collision magnitude per protected probe
- selected `alpha`
- signed residual norm
- residual directional coherence
- route gate activation over time

## Success criterion

The first gate is considered interesting only if, under the same frozen seed and proposal budget:

1. the ordinary controller shows a measurable conflict/forgetting cost between gravel and ice;
2. the residual-growth controller triggers growth through the declared residual rule rather than a schedule or terrain condition;
3. after growth, it improves alternating-tail performance and retention over the ordinary controller by a predeclared margin;
4. both routes are behaviorally used, with gate activation varying as a function of observable physical state rather than staying permanently saturated;
5. at least one repeated incompatibility event can be traced from proposal -> collision -> clipping -> residual accumulation -> growth.

Failure of any of these is shown as failure, not hidden.

## Anti-cheat rules

- Terrain identity is never an input feature.
- No route is manually assigned to ice or gravel.
- No prewritten ice or gravel policy is used.
- Both arms use the same seeded proposal budget and episode schedule.
- Every candidate score shown in the UI comes from an actual simulated rollout.
- Compatibility is measured by actual finite counterfactual probe rollouts.
- Growth can occur only from the frozen residual/coherence/conflict rule.
- The growth threshold is not changed after observing the default outcome.
- Reset with the same seed reproduces the same run.
- Alternate seeds are allowed to fail visibly.
- No prerecorded success animation is allowed.

## User interface

The static page is a single experiment dashboard suitable for GitHub Pages.

Top section:

- two animated crawlers side-by-side: Ordinary and Residual Growth
- ground strip visibly changes between gravel and ice
- body motion, wheelspin, and current motor command are animated from actual simulation state

Middle section:

- current episode and hidden-terrain indicator for the human viewer only
- reward, velocity error, slip, and torque traces
- comparison metrics

ThirdWay machinery panel:

```text
proposal id
candidate improvement
protected collision
safe fraction alpha
absorbed fraction
residual norm / threshold
residual coherence
route count
gate activation
```

When growth occurs, the page visibly adds a second route in a small network diagram.

Audit drawer:

- seed and PRNG state
- physics constants
- reward constants
- controller parameter matrices
- current proposal vector
- candidate rollout scores
- protected anchor hashes/summary
- collision values
- scale-bank evaluation
- residual vector/norm
- growth threshold/coherence values
- complete event log

Controls:

- Run / Pause
- Step episode
- Reset same seed
- editable seed
- speed multiplier
- Show machinery / audit

## Implementation shape

Keep the static site dependency-free and understandable:

```text
index.html           page structure
src/prng.js          deterministic seeded PRNG
src/physics.js       terrain and crawler dynamics
src/controller.js    recurrent routes and gating
src/search.js        candidate generation and scoring
src/compatibility.js probe anchors, collision, alpha selection, residual/growth
src/experiment.js    matched two-arm episode runner
src/ui.js            rendering, traces, audit drawer
styles.css           presentation
```

A small Node-based test harness may import the pure JavaScript modules for deterministic tests without a browser. The deployed experiment remains static HTML/JS/CSS.

## Tests

Automated tests must cover:

- seeded PRNG reproducibility
- terrain label absent from controller observations
- high torque can reduce effective traction on ice
- gravel and ice have distinct optimum torque/slip regimes
- identical candidate streams across matched arms before policy-specific acceptance diverges them
- collision calculation from finite rollouts
- largest-legal-alpha selection
- rejected/clipped proposal accounting
- signed residual arithmetic
- no growth below threshold
- no growth for incoherent residual directions even above raw norm threshold
- deterministic growth when all frozen conditions are met
- residual-derived route initialization without terrain lookup
- reset/same-seed complete experiment reproducibility
- visible failure when success criteria are not met

CI should run only deterministic fast tests. No heavy simulation is required.

## Claim boundary

A successful SlipNSlide result would support only this bounded statement:

> In this frozen minimal control world, an online compatibility test plus persistent signed residual and residual-triggered route growth preserved conflicting behaviors better than a matched single-route evolutionary controller.

It would not establish a general continual-learning solution, biological mechanism, or universal superiority over standard neural architectures.
