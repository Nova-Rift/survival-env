"""A tiny Python agent for the same JS island rules used by the website."""
import json
import random
from survival_env.api import Environment


def main():
    with Environment("island-v1", seed=0) as env:
        rngs = [random.Random(100 + i) for i in range(env.agent_count)]
        state = env.reset()
        returns = [0] * env.agent_count
        while not state["done"]:
            if state["phase"] == "council":
                active = [i for i, alive in enumerate(state["info"]["alive"]) if alive]
                votes = [rngs[i].choice([j for j in active if j != i]) if i in active else None
                         for i in range(env.agent_count)]
                state = env.vote(votes)
            else:
                # Replace this with your model(state["observations"][i]).
                actions = [rng.randrange(5) if state["info"]["alive"][i] else 0
                           for i, rng in enumerate(rngs)]
                state = env.step(actions)
            returns = [total + reward for total, reward in zip(returns, state["rewards"])]
        print(json.dumps({"environment": env.id, "winner": state["info"]["winner"],
                          "ticks": state["info"]["tick"], "returns": returns}))


if __name__ == "__main__":
    main()
