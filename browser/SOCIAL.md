# Social game v1

Eight agents have four social rounds, then each remaining agent must vote for
another agent. The most votes eliminates one; a deterministic seed breaks ties.
Repeat until one winner gets +1 and everyone else 0. No movement, resources,
health, weather, survival bonuses or obligation to converse.

Each round gives every remaining agent one decision. An uninvited agent can
`request` to join an existing group. Current members may `admit` or `deny`;
all current members must approve before the requester joins. A denial closes
the request. No content is visible while waiting. Membership changes cancel
pending join requests so consent is never silently transferred to a new group.
 `invite` creates or extends
a private conversation; `join` accepts, `decline` refuses, `leave` exits,
`say` addresses current members, and `pass` sits out. Everyone can decline or
leave without a score penalty. One person can belong to at most one conversation.

`exclude` proposes removing a current member. `agree`/`reject` let other members
respond. Approval needs a strict majority of the other members and at least two
supporters, including the proposer. The target cannot vote on their own removal.
Membership changes cancel pending proposals. An excluded person cannot be invited
back to that conversation. Groups dissolve after each elimination.

Membership is observable; words are private to the people present when spoken.
Joining later does not reveal past messages. Leaving or being excluded stops
future messages, while previously heard messages remain in that agent's memory.
The viewer can inspect every group; model prompts must use `observe(agent)` only,
never the spectator `frame()`. Summaries are private per-agent intentions, not
access to hidden model reasoning. Prior ballots stay hidden until the tally.

```js
import { SocialGame } from './browser/social.mjs';
const game = new SocialGame({seed: 0, rounds: 4});
while (!game.done) {
  const observation = game.observe();
  // Replace with your own agent. Pass is always legal during social rounds.
  const action = observation.legal[0];
  game.step(action, 'agent');
}
console.log(game.frame().winner);
```

`legalActions()` enumerates valid actions. A `say` action also needs `text`;
a `vote` can include `reason`. Any action may include a short public-facing
`intention`. Strings are bounded to180characters. Invalid actions throw before
mutation. Eliminated agents cannot act. `reset()` restores all initial state.

This is an intentionally limited turn-based social game, not a claim to reproduce
human social behavior or trained cooperation. Original island/survival rules and
checkpoints remain unchanged. The public site is scripted; optional paid local
language agents live in https://github.com/Nova-Rift/island-simulator .

## Full personal history

`observe(agent)` returns the entire `heard` history, `ownDecisions` (including
private vote targets/reasons), and `intentions` history since Reset. None is
windowed or replaced by the latest intention card. Only the named agent sees
its own decisions/intentions; private message audience rules remain unchanged.
Histories survive council/group resets, but a new game or page reload clears
in-memory state. The local model pauses on context rejection rather than dropping
old events. Full history availability does not guarantee perfect model recall.
