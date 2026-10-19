"""Python access to the canonical JavaScript environments. Requires a source clone + Node 22+."""
import json
from pathlib import Path
import shutil
import subprocess


class Environment:
    """reset(), step(actions), vote(targets), frame(); arrays are ordinary Python lists."""

    def __init__(self, env_id="island-v1", *, seed=0, config=None, council_every=8, node="node"):
        executable = shutil.which(node)
        if not executable:
            raise RuntimeError("Node.js 22+ is required; install it separately, then retry")
        bridge = Path(__file__).resolve().parents[1] / "browser" / "api-server.mjs"
        if not bridge.is_file():
            raise RuntimeError("Use the GitHub source checkout; this bridge requires browser/api-server.mjs")
        self._request_id = 0
        self._process = subprocess.Popen([executable, str(bridge)], stdin=subprocess.PIPE,
                                         stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                         text=True, encoding="utf-8", bufsize=1)
        try:
            metadata = self._call("create", options={"id": env_id, "seed": seed,
                                  "config": config or {}, "councilEvery": council_every})
            self.id = metadata["id"]
            self.agent_count = metadata["agentCount"]
            self.observation_shape = tuple(metadata["observationShape"])
            self.action_count = metadata["actionCount"]
            self.config = metadata["config"]
        except BaseException:
            self.close()
            raise

    def _call(self, method, **arguments):
        if self._process.poll() is not None:
            raise RuntimeError("Environment process is closed")
        self._request_id += 1
        request = json.dumps({"id": self._request_id, "method": method, **arguments}, allow_nan=False)
        try:
            self._process.stdin.write(request + "\n")
            self._process.stdin.flush()
            line = self._process.stdout.readline()
        except (BrokenPipeError, OSError, ValueError) as exc:
            raise RuntimeError("Environment transport closed") from exc
        if not line:
            raise RuntimeError("Environment process exited without a response")
        response = json.loads(line)
        if response.get("id") != self._request_id:
            raise RuntimeError("Environment response ID mismatch")
        if "error" in response:
            raise ValueError(response["error"])
        return response["result"]

    def reset(self, *, seed=None):
        return self._call("reset", options={} if seed is None else {"seed": seed})

    def step(self, actions):
        return self._call("step", actions=list(actions))

    def vote(self, targets):
        return self._call("vote", targets=list(targets))

    def frame(self):
        """Full-world observer copy. Do not give this to local-observation agents."""
        return self._call("frame")

    def close(self):
        if self._process.stdin and not self._process.stdin.closed:
            try:
                self._process.stdin.close()
            except (BrokenPipeError, OSError):
                pass
        try:
            self._process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self._process.kill()
            self._process.wait()
        if self._process.stdout and not self._process.stdout.closed:
            self._process.stdout.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
