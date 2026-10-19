# Browser environment preparation

Dependency-free ES modules for browsers and Node. The legacy `simulator.mjs` ports
the existing Python gridworld rules unchanged. The separately versioned
`synthetic.mjs` extension below adds tested lifetime wear and hazard damage;
`renderer.mjs` is an independent Canvas observer. No learned survival result is
claimed. Existing Python mechanics and historical experiment reports are unchanged.

Run from the repository root (tested with Node 22.22.2, Python 3.10.12 and existing
NumPy 1.26.4; no dependency installation):

```sh
node browser/example.mjs
node browser/tests/simulator.test.mjs
python -B browser/tests/generate_fixtures.py --check
python -B -m unittest discover -v
```

The scripted wait example produces three ticks and reward six, then clears policy
state. `simulator.test.mjs` runs 24 built-in Node tests, including 18 Python-derived
parity scenarios. No package manager, bundler, GPU, browser driver or inference
runtime is required. Browser execution and performance remain untested because no
supported connected browser is available in this environment.

## Simulation API and semantics

Import `SurvivalWorld` from `./simulator.mjs`. Construct with
`new SurvivalWorld({seed: 0, config: {agents: 1}})`; omitted config fields retain
Python defaults. Field names and bounds match Python (`max_hunger`,
`food_per_step`, etc.). `world.config` is frozen. Actions remain
0 wait, 1 north, 2 east, 3 south, 4 west, with one integer-valued JavaScript Number
per slot (including dead slots). Arrays and integer-valued typed arrays work.

`world.observe()` returns an array of independently owned `Float32Array` values,
one per agent, flattened in Python channel-first order `[5, width, width]`, where
`width = 2*radius+1`. Index = `channel*width*width + row*width + column`.
Channels are food, self, other living agents, valid cells, and own hunger fraction.
Dead agents receive zeros. Local observations exclude distant world information.

`world.step(actions)` returns an object:

```js
{observations, rewards, done, info: {ate, died, truncated}}
```

Rewards are a `Float32Array`; flags are Boolean arrays/scalars. The Python API
returns a four-tuple instead; this is an explicit representation difference.
Moves are simultaneous. Initially occupied cells (including swaps) and contested
empty destinations reject movement; cells occupied only by dead agents are free.
Hunger decrements, food restores it before death, death absorbs, then food spawns
on food-free unoccupied cells. Reward is one per living agent after transition.
Horizon is truncation, not aging; death and horizon may occur together. Stepping
after scalar `done` throws. Observation float32 rounding matches NumPy fixtures.

`world.frame()` returns a copied JSON-compatible full-world observer frame with
`tick`, `positions`, `alive`, `hunger`, and row-major food coordinates. Give this
only to a separate renderer/observer. Never give it to a local policy. The
simulation imports no DOM or Canvas API; a renderer can step at a fixed rate and
draw independently.

`world.state()` / `loadState(state)` copy and restore a versioned JSON-compatible
checkpoint including config and random state. This is a JS checkpoint format,
**not** a loader for Python's NumPy arrays/PCG64 state. Config must match; construct
a new world to reset. World snapshots exclude policy memory: checkpoint and
restore each policy session separately if that future feature is needed. It is
not implemented in this preparation step.

## Meadow presentation — October 19, 2026

`renderer.mjs` draws synthetic-v2 agents as mice in a meadow: shared recharge cells
are berry clusters, hazard cells are thorn patches (orange when dangerous), and
each living mouse has a colored number tag and an energy bar. The Site labels
power/integrity/wear as energy/health/age. This is a visual metaphor for a simplified
simulation, not a biological aging model. Rule values and agent observations are
unchanged. The hard96-step wear limit is presented as a fixed lifetime in turns.

An optional previous observer frame turns mice toward their last movement. Rendering
uses no randomness or simulation stepping and mutates neither frame nor world.
Inactive markers are drawn before living mice, so a mouse can visibly enter a
previously vacated cell. Color/number tags connect the board to the per-agent stats.

## Randomness and what parity means

Default JS randomness is seeded Mulberry32 with partial Fisher-Yates sampling
without replacement. Python uses NumPy PCG64/`choice`. **Equal numeric seeds do not
produce equal Python/JS episodes.** Each runtime is independently repeatable; JS
checkpoints preserve its own stream. Cross-runtime seed identity is not claimed.
For experiment comparisons, use shared initial conditions and a shared recorded
random-choice stream, or standardize a common generator in both runtimes later.

The simulator accepts an explicit `random` source implementing
`sample(candidates, count)` without replacement. For checkpoints it additionally
implements `state()` and `loadState(state)`. The parity harness injects Python's
actual recorded NumPy selections and verifies **every candidate list, requested
count and selected cell**, including initialization and post-death spawning.
It then checks full frames, every observation value, rewards, death/eating flags,
truncation and scalar done across all transitions. This verifies transition and
observation parity under identical random choices, not PCG64 emulation.

`tests/generate_fixtures.py` imports the unchanged canonical simulator and records
actual NumPy calls. It includes hand-arranged collision, starvation, rescue,
dead-cell, horizon, radius-zero, saturation/full-grid cases plus eight seeded
rollouts. `fixtures.json` records a SHA-256 of Python source and the generation
NumPy version. `--check` regenerates in memory and requires exact fixture equality.
After an intentional rule or NumPy change, review the differences before running
the generator without `--check`; do not silently update expectations to hide a
regression. Fixtures are test assets and need not ship in a website bundle.

## Explicit policy memory boundary

`PolicySession` in `policy-session.mjs` accepts:

```js
new PolicySession({agents, radius, initialState: () => null,
  policy: ({observation, previousAction, state}) => ({action: 0, state})});
```

It provides only one copied local observation, that agent's prior action and its
own copied recurrent state. It passes no world frame, positions, other agents'
states, global reward or observer camera. State must be structured-cloneable;
typed arrays are supported. Each slot owns independent state even if a factory
accidentally returns a shared object. `actions(world.observe())` requires
`finishStep(result.info, result.done)` before the next action. Death clears that
slot; episode completion clears all slots; `beginEpisode()` starts fresh memory
and previous action zero. The contract is synchronous; asynchronous ONNX sessions
and cancellation/backpressure need a separate future Worker adapter.

For a future recurrent agent, the exported acting graph must include the
observation encoder, posterior/recurrent update and actor with explicit hidden
state inputs/outputs. A bare actor head cannot reconstruct unavailable latent
state. Neither this interface nor the scripted example is an implemented/trained
RSSM, MPC or MCTS policy. Full-model planning is a separate future option requiring
export parity and browser profiling; no ONNX dependency is added here.

## Island game (separate objective)

[`ISLAND.md`](ISLAND.md) describes the new castaway game, forced voting councils
and winner-only reward. `island-game.mjs` and `island-renderer.mjs` are independent
entry points; the existing synthetic-v2 experiments and scripts retain their rules.
