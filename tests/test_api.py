"""Verify Python uses the actual canonical Node rules, including invalid requests."""
import json
import subprocess
import unittest
from pathlib import Path
from survival_env.api import Environment

ROOT = Path(__file__).resolve().parents[1]


class ApiTests(unittest.TestCase):
    def test_python_node_exact_transition_parity(self):
        for env_id in ("island-v1", "survival-v2", "legacy-v1"):
            script = "import {createEnvironment} from './browser/api.mjs'; const e=createEnvironment({id:process.argv[1],seed:19});e.reset();console.log(JSON.stringify(e.step(Array(8).fill(0)),(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v));"
            expected = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", script, env_id], cwd=ROOT, text=True))
            with Environment(env_id, seed=19) as env:
                env.reset()
                self.assertEqual(env.step([0]*8), expected)
            self.assertIsNotNone(env._process.poll())
            with self.assertRaises(RuntimeError):
                env.reset()

    def test_vote_validation_does_not_poison_next_request(self):
        with Environment(council_every=1, config={"hazard_count": 0}) as env:
            state = env.step([0]*8)
            before = env.frame()
            with self.assertRaises(ValueError):
                env.vote([0]*8)
            self.assertEqual(env.frame(), before)
            votes = [1] + [0]*7
            state = env.vote(votes)
            self.assertEqual(sum(state["info"]["alive"]), 7)
            self.assertEqual(state["rewards"], [0]*8)
            self.assertEqual(env.reset()["info"]["tick"], 0)

    def test_invalid_construction_and_no_node(self):
        with self.assertRaises(ValueError):
            Environment("unknown")
        with self.assertRaises(RuntimeError):
            Environment(node="no-such-node-executable")
