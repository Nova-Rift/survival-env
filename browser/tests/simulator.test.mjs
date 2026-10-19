import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {SurvivalWorld, SeededRandom} from '../simulator.mjs';
import {PolicySession} from '../policy-session.mjs';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url)));
class ChoiceTape {
  constructor(draws) { this.draws = draws; this.index = 0; }
  sample(candidates, count) {
    const draw = this.draws[this.index++];
    assert.ok(draw, 'unexpected random draw');
    assert.deepEqual(candidates, draw.candidates, 'candidate order / eligibility differs');
    assert.equal(count, draw.count);
    return draw.selected;
  }
  state() { return {index: this.index}; }
  loadState(state) { this.index = state.index; }
}
const observations = world => world.observe().map(obs => Array.from(obs));
test('fixtures identify the unchanged canonical Python mechanics', () => {
  const digest = createHash('sha256').update(readFileSync(new URL('../../survival_env/simulator.py', import.meta.url))).digest('hex');
  assert.equal(digest, fixtures.source_sha256, 'regenerate fixtures after reviewing changed Python rules');
});
for (const fixture of fixtures.cases) test(`Python transition/observation parity: ${fixture.name}`, () => {
  const random = new ChoiceTape(fixture.draws);
  const world = new SurvivalWorld({config: fixture.config, random});
  if (fixture.patch) world.loadState({...world.state(), ...fixture.initial.frame});
  assert.deepEqual(world.frame(), fixture.initial.frame);
  assert.deepEqual(observations(world), fixture.initial.observations);
  assert.equal(world.done, fixture.initial.done);
  for (const expected of fixture.steps) {
    const actual = world.step(expected.actions);
    assert.deepEqual(world.frame(), expected.frame);
    assert.deepEqual(actual.observations.map(obs => Array.from(obs)), expected.observations);
    assert.deepEqual(Array.from(actual.rewards), expected.rewards);
    assert.deepEqual(actual.info, expected.info);
    assert.equal(actual.done, expected.done);
  }
  assert.equal(random.index, fixture.draws.length, 'all Python randomness consumed');
  if (world.done) assert.throws(() => world.step(Array(world.config.agents).fill(0)), /finished/);
});

test('browser RNG seeded repeatability, population invariants and full state resume', () => {
  for (let seed = 0; seed < 5; seed++) {
    const a = new SurvivalWorld({seed}), b = new SurvivalWorld({seed});
    assert.deepEqual(a.state(), b.state());
    const actions = new SeededRandom(seed + 50);
    for (let step = 0; step < 12 && !a.done; step++) {
      const moves = Array.from({length: 8}, () => Math.floor(actions.next() * 5));
      a.step(moves); b.step(moves);
      assert.deepEqual(a.state(), b.state());
      const live = a.positions.filter((_, i) => a.alive[i]);
      assert.equal(new Set(live.map(String)).size, live.length);
      for (const [y, x] of live) {
        assert.ok(y >= 0 && y < a.config.size && x >= 0 && x < a.config.size);
        assert.equal(a.food[y * a.config.size + x], 0);
      }
      const resumed = new SurvivalWorld({seed: 999});
      resumed.loadState(JSON.parse(JSON.stringify(a.state())));
      assert.deepEqual(resumed.state(), a.state());
      b.loadState(resumed.state());
    }
    if (!a.done) { a.step(Array(8).fill(0)); b.step(Array(8).fill(0)); assert.deepEqual(a.state(), b.state()); }
  }
});

test('invalid inputs reject without advancing the world', () => {
  for (const config of [{agents: 0}, {size: 2, agents: 5}, {radius: 1.5}, {horizon: true}, {water: 1}]) {
    assert.throws(() => new SurvivalWorld({config}));
  }
  const world = new SurvivalWorld({config: {agents: 2}}), before = world.state();
  for (const actions of [[0], [5, 0], [-1, 0], [1.2, 0], [NaN, 0], [true, 0], '00', null]) {
    assert.throws(() => world.step(actions)); assert.deepEqual(world.state(), before);
  }
  assert.throws(() => world.loadState({...before, tick: -1}));
  assert.deepEqual(world.state(), before);
  const copy = world.state(); copy.positions[0][0] = -1;
  assert.deepEqual(world.state(), before, 'snapshot has no live references');
  assert.throws(() => new SurvivalWorld({random: {sample: () => [0, 0]}}));
});

test('local observations hide distant agents/food and never alias simulation state', () => {
  const world = new SurvivalWorld({config: {size: 8, agents: 2, radius: 1, initial_food: 0, food_per_step: 0}});
  world.positions = [[1, 1], [7, 7]];
  const before = world.observe()[0];
  world.positions[1] = [6, 7]; world.food[6 * 8 + 6] = 1;
  assert.deepEqual(world.observe()[0], before);
  before.fill(999);
  assert.notDeepEqual(world.observe()[0], before);
  const frame = world.frame(); frame.positions[0][0] = -1;
  assert.equal(world.positions[0][0], 1);
});

test('per-agent recurrent state, previous action, death and episode reset boundary', () => {
  const world = new SurvivalWorld({config: {agents: 2, initial_food: 0, food_per_step: 0, max_hunger: 3}});
  const shared = {count: 0}, calls = [];
  const session = new PolicySession({agents: 2, radius: 2, initialState: () => shared,
    policy: input => {
      assert.deepEqual(Object.keys(input).sort(), ['observation', 'previousAction', 'state']);
      calls.push({count: input.state.count, previousAction: input.previousAction});
      input.observation.fill(9); input.state.count++;
      return {action: 2, state: input.state};
    }});
  assert.notEqual(session.states[0], session.states[1]);
  const obs = world.observe(), original = obs.map(x => x.slice());
  const moves = session.actions(obs); assert.deepEqual(obs, original);
  assert.throws(() => session.actions(obs));
  session.finishStep({died: [false, true]}, false);
  assert.equal(session.states[0].count, 1); assert.equal(session.states[1], null);
  assert.deepEqual(session.actions(obs), [2, 0]);
  assert.deepEqual(calls, [{count: 0, previousAction: 0}, {count: 0, previousAction: 0}, {count: 1, previousAction: 2}]);
  session.finishStep({died: [false, false]}, true);
  assert.deepEqual(session.states, [null, null]);
  assert.throws(() => session.actions(obs));
  session.beginEpisode(); assert.deepEqual(session.previousActions, [0, 0]);
  assert.deepEqual(session.states, [{count: 0}, {count: 0}]);
  assert.deepEqual(shared, {count: 0});
});

test('policy boundary rejects malformed outputs and clears finished episodes', () => {
  const world = new SurvivalWorld({config: {agents: 1, horizon: 1}});
  for (const result of [{action: 8, state: null}, {action: 0}, Promise.resolve({action: 0, state: null})]) {
    const session = new PolicySession({agents: 1, radius: 2, policy: () => result});
    assert.throws(() => session.actions(world.observe()));
    assert.equal(session.pending, false);
  }
  const session = new PolicySession({agents: 1, radius: 2, policy: () => ({action: 0, state: null})});
  const result = world.step(session.actions(world.observe()));
  session.finishStep(result.info, result.done);
  assert.deepEqual(session.active, [false]); assert.equal(session.finished, true);
});
