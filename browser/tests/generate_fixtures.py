"""Generate deterministic browser parity fixtures using the canonical Python world.

Records actual NumPy choice inputs/outputs rather than pretending JS seeds are PCG64.
No Python production mechanics are copied or modified here.
"""
from dataclasses import asdict
import argparse
import hashlib
import json
from pathlib import Path
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from survival_env.simulator import Config, SurvivalWorld


class RecordingRandom:
    def __init__(self, seed):
        self.rng = np.random.default_rng(seed)
        self.draws = []

    def choice(self, candidates, count, replace=False):
        assert not replace
        selected = self.rng.choice(candidates, count, replace=False)
        candidates = list(range(candidates)) if isinstance(candidates, int) else candidates.tolist()
        self.draws.append({'candidates': candidates, 'count': count, 'selected': selected.tolist()})
        return selected


def observation(world):
    return world.observe().reshape(world.config.agents, -1).tolist()


def fixture(name, config, seed, actions, patch=None):
    random = RecordingRandom(seed)
    # Inject at the NumPy construction boundary without changing production code.
    from unittest.mock import patch as mock_patch
    with mock_patch('survival_env.simulator.np.random.default_rng', return_value=random):
        world = SurvivalWorld(seed, config)
    if patch:
        world.positions[:] = patch['positions']
        world.hunger[:] = patch.get('hunger', [config.max_hunger] * config.agents)
        world.alive[:] = patch.get('alive', [True] * config.agents)
        world.food[:] = False
        for y, x in patch.get('food', []):
            world.food[y, x] = True
    initial = {'frame': world.frame(), 'observations': observation(world), 'done': bool(world.done)}
    steps = []
    for moves in actions:
        if world.done:
            break
        obs, rewards, done, info = world.step(moves)
        steps.append({'actions': moves, 'frame': world.frame(),
                      'observations': obs.reshape(config.agents, -1).tolist(),
                      'rewards': rewards.tolist(), 'done': bool(done),
                      'info': {'ate': info['ate'].tolist(), 'died': info['died'].tolist(),
                               'truncated': bool(info['truncated'])}})
    return {'name': name, 'config': asdict(config), 'patch': bool(patch),
            'draws': random.draws, 'initial': initial, 'steps': steps}


def generate():
    base = dict(size=4, agents=2, initial_food=0, food_per_step=0, radius=1)
    cases = []
    def add(name, actions, patch, **config):
        cases.append(fixture(name, Config(**(base | config)), 17, actions, patch))
    add('contested-food', [[2, 4], [0, 0]],
        {'positions': [[1, 0], [1, 2]], 'food': [[1, 1]]})
    add('swap-rejected', [[2, 4]], {'positions': [[1, 0], [1, 1]]})
    add('initially-occupied-and-wall', [[1, 0], [2, 2], [2, 2]],
        {'positions': [[0, 0], [0, 1]]})
    add('last-moment-food-and-absorbing-death', [[2, 0], [0, 1], [0, 4]],
        {'positions': [[0, 0], [3, 3]], 'hunger': [1, 1], 'food': [[0, 1]]}, max_hunger=2)
    add('dead-cell-can-be-entered', [[2, 4]],
        {'positions': [[1, 0], [1, 1]], 'alive': [True, False], 'hunger': [3, 0]}, max_hunger=3)
    add('horizon-truncation', [[0, 0]], {'positions': [[0, 0], [3, 3]]}, horizon=1)
    add('death-and-horizon-together', [[0, 0]],
        {'positions': [[0, 0], [3, 3]]}, max_hunger=1, horizon=1)
    add('radius-zero-food-under-self', [[0, 0], [2, 4]],
        {'positions': [[0, 0], [3, 3]], 'food': [[0, 0]], 'hunger': [1, 3]}, radius=0, max_hunger=3)
    cases.append(fixture('saturated-food-and-spawn',
        Config(size=3, agents=4, radius=1, initial_food=100, food_per_step=100,
               max_hunger=4, horizon=8), 29, [[2, 3, 4, 1]] * 8))
    cases.append(fixture('full-occupancy-no-spawn-candidates',
        Config(size=2, agents=4, radius=2, initial_food=20, food_per_step=20,
               max_hunger=2), 31, [[0] * 4] * 2))
    for seed in range(8):
        actions = np.random.default_rng(seed + 900).integers(0, 5, (12, 3)).tolist()
        cases.append(fixture(f'seeded-rollout-{seed}',
            Config(size=5, agents=3, radius=seed % 3, initial_food=5,
                   food_per_step=seed % 3, max_hunger=5, horizon=12), seed, actions))
    return {'format': 1, 'source': 'survival_env/simulator.py',
            'source_sha256': hashlib.sha256((ROOT / 'survival_env/simulator.py').read_bytes()).hexdigest(),
            'numpy_version': np.__version__, 'cases': cases}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    target = Path(__file__).with_name('fixtures.json')
    output = json.dumps(generate(), separators=(',', ':'), allow_nan=False) + '\n'
    if args.check:
        if not target.exists() or target.read_text() != output:
            raise SystemExit('Fixtures differ from current Python source/runtime; review before regenerating.')
        print('Python parity fixtures match canonical source and current NumPy output.')
    else:
        target.write_text(output)
        print(f'Wrote {target.name}: {len(json.loads(output)["cases"])} cases')
