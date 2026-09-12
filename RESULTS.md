# SlipNSlide Gate 1 Results

## Frozen result: Gate 1: FAIL

The first complete seed-23 comparative run was executed after the mechanism constants in `src/config.js` were frozen. The result is kept as-is. No collision budget, growth threshold, coherence threshold, proposal scale, or success margin was changed after seeing it.

Schedule:

```text
G G G G  I I I I  G I G I G I
```

## Final metrics

| metric | ordinary shared route | ThirdWay-inspired residual-growth |
|---|---:|---:|
| gravel score | 0.9050673592 | **1.1460232924** |
| ice score | **0.9145990402** | -0.8656049365 |
| alternating-tail mean | **0.9733914604** | 0.1402091779 |
| gravel retention delta | -0.1653526518 | **-0.0481182748** |
| ice retention delta | -0.1175015530 | 0.0000000000 |
| mean slip | **0.0555385156** | 2.9220765161 |
| accepted writes | **14** | 7 |
| clipped writes | 0 | 10 |
| growth events | 0 | **0** |
| final routes | 1 | **1** |

The ordinary learner shows the conflict we wanted the testbed to expose: after the ice block, its gravel score fell by **0.1653526518**, well beyond the frozen 0.03 forgetting threshold.

The compatibility-aware learner does detect conflict. From episode 5 onward, ten proposals are clipped or rejected by protected-rollout collision checks. Its carried signed residual norm grows from **0.6627** after the first clipped ice write to **2.6920** at the end.

But the residual directions do not become coherent enough to justify growth. The frozen coherence threshold is 0.42. Observed coherence after conflicting writes stays near zero and eventually negative:

```text
episode  5  R=0.6627  coherence= 0.0000
episode  6  R=1.1419  coherence= 0.0962
episode  8  R=1.5010  coherence= 0.0127
episode 11  R=2.1813  coherence=-0.0656
episode 14  R=2.6920  coherence=-0.0342
```

Therefore **no growth event fires**. That is not hidden or repaired after the fact.

## Frozen criteria

| criterion | threshold | observed | result |
|---|---:|---:|---|
| ordinary conflict exists | forgetting >= 0.03 | 0.1653526518 | PASS |
| residual growth triggered | >= 1 event | 0 | **FAIL** |
| alternating-tail advantage | >= +0.04 | -0.8331822825 | **FAIL** |
| grown gate uses physical state | separation >= 0.05 | 0 | **FAIL** |
| traceable incompatibility exists | >= 1 clipped/rejected event | 10 | PASS |

Overall:

```text
Gate 1 = FAIL
```

## What the failure means

The run gives us a sharper answer than a staged success would have. Finite-rollout compatibility detects destructive edits and protects the earlier gravel behavior better than ordinary overwriting, but **blindly summing the incompatible parameter residuals does not produce a coherent structural direction in this proposal stream**. The signed debt gets large without becoming geometrically consistent.

That is very close to the warning already present in `ThirdWay` T7B: signed residual bookkeeping can be informative without constituting repair. SlipNSlide now makes the next failure concrete in a physical control world. Collision detection works; passive residual accumulation is not yet enough to decide what new structure should be.

The next scientifically justified mechanism would need to *actively seek* a residual-cancelling or conflict-resolving direction, or accumulate residual in a response/route coordinate system where incompatible proposals can become coherent. This repository does not implement that follow-up and does not rewrite Gate 1.

## Reproduce

```bash
npm test
npm run result -- 23
```

The deterministic JSON receipt is committed at `results/seed23.json`.
