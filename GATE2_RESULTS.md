# Gate 2 — functional residual coherence

## Frozen result: FAIL

Gate 1 failed before structural growth. The compatibility mechanism repeatedly detected real collisions and accumulated signed residual debt, but recent unresolved parameter edits had low directional coherence, so the frozen growth rule correctly refused to create a second route.

Gate 2 changed exactly one conceptual quantity: **coherence is measured from what clipped proposals do to the robot's behavior, not from the raw parameter vectors that produced those effects.**

All Gate 1 search and growth thresholds remained fixed:

```text
seed                    23
proposal count           24
proposal sigma           0.075
minimum improvement      0.002
collision budget         0.085
residual norm threshold  0.58
coherence window         3
coherence threshold      0.42
minimum clipped events   2
success margin           0.04
schedule                 G G G G I I I I G I G I G I
```

No value above was changed after observing the Gate 2 outcome.

---

## The new geometry

For each clipped proposal, Gate 2 keeps the same unresolved parameter edit

```math
r=(1-\alpha)\Delta W,
```

but also measures its finite behavioral effect in a canonical two-terrain response space:

```math
E(r)=
\begin{bmatrix}
H_G(W_{full})-H_G(W_{safe})\\
H_I(W_{full})-H_I(W_{safe})
\end{bmatrix}.
```

`H` contains the recurrent hidden trajectory, motor command, body velocity, and slip from a full deterministic rollout. Terrain identity is used only by the experiment harness to replay the physical worlds; it is never a controller input.

The cumulative residual norm is still a parameter-space norm and the growth threshold is still `0.58`. The only trigger change is:

```text
Gate 1 coherence = cosine of recent unresolved parameter edits
Gate 2 coherence = cosine of recent finite functional effect vectors
```

When growth fires, Gate 2 does **not** average parameter edits. It chooses the actual unresolved proposal whose functional effect is most representative of the recent functional cluster and uses that real residual to initialize route 1.

---

## The decisive event

At episode 6, the second consecutive Ice conflict produced:

```text
cumulative residual norm       1.1419104004   > 0.58
clipped conflicts              2              >= 2
parameter coherence            0.0962199968   < 0.42
functional coherence           0.9948144055   > 0.42
```

So two edits that looked almost unrelated in weight space produced nearly the **same behavioral demand**.

The functional rule therefore triggered real structural growth:

```text
routes                          1 -> 2
representative proposal         episode 6
representative similarity       0.9987027600
representative residual norm    0.8683516438
protected post-growth collision 0.0730634670
```

The protected post-growth collision remained below the unchanged `0.085` budget.

This is the strongest Gate 2 result:

> **Raw parameter incoherence had hidden a highly coherent functional incompatibility. Measuring coherence in response space exposed it and triggered growth under the original threshold.**

---

## But growth did not solve the task

Final metrics:

| metric | ordinary | Gate 1 residual | Gate 2 functional growth |
|---|---:|---:|---:|
| gravel score | 0.905067 | 1.146023 | 1.028170 |
| ice score | 0.914599 | -0.865605 | -0.595776 |
| alternating-tail mean | **0.973391** | 0.140209 | 0.230426 |
| gravel retention Δ | -0.165353 | -0.048118 | **-0.036120** |
| mean slip | **0.055539** | 2.922077 | 2.029823 |
| accepted writes | 14 | 7 | 9 |
| clipped writes | 0 | 10 | 10 |
| growth events | 0 | 0 | **1** |
| final routes | 1 | 1 | **2** |

Gate 2 preserves the old gravel behavior better and learns Ice somewhat better than Gate 1, but it remains far below the ordinary controller on the alternating sequence.

The reason is visible in the learned gate:

```text
gate on Gravel       0.1162923550
gate on Ice          0.1113760381
separation           0.0049163169
required separation  0.0500000000
```

The second route exists, but the system does not learn to route the two physical regimes differently enough.

---

## Frozen criteria

| criterion | result |
|---|---|
| ordinary conflict exists | PASS — 0.165353 >= 0.03 |
| functional/parameter geometry separates | **PASS — 1 event** |
| structural growth triggered | **PASS — 1 event** |
| Gate 2 tail >= ordinary + 0.04 | **FAIL — advantage -0.742965** |
| gate uses observable state | **FAIL — separation 0.004916** |
| incompatibility trace is visible | PASS — 10 clips |

Overall:

```text
GATE 2 = FAIL
```

---

## What changed from Gate 1

Gate 1's failure was:

```text
collision detected
-> residual large
-> raw parameter directions incoherent
-> no growth
```

Gate 2 becomes:

```text
collision detected
-> raw parameter directions incoherent
-> functional effects highly coherent
-> growth
-> new route exists
-> routing does not specialize
```

That is real progress because the failure has moved one mechanism later.

The next gate should therefore **not** lower the coherence threshold, increase the residual budget, or hand-assign the grown route to Ice. The next unresolved problem is post-growth credit/routing: how can consequences teach the gate which route should own which physical regime without exposing the hidden terrain label?

A natural next experiment is a V25-style causal route-credit signal: compare each route's counterfactual contribution to the observed consequence and update the gate from that local responsibility rather than asking generic mutation to discover routing by chance.

## Claim boundary

The allowed Gate 2 conclusion is:

> In this frozen minimal robot world, recent incompatible parameter edits that were almost incoherent in weight space were nearly perfectly coherent in finite response space. Using response-space coherence triggered structural growth under the unchanged Gate 1 thresholds. The resulting extra route did not learn useful terrain-dependent routing, so the overall continual-learning gate still failed.
