# synthetic-survival-v2.0 browser environment

`SyntheticWorld` composes the unchanged legacy `SurvivalWorld`; it does not replace
Python mechanics or invalidate recorded legacy experiments. This extension is
implemented in JavaScript only. A trained legacy five-channel policy is not a
compatible trained synthetic-v2 policy.

Defaults: 16×16 grid, eight equal-capability agents, radius-two local observations,
power 24, integrity five, hard lifetime 96 simulation transitions, horizon 128,
32 initial resource cells and two new resources per step. Every agent has the
same rules and local scripted greedy/hazard-avoidance policy, with independent
seeded tie-breaking. Policies receive no global positions, other agents' power,
integrity, wear or observer frame. No messages, cooperation reward or learned
cooperation are implemented. Resource consumption and simultaneous contested/
occupied movement are inherited real interactions, not decorative animation.

Wear increases on each valid transition while operational, including wait/blocked
moves. Resource replenishment restores power but never wear. Wear >=96 guarantees
irreversible terminal failure. Wall time, playback speed and pause do not affect
wear except through actual simulation stepping. There is no repair mechanism;
future repair must never decrease lifetime wear. Dead state absorbs. A horizon
before failure is truncation with continuation one for a survivor; simultaneous
wear failure/horizon retains termination and continuation zero.

24 seeded hazard cells toggle active/inactive on a 12-step cycle. Active cells
reduce integrity by one per transition spent there, including waiting. This is a
simple implemented unstable-zone hazard, not a complete synthetic system-fault
simulator. Damage accumulates; zero integrity ends operation. Cascading faults,
repairs, more complex zones and communication remain planned.

Update order: validate/base simultaneous movement, power depletion and resource
pickup, base spawn/tick; increment wear for previously living agents; apply the
new tick's active-zone damage; determine failure causes; compute final observation
and alive-after-transition reward. Terminal failures clear operational power to
zero. Horizon and death flags are separate. No reward for elapsed wall-clock time.

`observe()` returns independent float32 arrays flattened `[8,width,width]`:
resources, self, other operational agents, valid cells, own power fraction, local
active hazards, own wear fraction and own integrity fraction. Dead observations
are zero. `frame()` is a copied full-world observer view; `state()/loadState()`
include version, config, wear, integrity, failure causes and base RNG state.

`scripted.mjs` depends only on observations and per-agent RNG. `renderer.mjs`
receives frame/config and Canvas context only. `DemoRuntime` coordinates those
modules and exposes play/pause/reset/speed/advance; only `advance` while playing
steps the world. Speed chooses display interval, never simulation delta.

```sh
node browser/tests/synthetic.test.mjs
node browser/tests/simulator.test.mjs
```

11 synthetic tests plus all 24 legacy tests pass. Checks cover guaranteed wear
despite replenishment, hazard damage/toggling, death/truncation precedence,
competition, local information, resume, invalid-action immutability, independent
Canvas rendering, and play/pause/reset/speed semantics. Actual browser layout and
hydrated controls remain unverified without a connected supported browser.
