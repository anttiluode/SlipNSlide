# SlipNSlide

**SlipNSlide is an auditable browser experiment about compatibility, not prediction.**

It asks whether a ThirdWay-inspired learner can handle two conflicting control regimes better than a matched ordinary evolutionary controller. Both robots receive the same hidden-terrain schedule and the same seeded proposal budget. The controller never receives the terrain label.

The two physical regimes are deliberately minimal: gravel has a broad, high-traction slip optimum, while ice has a narrow low-slip optimum whose traction falls when wheelspin gets too large. The neural controller sees only velocity error, velocity, slip, previous motor command and a chassis-pitch proxy.

The ordinary arm applies the best improving proposal directly. The ThirdWay arm replays protected behaviors, measures finite response-space collision, absorbs only the largest safe fraction of the proposal, carries the unresolved signed residual, and is allowed to grow a second recurrent route only when residual norm, directional coherence and repeated clipping all cross frozen thresholds.

## Frozen Gate 1

The reference evaluation uses seed `23` and schedule:

```text
G G G G  I I I I  G I G I G I
```

All mechanism constants live in `src/config.js`. The first seed-23 comparative run is the result; thresholds are not retuned afterward. The site displays FAIL if growth never occurs or any predeclared criterion is missed.

The frozen run did fail: the compatibility radar found repeated destructive proposals, but the signed residual directions stayed incoherent and no growth event fired. See [`RESULTS.md`](RESULTS.md).

Run locally:

```bash
npm test
python -m http.server 8000
```

Then open `http://localhost:8000/`.

Generate the deterministic receipt:

```bash
npm run result -- 23
```

## Anti-cheat boundaries

- Terrain identity is never a controller input.
- Routes are never manually assigned to ice or gravel.
- Candidate scores come from real deterministic rollouts.
- Compatibility uses finite counterfactual probe rollouts, not parameter distance.
- Growth is triggered only by residual norm + coherence + repeated clipping.
- Resetting the same seed reproduces the same event stream.
- Alternate seeds may fail visibly.

## Relation to ThirdWay

`ThirdWay` T7B did **not** prove repair or structural growth. It showed that signed response-space residual bookkeeping was more informative than unsigned cumulative debt in its frozen comparison, but it failed the stronger gate and produced zero genuine repair events. SlipNSlide therefore tests a stronger next mechanism: measured collision, explicit residual carry, and residual-triggered structure.

## Claim boundary

A PASS would support only this statement:

> In this frozen minimal control world, an online compatibility test plus persistent signed residual and residual-triggered route growth preserved conflicting behaviors better than a matched single-route evolutionary controller.

A FAIL is equally valid evidence and remains in the repository.
