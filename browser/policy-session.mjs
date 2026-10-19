/** Synchronous local-observation policy boundary. No world, renderer or weights.
 * policy({observation, previousAction, state}) -> {action, state}
 * State is explicitly per agent and reset on death / episode completion.
 * A future recurrent model must implement encoder + recurrent update + actor.
 */
export class PolicySession {
  constructor({agents, radius, policy, initialState = () => null}) {
    if (!Number.isInteger(agents) || agents < 1 || agents > 256 ||
        !Number.isInteger(radius) || radius < 0 || radius > 16 ||
        typeof policy !== 'function' || typeof initialState !== 'function') throw new TypeError('Invalid policy session');
    this.agents = agents;
    this.radius = radius;
    this.policy = policy;
    this.initialState = initialState;
    this.beginEpisode();
  }
  beginEpisode() {
    // Clone even if a caller's factory accidentally returns the same object.
    this.states = Array.from({length: this.agents}, () => structuredClone(this.initialState()));
    this.previousActions = Array(this.agents).fill(0);
    this.active = Array(this.agents).fill(true);
    this.pending = false;
    this.finished = false;
  }
  actions(observations) {
    if (this.finished || this.pending) throw new Error('Begin episode / finish prior step before acting');
    const width = 2 * this.radius + 1, plane = width ** 2;
    if (!Array.isArray(observations) || observations.length !== this.agents ||
        observations.some(obs => !(obs instanceof Float32Array) || obs.length !== 5 * plane ||
          obs.some(v => !Number.isFinite(v)))) throw new TypeError('Invalid local observations');
    const actions = [], nextStates = [];
    for (let i = 0; i < this.agents; i++) {
      if (!this.active[i] || !observations[i][plane + this.radius * width + this.radius]) {
        actions.push(0); nextStates.push(null); continue;
      }
      const result = this.policy({observation: observations[i].slice(),
        previousAction: this.previousActions[i], state: structuredClone(this.states[i])});
      if (!Number.isInteger(result?.action) || result.action < 0 || result.action > 4 || !('state' in result)) {
        throw new RangeError('Policy must return an action (0..4) and explicit next state');
      }
      actions.push(result.action); nextStates.push(structuredClone(result.state));
    }
    this.states = nextStates;
    this.previousActions = actions.slice();
    this.pending = true;
    return actions;
  }
  finishStep(info, done) {
    if (!this.pending || !Array.isArray(info?.died) || info.died.length !== this.agents ||
        !info.died.every(v => typeof v === 'boolean') || typeof done !== 'boolean') throw new TypeError('Invalid step completion');
    for (let i = 0; i < this.agents; i++) if (info.died[i] || done) {
      this.states[i] = null; this.previousActions[i] = 0; this.active[i] = false;
    }
    this.pending = false;
    this.finished = done;
  }
}
