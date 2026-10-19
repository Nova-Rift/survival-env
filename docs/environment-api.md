# Bring your own agent

Clone the environments, replace a tiny agent, and run locally. No API key, account,
server, GPU or ML framework is required. **Node.js 22+** runs the canonical rules;
**Python 3.10+** is optional. The Python bridge uses only the standard library and
the same Node engine, not a second implementation of island mechanics.

## 1. Clone and run

```sh
git clone --branch browser-environment --single-branch https://github.com/Nova-Rift/survival-env.git
cd survival-env
node browser/run-agent.mjs --env island-v1 --agent ./examples/agents/random.mjs --seed 0 --episodes 3
```

Each output line reports the environment, seed, turns, councils, winner and total
reward for every agent. IDs are **zero-based**, including the winner and ballots.
The website's visible castaway numbers are one-based.

Run the Python example from the same checkout:

```sh
python -B -m examples.custom_agent
```

These examples are random scripted baselines, not trained models. No command above
installs dependencies or downloads weights. The Python bridge requires the cloned
`browser/` directory; it is not currently packaged for standalone `pip install`.

## 2. Write your agent

Copy [random.mjs](../examples/agents/random.mjs) to `my-agent.mjs`. Export a factory:

```js
export function createAgent({id, seed, observationShape, actionCount}) {
  // This factory runs once per player, per episode. Keep private memory here.
  return {
    act({observation, reward, tick}) {
      return 0; // Replace with your model: 0 wait, 1 north, 2 east, 3 south, 4 west.
    },
    vote({observation, candidates, councils}) {
      return candidates[0]; // Choose another remaining player at island council.
    },
    // Optional learn(transition) runs after each movement or council transition.
  };
}
```

```sh
node browser/run-agent.mjs --env island-v1 --agent ./my-agent.mjs --seed 10 --episodes 5
```

`createAgent`, `act`, `vote` and optional `learn` may return promises. You can call
your own local model or provider inside them; inference and cost are yours to
configure. The runner does not invent dialogue or supply an LLM. It loads your
module as ordinary trusted local code, not inside a sandbox. Agent errors stop the
run instead of silently substituting a baseline. `vote` is required only for island.

`act` receives only that player's copied local observation, previous-transition
reward and turn. `vote` additionally receives valid target IDs and public council
history. The factory does not receive a world object. Supply separate models or
memory per agent inside your factory as needed.

`learn` receives `{phase, observation, action, reward, nextObservation, terminated,
truncated, done}`. `phase` describes the transition just taken: `survival` means
`action` is a movement ID; `council` means it is a voted player ID. No movement or
simulation time passes during a vote. The callback is not called for a player
already eliminated before that transition. Frameworks, replay and optimizers are
entirely your choice.

## 3. Use the API directly

```js
import {createEnvironment, ACTIONS} from './browser/api.mjs';
const env = createEnvironment({id:'island-v1', seed:0});
let state = env.reset();
while (!state.done) {
  if (state.phase === 'council') {
    const active = state.info.alive.flatMap((alive, i) => alive ? [i] : []);
    state = env.vote(state.info.alive.map((alive, i) =>
      alive ? active.find(target => target !== i) : null));
  } else {
    state = env.step(Array(env.agentCount).fill(ACTIONS.WAIT));
  }
}
console.log(state.info.winner);
```

Python has the same methods and result fields, using lists instead of typed arrays:

```python
from survival_env.api import Environment

with Environment("survival-v2", seed=0) as env:
    state = env.reset()
    while not state["done"]:
        state = env.step([0] * env.agent_count)  # Replace with your policy.
```

Use a context manager or call `close()` to release the Python wrapper's Node
subprocess. A wrapper instance is synchronous and not thread-safe. The bridge
uses local stdin/stdout JSON lines; it opens no network port.

### Available environments

| ID | Rules / observations | Reward |
|---|---|---|
| `island-v1` | Eight castaways; food, storms, exposure; council every 8 movement turns. 8 channels. | +1 once for the last remaining player; 0 for everyone else. No per-turn reward. |
| `survival-v2` | Original finite-wear survival rules used by both the grid and mouse demos. 8 channels. | +1 for each player alive after a movement transition. |
| `legacy-v1` | Original resource-depletion grid without wear or storms. 5 channels. | +1 for each player alive after a movement transition. |

The meadow and synthetic grid are different presentations of the same v2 rules,
not different learning tasks. The earliest recording is playback of a legacy run.
The separate Target Drift UI demo is not part of this API.

### Methods and state

| Method | Contract |
|---|---|
| `createEnvironment({id, seed, config, councilEvery})` | JS constructor. Default island, seed 0, eight agents. |
| `Environment(id, seed=0, config=None, council_every=8)` | Python constructor for the same Node implementation. |
| `reset({seed})` / Python `reset(seed=...)` | Starts fresh; omission repeats the last seed. Resets council history, all state and rewards. |
| `step(actions)` | Exactly one integer movement action per agent slot, including eliminated slots (use 0 there). |
| `vote(targets)` | Island council only. One target per slot; inactive slots must be `null` / `None`. Every remaining player must vote for another remaining player. |
| `frame()` | Copied full-world data for your renderer/debugger. Keep it out of local-observation policy inputs. |

`reset`, `step` and `vote` return:

```js
{
  observations, // JS: Float32Array per player. Python: list of float lists.
  rewards,      // One number per player; transition reward, not cumulative score.
  terminated,   // Per-player absorbing elimination or actual game completion.
  truncated,    // Per-player living cutoff; retain bootstrap when appropriate.
  done,         // Whole episode finished. Call reset; further step/vote is invalid.
  phase,        // 'survival', 'council' or 'finished'.
  info: {environment, apiVersion, seed, tick, alive, winner, councils}
}
```

`terminated` and `truncated` are per-agent Boolean arrays. A death on the horizon
is termination, not truncation. Living agents reaching a time limit truncate;
a last-player island win terminates the whole game. At island completion, the
winner's terminal observation remains its actual local view; eliminated players
receive zeros. Bootstrap a truncated player from the returned observation before
reset. Council transitions do not advance `tick`; a trainer must decide explicitly
how to discount voting decisions. Do not blindly count councils as survival turns.

All returned arrays and observer frames are copies. Metadata: JS `agentCount`,
`observationShape`, `actionCount`, `config`; Python uses `agent_count`,
`observation_shape`, `action_count`, `config`.

### Local observation layout

Shape per agent is `[channels, 2*radius+1, 2*radius+1]`, flattened channel-first.
Default: `[8,5,5]` (200 floats), or `[5,5,5]` for legacy. Index is
`channel*width*width + row*width + column`.

| Channel | Meaning |
|---|---|
| 0 | Nearby food |
| 1 | Self |
| 2 | Other living players nearby |
| 3 | Valid map cells |
| 4 | Own energy fraction, repeated across the channel |
| 5 | Active nearby hazards (v2/island only) |
| 6 | Own wear/exposure fraction (v2/island only) |
| 7 | Own health fraction (v2/island only) |

Configuration uses the existing engine names: see [synthetic defaults](../browser/synthetic.mjs)
and [legacy defaults](../browser/simulator.mjs). Island adds `councilEvery` (1–12)
and requires at least two agents. Invalid moves/configuration/ballots raise errors.
Bad ballots do not partially eliminate players. Most votes eliminates one player;
a seeded draw among tied candidates breaks ties. Simultaneous total elimination
produces no winner and no positive reward. Old training rewards are unchanged.

## Reproduce and test

```sh
node --test browser/tests/*.test.mjs
python -B -m unittest tests.test_api -v
```

Pin a Git commit and record the environment ID, full configuration, episode seeds,
agent code/model version, model RNG seeds and inference settings. Reset private
agent memory between episodes. Same environment seed plus same decisions gives
repeatable episodes; an unseeded agent need not. The Python wrapper matches Node
because it invokes Node. The older native NumPy environment uses a different RNG;
equal numeric seeds do **not** imply identical native-Python/JavaScript episodes.

The API is a small project interface, not a Gymnasium/PettingZoo compatibility
claim. Research checkpoints trained on older survival rewards are not validated
island controllers. For a walkthrough on the site: [Environment API](https://clarkwhitehead.com/environments/).
