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

Only an agent’s own current membership is observable to that agent. Words are private to the people present when spoken.
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


Personal `socialHistory` records invitations, requests, individual supports,
acceptance, denial, departure and exclusion responses with actor, target,
conversation, time and outcome. Only directly involved people receive them.
Pending requests cancelled by membership changes or a council are recorded as
cancelled, not denied. Personal history persists across councils until reset.

`knownConversations` contains identifiers encountered directly or reported in
speech as “conversation N”. An agent can request a known available conversation;
it does not receive external membership, transcripts, or request logs. Invitations
can target any other living person outside the sender's own group, so legal invite
options do not reveal who is in another group. Acceptance remains voluntary and
requires being on one's own. Reported claims stay attributed speech, never become
verified socialHistory, and may be truthful or deceptive. The viewer's global
frame is not an agent observation. Availability of a previously known conversation
is reflected in legal requests, but its current membership is not disclosed.

Invitations are staged until someone accepts: `frame.groups` and observation
`groups` contain only conversations with at least two participants. Single-person
invitation staging lives separately in viewer `pendingConversations` and the
host's `pendingInvitations`; these are not active chats. A lone remaining person
returns to “On their own” (or waiting for an outstanding invitation reply).
Talking remains illegal until another person accepts or is admitted.

### Independent live actors

`new SocialGame({concurrent:true})` supports `step(action, source, actor)` in
completion order. Agents have no individual action limit. `discussionSeconds`
(default120) defines a shared active-play window; `discussionRemainingMs` tracks
its remaining time. Each personal observation includes `voteClock.secondsRemaining`
and the timing rule, so the model knows when voting is approaching. Counters are
statistics only. Pass means wait temporarily and reconsider, not opt out until the
next council. `beginVote()` closes social actions and requires one private ballot
per remaining player. After elimination, the full discussion duration resets.

The host owns timing: stop dispatch at zero, drain all in-flight decisions and
assessments, then call `beginVote()`. Pause must stop active time. Clock passage
alone must not invalidate an otherwise current personal observation. The local
runner uses a monotonic clock, five-second wait cooldowns bypassed by new private
information, and independent conversation lanes. No clock ticks consume inference.
There is no guaranteed number of messages; agents may choose silence throughout.
Default `concurrent:false` preserves the authored sequential API.
The application scheduler must serialize messages within each conversation and
finish assessments before advancing that conversation. Separate conversations and
solo agents run independently. Revalidate personal observations before applying an
asynchronous result; personal notifications may change its context or legal actions.
A pending solo inviter may accept another invitation, withdrawing its pending group.
