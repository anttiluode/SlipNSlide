# Gate 3 Results — Earned Responsibility

**Frozen reference:** seed `23`, unchanged schedule `G G G G I I I I G I G I G I`.

**Verdict: FAIL.** No Gate-3 arm met the predeclared continual-learning criterion. The experiment was not retuned after the seed-23 result was observed.

Gate 3 starts from the exact Gate-2 controller immediately after the first structural growth event at episode 6. Gate 2 is therefore not reinterpreted or rerun with a different growth rule. The same frozen growth event is the starting point for all three Gate-3 arms:

```text
parameter coherence       0.096220
functional coherence      0.994814
growth threshold          0.42
routes                     1 -> 2
protected growth collision 0.073063 < 0.085
```

The question is narrower than Gate 2: **once the second route exists, can the system learn who should be responsible for which physical states?**

## Frozen arms

All three arms receive the same post-growth episode schedule and deterministic proposal seeds. Terrain identity is never passed into the controller or used as a gate target.

| arm | editable parameters after growth | gravel | ice | alternating tail | gate G | gate I | gate separation | result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| ordinary one-route baseline | ordinary learner | 0.9051 | 0.9146 | **0.9734** | — | — | — | reference |
| gate-only | gate only; both routes frozen | **1.1679** | -0.8997 | 0.1334 | 0.1572 | 0.3760 | **0.2188** | FAIL |
| specialist | route 1 + gate; route 0 frozen | 1.1284 | -0.7931 | 0.1777 | 0.1236 | 0.1381 | 0.0145 | FAIL |
| counterfactual responsibility | route 1 + gate; route 0 frozen | 1.1284 | -0.7931 | 0.1777 | 0.1236 | 0.1381 | 0.0145 | FAIL |

The frozen success requirement was not merely “grow two routes.” Each arm had to keep two routes, show real state-dependent gate use with separation at least `0.05`, and beat the ordinary alternating-tail score by the existing `0.04` margin. None did.

## Result 1 — the gate itself is not the bottleneck

The gate-only arm freezes both recurrent routes exactly:

```text
||Δ route 0|| = 0
||Δ route 1|| = 0
||Δ gate||    = 0.974857
```

Yet it learns substantially different mean gate activation:

```text
Gravel gate = 0.157184
Ice gate    = 0.375960
separation  = 0.218776
required    = 0.050000
```

So this controller class **can discover a state-dependent selector without seeing the terrain label**. The selector criterion passes comfortably.

But selecting between the two frozen routes does not solve the task. Ice performance remains `-0.8997`, and alternating-tail performance is only `0.1334`, versus `0.9734` for ordinary learning.

That moves the failure away from “the gate cannot represent or discover state dependence.” The repertoire being selected is not good enough.

## Result 2 — letting route 1 specialize is still insufficient

The specialist arm freezes route 0 and permits only route 1 plus the gate to change:

```text
||Δ route 0|| = 0
||Δ route 1|| = 2.459783
||Δ gate||    = 0.402052
```

The new route therefore changes substantially; this is not a no-learning result. Ice score improves relative to gate-only (`-0.7931` versus `-0.8997`).

But the final gate collapses back toward almost the same use on both regimes:

```text
Gravel gate = 0.123597
Ice gate    = 0.138131
separation  = 0.014534 < 0.05
```

and the alternating-tail mean is still only `0.1777`. Route-1 specialization under the frozen proposal budget does not produce a useful two-policy system.

## Result 3 — causal responsibility is measurable, but the frozen objective does not cash it in

The third arm adds an explicit counterfactual measurement. Before each post-growth update it runs both existing routes through real deterministic physics and measures

```text
route advantage = score(force route 1) - score(force route 0)
```

The gate target is derived only from that measured advantage. It is **not** the ICE/GRAVEL label.

The signal is strikingly clean:

| episode | surface (viewer/evaluation only) | route-1 advantage | responsibility target |
| ---: | :---: | ---: | ---: |
| 7 | I | +0.0735 | +0.2858 |
| 8 | I | +1.6461 | +1.0000 |
| 9 | G | -2.0443 | -1.0000 |
| 10 | I | +1.2088 | +0.9999 |
| 11 | G | -2.0155 | -1.0000 |
| 12 | I | +0.1810 | +0.6194 |
| 13 | G | -1.7457 | -1.0000 |
| 14 | I | +1.4944 | +1.0000 |

So the physical system itself provides a sharp causal routing signal: route 1 is favored on every post-growth ice episode, while route 0 is favored on every gravel episode.

However, under the predeclared auxiliary weight `0.08`, the responsibility arm selects **exactly the same proposal IDs** as the plain specialist arm on every post-growth episode. Its final controller and metrics are therefore identical to the specialist arm.

That means the result is *not* “causal responsibility is unavailable.” The opposite is visible in the measurements. The frozen search/objective simply fails to convert that signal into a different or useful learning trajectory.

## What the three gates now establish

The failure has moved three times without relaxing an earlier criterion:

```text
Gate 1
collision detected
  -> signed residual debt
  -> raw parameter directions incoherent
  -> no growth

Gate 2
collision detected
  -> functional effects coherent
  -> growth fires under unchanged threshold
  -> second route exists
  -> routing/performance fails

Gate 3
grown two-route system
  -> gate-only can learn state dependence
  -> route 1 can change substantially
  -> counterfactual route responsibility is sharply measurable
  -> frozen specialization/search still does not build a useful second policy
```

The strongest earned conclusion is therefore narrower than the original architectural hope:

> **In this frozen minimal control world, functional incompatibility is sufficient to trigger auditable structural growth, and post-growth route responsibility can be measured from counterfactual physical rollouts without a terrain label. But residual-derived route initialization plus the tested masked evolutionary specialization does not turn that structure and responsibility signal into a successful continual controller.**

## What this rules in and out

This experiment gives evidence **against** three easy explanations for Gate 2's failure:

- “The gate cannot become state dependent.” Gate-only separation is `0.2188`.
- “The second route is frozen and never changes.” The specialist changes route 1 by norm `2.4598`.
- “There is no observable causal signal telling the routes apart.” Forced-route advantage flips cleanly with the physical regime.

It does **not** establish that structural growth, specialist routes, or causal responsibility cannot work in a stronger architecture. It establishes that this particular residual-derived route construction and frozen search/credit interface did not work under the predeclared budget.

## Why the experiment stops here

The next obvious modifications—stronger responsibility weighting, a different route initializer, separate training phases, direct supervised fitting of the gate to counterfactual labels, larger search budgets—would all be new experiments chosen *after* seeing Gate 3. Changing them inside this gate would turn a failure into post-hoc tuning.

So Gate 3 is the stopping point for this repository series. The HTML simulation remains the Gate-1/Gate-2 audit surface rather than being polished into a success story that the frozen mechanism did not earn.

The machine-readable receipt is [`results/gate3-seed23.json`](results/gate3-seed23.json). Regenerate it with:

```bash
npm run gate3 -- 23
```
