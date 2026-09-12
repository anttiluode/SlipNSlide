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

## Gate 3 — earned responsibility: FAIL, with the bottleneck isolated

Gate 3 starts from the **exact Gate-2 controller immediately after growth at episode 6**. It does not change the physics, reward, collision budget, growth rule, seed, schedule, or Gate-2 receipt.

It tests three post-growth explanations:

1. **gate-only** — freeze both routes and evolve only the six gate parameters;
2. **specialist** — freeze route 0 and evolve route 1 plus the gate;
3. **counterfactual responsibility** — use real forced-route rollouts to measure which route performs better from the physical regime, then add that measured responsibility signal to the same route-1-plus-gate search.

The result is a clean three-arm failure:

| arm | alternating tail | gate separation | important fact |
| --- | ---: | ---: | --- |
| ordinary one-route | **0.9734** | — | reference |
| gate-only | 0.1334 | **0.2188** | selector becomes state dependent while both routes stay frozen |
| specialist | 0.1777 | 0.0145 | route 1 changes strongly, `||Δ route1|| = 2.4598` |
| responsibility | 0.1777 | 0.0145 | causal responsibility signal exists but selects the same proposals as specialist |

The gate-only result is useful: the six-parameter gate **can** discover state dependence without receiving ICE/GRAVEL. The failure is not simply an incapable selector.

The counterfactual probe is even more diagnostic. After growth, forcing route 1 beats route 0 on every measured ice episode, while forcing route 0 beats route 1 on every gravel episode. The responsibility signal is therefore physically identifiable without a terrain label. But with the predeclared auxiliary weight `0.08`, that signal does not alter a single selected proposal relative to the specialist arm.

See [`GATE3_RESULTS.md`](GATE3_RESULTS.md) and [`results/gate3-seed23.json`](results/gate3-seed23.json).

## The failure progression

```text
Gate 1:
collision -> signed debt -> wrong coherence geometry -> no growth

Gate 2:
collision -> functional coherence -> growth -> routing/performance fails

Gate 3:
growth -> learnable state-dependent gate
       -> mutable specialist route
       -> measurable causal route responsibility
       -> search/route construction still fails to produce a useful two-policy controller
```

That is where this experiment stops. Lowering thresholds, increasing search, changing the route initializer, or increasing responsibility weight after seeing Gate 3 would be a new experiment, not a repair of this one.

The HTML page remains an audit surface for the frozen mechanism. It is intentionally **not** polished into a working-success demo because the frozen continual-learning architecture did not earn that conclusion.

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
npm run gate3 -- 23
```

## Anti-cheat boundaries

- Terrain identity is never a controller input.
- Routes are never manually assigned to ice or gravel.
- Candidate scores come from real deterministic rollouts.
- Compatibility uses finite counterfactual probe rollouts, not parameter distance.
- Gate 1 remains frozen after Gate 2 and Gate 3 are added.
- Gate 2 retains the Gate-1 search, collision, norm, coherence and growth thresholds.
- Gate-2 structural initialization uses one real unresolved proposal selected by its functional representativeness; it never averages parameter vectors into a synthetic route.
- Gate 3 begins from the exact frozen Gate-2 growth snapshot.
- Gate-3 arms receive matched deterministic post-growth proposal seeds.
- Gate-only cannot edit either recurrent route.
- Specialist and responsibility arms cannot edit route 0.
- Counterfactual responsibility is computed from forced-route physical rollout scores, never from ICE/GRAVEL identity.
- The responsibility coefficient `0.08` was fixed before the seed-23 Gate-3 result was observed.
- Resetting/regenerating the same seed is deterministic; CI rejects drift in all frozen receipts.

## Relation to ThirdWay

`ThirdWay` T7B did **not** prove repair or structural growth. It showed that signed response-space residual bookkeeping was more informative than unsigned cumulative debt in its frozen comparison, but it failed the stronger gate and produced zero genuine repair events.

SlipNSlide moved that idea through three increasingly concrete questions. Functional effect geometry did solve the structural trigger that parameter-space residuals missed. But growth itself was not enough: the residual-derived second route and tested specialization/credit mechanisms did not become a successful continual controller.

## Final claim boundary

The repository supports only this bounded conclusion:

> In this frozen minimal control world, clipped edits that were incoherent in parameter space were highly coherent in finite response space, and that functional coherence triggered auditable structural growth under unchanged thresholds. After growth, a small gate could learn state-dependent routing and forced-route counterfactuals exposed a sharp causal responsibility signal without a terrain label. Nevertheless, the residual-derived route plus the frozen specialization/search mechanisms failed to convert those ingredients into a controller that outperformed the ordinary learner.

That failure is the result, not something hidden by retuning.
