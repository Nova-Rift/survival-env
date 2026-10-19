import {SurvivalWorld} from './simulator.mjs';
import {PolicySession} from './policy-session.mjs';

// Scripted wait policy; no model, learning or rendering.
const world = new SurvivalWorld({seed: 0, config: {agents: 2, horizon: 3}});
const session = new PolicySession({agents: world.config.agents, radius: world.config.radius,
  initialState: () => ({steps: 0}),
  policy: ({state}) => ({action: 0, state: {steps: state.steps + 1}})});
let reward = 0;
while (!world.done) {
  const result = world.step(session.actions(world.observe()));
  session.finishStep(result.info, result.done);
  reward += result.rewards.reduce((sum, value) => sum + value, 0);
  // A separate renderer could consume world.frame() here, never policy inputs.
}
console.log(JSON.stringify({ticks: world.tick, reward, trained: false,
  episodeStatesCleared: session.states.every(value => value === null)}));
