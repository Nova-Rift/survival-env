# Survival Env

Canonical NumPy-only survival grid environment. Agent/model code lives in [survival-agent](https://github.com/Nova-Rift/survival-agent); adapters, experiments and the recorded demo live in [survival-agent-pilot](https://github.com/Nova-Rift/survival-agent-pilot). No weights or ML library is required by this source.

## Quickstart from this checkout

Python 3.10+ and NumPy are prerequisites. Run from this repository root:

```bash
python -B -m examples.custom_policy
python -B -m survival_env.run --policy greedy --seed 0 --steps 4 --output runs/quickstart
python -B -m unittest discover -v
```

The custom wait policy completes three joint steps with reward 24. The runner creates `summary.json`, `frames.json` and offline `replay.html`; choose a fresh output directory for another run. This is scripted behavior, not trained AI. Tests also block agent and ML imports.

## Installation definition

`requirements.txt` and package metadata require only NumPy. A fresh virtual environment and dependency installation were **not tested**; the source quickstart was checked using existing NumPy 1.26.4 / Python 3.10.12. No dependencies are installed by the examples. Independent wheel build remains untested because available setuptools is older than the declared build requirement.

## Current API

`SurvivalWorld(seed=0, config=Config())` initializes an episode; construct another instance to reset. `observe()` returns local `float32 (agents, 5, 2*radius+1, 2*radius+1)` observations. Default: eight agents, five channels, 5x5 windows in a 16x16 world. Channels: food, self, other living agents, valid cell, own hunger fraction. Dead observations are zero.

`step(actions)` accepts integer actions for all slots: 0 wait, 1 north, 2 east, 3 south, 4 west. It returns **four** values: observations, per-agent rewards, scalar done, info. `info['died']` gives per-agent termination; `info['truncated']` is the horizon flag. A living agent at horizon truncates; death takes precedence. Reward is one for each agent alive after transition. Dead slots stay inactive. Calling step after done raises.

Moves are simultaneous; occupied/swapped/contested destinations fail. Agents receive only local observation; full-world state/frame methods are for infrastructure and inspection. Optional local communication does not execute text or shape reward. No PettingZoo/Gymnasium compliance, arbitrary engine support or learned result is claimed.

## Ownership and provenance

Edit environment mechanics here. Do not copy an independently maintained environment back into the pilot repo; update its pinned source reference instead. This extraction preserves the previous environment implementation bytes from pilot commit `be2e3f43b972a6cd83b0f31f420abdfd3b3a7f1e`; original history remains in the pilot repository. No source license has yet been selected; public availability alone is not an open-source license grant.

See [security boundaries](SECURITY.md). Richer open-source engines remain future work; none is installed or integrated.
