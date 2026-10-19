/** Environment API v1. No renderer, network service, model or training dependency. */
import {SurvivalWorld} from './simulator.mjs';
import {SyntheticWorld} from './synthetic.mjs';
import {IslandGame} from './island-game.mjs';
export const API_VERSION = 1;
export const ACTIONS = Object.freeze({WAIT:0, NORTH:1, EAST:2, SOUTH:3, WEST:4});
export const ENVIRONMENTS = Object.freeze(['island-v1', 'survival-v2', 'legacy-v1']);

export function createEnvironment({id = 'island-v1', seed = 0, config = {}, councilEvery = 8} = {}) {
  if (!ENVIRONMENTS.includes(id)) throw new RangeError(`Unknown environment: ${id}`);
  const settings = structuredClone(config);
  if (id === 'island-v1' && (settings.agents ?? 8) < 2) throw new RangeError('The island game needs at least two agents');
  let currentSeed = seed, engine;
  const island = id === 'island-v1';
  const world = () => island ? engine.world : engine;
  function reset({seed: nextSeed = currentSeed} = {}) {
    // Build before replacing the current episode so invalid resets are atomic.
    const next = island ? new IslandGame({seed:nextSeed, config:settings, councilEvery})
      : id === 'survival-v2' ? new SyntheticWorld({seed:nextSeed, config:settings})
      : new SurvivalWorld({seed:nextSeed, config:settings});
    engine = next; currentSeed = nextSeed;
    return result(Array(world().config.agents).fill(0));
  }
  function result(rewards) {
    const frame = engine.frame(), c = world().config, done = engine.done;
    const gameTerminal = island && done && frame.alive.filter(Boolean).length <= 1;
    const terminated = frame.alive.map(alive => !alive || gameTerminal);
    const truncated = frame.alive.map((alive, i) => alive && frame.tick >= c.horizon && !terminated[i]);
    return {
      observations: world().observe(), rewards: Array.from(rewards), terminated, truncated, done,
      phase: island ? engine.phase : done ? 'finished' : 'survival',
      info: {environment:id, apiVersion:API_VERSION, seed:currentSeed, tick:frame.tick,
        alive:frame.alive.slice(), winner:island ? frame.winner : null,
        // Public council history is available to voting agents; no positions or map.
        councils:island ? structuredClone(frame.councils) : []},
    };
  }
  reset();
  const c = world().config, width = 2*c.radius+1;
  return Object.freeze({
    id, apiVersion:API_VERSION, agentCount:c.agents,
    observationShape:Object.freeze([id === 'legacy-v1' ? 5 : 8, width, width]),
    actionCount:5, config:Object.freeze({...c}),
    reset,
    step(actions) {
      if (engine.done) throw new Error('Episode finished; call reset()');
      const transition = engine.step(actions);
      return result(transition.rewards);
    },
    vote(targets) {
      if (!island || engine.phase !== 'council') throw new Error('Voting requires an active island council');
      if (!Array.isArray(targets) || targets.length !== c.agents || targets.some((target, i) =>
        !engine.remaining.includes(i) && target !== null)) throw new RangeError('Supply one target per slot; inactive slots must be null');
      const ballots = engine.remaining.map(voter => ({voter, target:targets[voter], source:'agent', reason:'Custom agent vote.'}));
      const transition = engine.resolveCouncil(ballots);
      return result(transition.rewards);
    },
    // Copied full-world observer output: for your renderer/debugger, not policy input.
    frame() { return engine.frame(); },
  });
}
