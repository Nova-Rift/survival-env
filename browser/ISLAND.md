# Island survival v1

A separate playable island game requested October 19, 2026. `island-game.mjs`
composes the unchanged `SyntheticWorld` rules, adds forced councils every eight
survival transitions and changes the **game reward** to winner +1, everyone else 0.
It does not alter synthetic-v2 rewards, old policy training or recorded evidence.

- Eight castaways share fruit and avoid storm zones. Energy, health and exposure
  present the existing power, integrity and irreversible-wear mechanics.
- At council, simulation time stops. Every remaining player must cast exactly one
  non-self vote for another remaining player. Validation happens before mutation.
- Highest vote count eliminates a player from the actual world occupancy and
  observations. Ties use a reproducible seeded draw among tied players.
- The last remaining player wins. Simultaneous elimination of everybody gives no
  winner and zero reward to all. There is **no per-turn game reward**.
- The browser demo currently uses scripted movement and explicitly labeled seeded
  rule ballots. No language model, trained island policy or learned cooperation
  is claimed. A separate Site dialogue adapter is prepared; runtime model access
  is pending the researcher's browser-model / hosted-model decision.
- `island-renderer.mjs` draws human avatars and observes copied frames only. A
  rectangular viewport changes presentation, not grid coordinates or rules.
- `step()` and `resolveCouncil()` emit the terminal winner reward once. After
  termination neither stepping nor a second council resolution is permitted.
  `frame().rewards` is the final scoreboard, not repeated reward emission.
- A new game resets votes, elimination history, winner, RNG and player state.

No training was performed. This game is not a drop-in evaluation environment for
existing synthetic-v2 checkpoints. Earlier synthetic-v2 and legacy experiments
retain their original rules and rewards. The Site archive preserves separately
pinned runnable mouse and grid demos, plus the original playable recording.
