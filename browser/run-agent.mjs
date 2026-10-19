/** Run your own trusted JS agent module locally. Node 22+, no npm install. */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createEnvironment} from './api.mjs';

const args = process.argv.slice(2), options = {env:'island-v1', agent:'examples/agents/random.mjs', seed:0, episodes:1};
if (args.includes('--help')) {
  console.log('node browser/run-agent.mjs --env island-v1 --agent ./examples/agents/random.mjs --seed 0 --episodes 1');
  process.exit(0);
}
for (let i=0; i<args.length; i+=2) {
  const key = args[i].slice(2), value = args[i+1];
  if (!args[i].startsWith('--') || !Object.hasOwn(options,key) || value === undefined) throw new Error('Unknown or incomplete option; use --help');
  options[key] = ['seed','episodes'].includes(key) ? Number(value) : value;
}
if (!Number.isInteger(options.seed) || options.seed<0 || options.seed>0xffffffff ||
    !Number.isInteger(options.episodes) || options.episodes<1 || options.episodes>10000 || options.seed+options.episodes-1>0xffffffff) throw new RangeError('Invalid seed or episode count');
const {createAgent} = await import(pathToFileURL(resolve(options.agent)).href);
if (typeof createAgent !== 'function') throw new TypeError('Agent module must export createAgent({id, seed, observationShape, actionCount})');
const env = createEnvironment({id:options.env, seed:options.seed});
for (let episode=0; episode<options.episodes; episode++) {
  const seed = options.seed + episode;
  let state = env.reset({seed});
  const agents = await Promise.all(Array.from({length:env.agentCount}, (_,id) => createAgent({id,seed,observationShape:env.observationShape,actionCount:env.actionCount})));
  if (agents.some(agent => typeof agent?.act !== 'function' || (options.env === 'island-v1' && typeof agent.vote !== 'function'))) throw new TypeError('Each agent needs act(), plus vote() for island-v1');
  const returns = Array(env.agentCount).fill(0);
  while (!state.done) {
    const previous = state, voting = state.phase === 'council';
    // Each call receives only that player's copied observation and public council data.
    const choices = await Promise.all(agents.map((agent,id) => {
      if (!state.info.alive[id]) return voting ? null : 0;
      const input = {observation:state.observations[id].slice(), reward:state.rewards[id], tick:state.info.tick};
      return voting ? agent.vote({...input, candidates:state.info.alive.flatMap((alive,j) => alive && j!==id ? [j] : []), councils:structuredClone(state.info.councils)}) : agent.act(input);
    }));
    state = voting ? env.vote(choices) : env.step(choices);
    for (let id=0; id<env.agentCount; id++) {
      returns[id] += state.rewards[id];
      if (previous.info.alive[id] && typeof agents[id].learn === 'function') await agents[id].learn({
        phase:previous.phase, observation:previous.observations[id].slice(), action:choices[id],
        reward:state.rewards[id], nextObservation:state.observations[id].slice(),
        terminated:state.terminated[id], truncated:state.truncated[id], done:state.done,
      });
    }
  }
  console.log(JSON.stringify({environment:env.id,seed,ticks:state.info.tick,councils:state.info.councils.length,winner:state.info.winner,returns}));
}
