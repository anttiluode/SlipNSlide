# SlipNSlide

**SlipNSlide is an auditable browser experiment about compatibility, not prediction.**

It asks whether a ThirdWay-inspired learner can handle two conflicting control regimes better than a matched ordinary evolutionary controller. Both robots receive the same hidden-terrain schedule and the same seeded proposal budget. The controller never receives the terrain label.

The two physical regimes are deliberately minimal: gravel has a broad, high-traction slip optimum, while ice has a narrow low-slip optimum whose traction falls when wheelspin gets too large. The neural controller sees only velocity error, velocity, slip, previous motor command and a chassis-pitch proxy.

The ordinary arm applies the best improving proposal directly. The compatibility arm replays protected behaviors, measures finite response-space collision, absorbs only the largest safe fraction of the proposal, carries unresolved residual information, and can grow a second recurrent route only under frozen structural rules.

## Frozen schedule

The reference evaluation uses seed `23` and schedule:

```text
G G G G  I I I I  G I G I G I
```

All mechanism constants live in `src/config.js`. Frozen gate results are never retuned after observation.

## Gate 1 — raw parameter residual coherence: FAIL

Gate 1 measured collision in functional response space but accumulated/cohered the unresolved edits in raw parameter space. The radar found repeated destructive proposals and built large residual debt, yet recent parameter residuals remained incoherent, so no structural growth event fired.

See [`RESULTS.md`](RESULTS.md).

## Gate 2 — functional residual coherence: FAIL, one mechanism later

Gate 2 leaves Gate 1 untouched and changes only the coherence geometry used for the growth decision. Each clipped edit gets a canonical finite effect vector

```text
[ ΔH on Gravel , ΔH on Ice ]
```

and recent effects are compared there instead of comparing raw `ΔW` directions.

At the frozen seed-23 structural trigger:

```text
residual norm          1.141910  > 0.58
parameter coherence    0.096220  < 0.42
functional coherence   0.994814  > 0.42
routes                  1 -> 2
```

So Gate 1's diagnosis was real: almost incoherent parameter edits can encode nearly identical functional demands. Functional coherence triggered growth under the **unchanged** threshold.

But the new route did not specialize. Final gate activation was `0.1163` on Gravel and `0.1114` on Ice, separation only `0.0049` versus the frozen `0.05` requirement. Alternating-tail performance remained far below ordinary learning. Gate 2 therefore remains **FAIL**.

See [`GATE2_RESULTS.md`](GATE2_RESULTS.md) and [`results/gate2-seed23.json`](results/gate2-seed23.json).

The failure progression is now:

```text
Gate 1: collision -> debt -> wrong coherence geometry -> no growth
Gate 2: collision -> functional coherence -> growth -> routing fails to specialize
```

That points the next experiment at **post-growth route credit**, not at relaxing the growth threshold.

## Run locally

```bash
npm test
python -m http.server 8000
```

Then open `http://localhost:8000/`.

Generate the deterministic receipts:

```bash
npm run result -- 23
npm run gate2 -- 23
```

## Anti-cheat boundaries

- Terrain identity is never a controller input.
- Routes are never manually assigned to ice or gravel.
- Candidate scores come from real deterministic rollouts.
- Compatibility uses finite counterfactual probe rollouts, not parameter distance.
- Gate 1 remains frozen after Gate 2 is added.
- Gate 2 retains the Gate 1 search, collision, norm, coherence and growth thresholds.
- Gate 2 structural initialization uses one real unresolved proposal selected by its functional representativeness; it never averages parameter vectors into a synthetic route.
- Resetting the same seed reproduces the same event stream.
- Alternate seeds may fail visibly.

## Relation to ThirdWay

`ThirdWay` T7B did **not** prove repair or structural growth. It showed that signed response-space residual bookkeeping was more informative than unsigned cumulative debt in its frozen comparison, but it failed the stronger gate and produced zero genuine repair events. SlipNSlide now separates two later questions: first whether incompatibility should be recognized in functional rather than parameter geometry, and then whether new structure can receive useful causal routing credit.

## Claim boundary

Gate 2 supports only this bounded statement:

> In this frozen minimal control world, clipped edits that were almost incoherent in parameter space were nearly perfectly coherent in finite response space, and response-space coherence triggered structural growth under the unchanged Gate 1 thresholds. The resulting second route did not learn useful terrain-dependent routing, so the overall continual-learning gate still failed.
