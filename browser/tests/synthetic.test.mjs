import test from 'node:test';
import assert from 'node:assert/strict';
import {SyntheticWorld, SYNTHETIC_VERSION} from '../synthetic.mjs';
import {DemoRuntime} from '../demo-runtime.mjs';
import {createScriptedController} from '../scripted.mjs';
import {drawSyntheticFrame} from '../renderer.mjs';
import {drawIslandFrame} from '../island-renderer.mjs';

test('wear guarantees terminal failure despite replenishment every simulation step', () => {
  const world = new SyntheticWorld({config: {agents: 1, wear_limit: 3, horizon: 10, hazard_count: 0}});
  for (let step = 1; step <= 3; step++) {
    const [y, x] = world.base.positions[0]; world.base.food[y*world.config.size+x] = 1;
    const result = world.step([0]);
    assert.equal(world.wear[0], step);
    assert.equal(result.info.truncated, false);
    assert.equal(result.rewards[0], step === 3 ? 0 : 1);
  }
  assert.equal(world.done, true); assert.deepEqual(world.failureCauses[0], ['lifetime wear']);
  assert.throws(() => world.step([0]), /finished/);
});
test('horizon truncation and simultaneous wear/horizon preserve correct continuation', () => {
  const early = new SyntheticWorld({config: {agents: 1, wear_limit: 4, horizon: 1, hazard_count: 0}});
  const a = early.step([0]);
  assert.equal(a.info.terminated[0], false); assert.equal(a.info.truncated, true); assert.equal(a.info.continuation[0], 1);
  const same = new SyntheticWorld({config: {agents: 1, wear_limit: 2, horizon: 2, hazard_count: 0}});
  same.step([0]); const b = same.step([0]);
  assert.equal(b.info.terminated[0], true); assert.equal(b.info.truncated, true); assert.equal(b.info.continuation[0], 0);
});
test('active zones cause persistent integrity damage and terminal failure', () => {
  const world = new SyntheticWorld({config: {agents: 1, max_integrity: 2, hazard_count: 1, hazard_period: 12}});
  const [y, x] = world.base.positions[0]; world.hazardCells = [y*world.config.size+x];
  world.step([0]); assert.equal(world.integrity[0], 1);
  const result = world.step([0]);
  assert.equal(world.integrity[0], 0); assert.equal(result.rewards[0], 0);
  assert.deepEqual(world.failureCauses[0], ['integrity failure']);
  assert.ok(result.observations[0].every(v => v === 0));
});
test('zones switch on and off by simulation tick, not wall time', () => {
  const world = new SyntheticWorld({config: {agents: 1, max_integrity: 10, hazard_count: 1, hazard_period: 4}});
  const [y, x] = world.base.positions[0]; world.hazardCells = [y*world.config.size+x];
  world.step([0]); assert.equal(world.integrity[0], 9);
  world.step([0]); assert.equal(world.hazardsActive, false); assert.equal(world.integrity[0], 9);
  world.step([0]); assert.equal(world.integrity[0], 9);
  world.step([0]); assert.equal(world.hazardsActive, true); assert.equal(world.integrity[0], 8);
});
test('simultaneous contested movement and resource competition remain real', () => {
  const world = new SyntheticWorld({config: {size: 4, agents: 2, initial_resources: 0, resources_per_step: 0, hazard_count: 0}});
  world.base.positions = [[1, 0], [1, 2]]; world.base.food[5] = 1;
  world.step([2, 4]); assert.deepEqual(world.base.positions, [[1, 0], [1, 2]]);
  assert.equal(world.base.food[5], 1);
  const result = world.step([2, 0]);
  assert.deepEqual(result.info.ate, [true, false]); assert.equal(world.base.food[5], 0);
});
test('checkpoint preserves wear, integrity and RNG stream without live references', () => {
  const a = new SyntheticWorld({seed: 9}); a.step(Array(8).fill(0));
  const state = a.state(), b = new SyntheticWorld({seed: 9}); b.loadState(state);
  assert.deepEqual(a.frame(), b.frame());
  a.step(Array(8).fill(0)); b.step(Array(8).fill(0)); assert.deepEqual(a.state(), b.state());
  state.wear[0] = 999; assert.notEqual(b.wear[0], 999);
  assert.throws(() => b.loadState(state));
});
test('local eight-channel observations hide remote hazards and agent state', () => {
  const world = new SyntheticWorld({config: {size: 8, agents: 2, radius: 1, hazard_count: 0}});
  world.base.positions = [[1, 1], [7, 7]];
  const before = world.observe()[0];
  world.hazardCells = [6*8+6]; world.integrity[1] = 1; world.wear[1] = 20;
  assert.deepEqual(world.observe()[0], before);
  assert.equal(before.length, 8*9);
});
test('eight scripted local agents survive only within hard lifetime bound', () => {
  const world = new SyntheticWorld({seed: 0});
  const controller = createScriptedController({agents: 8, radius: 2, seed: 0});
  while (!world.done) {
    const actions = controller.actions(world.observe());
    assert.equal(actions.length, 8); assert.ok(actions.every(a => Number.isInteger(a) && a >= 0 && a <= 4));
    world.step(actions);
  }
  assert.ok(world.tick <= world.config.wear_limit);
  assert.ok(world.base.alive.every(v => !v));
  assert.equal(world.frame().version, SYNTHETIC_VERSION);
});
test('play pause reset speed and automatic stop coordinator semantics', () => {
  const runtime = new DemoRuntime({config: {wear_limit: 2, hazard_count: 0}}), initial = runtime.world.frame();
  assert.deepEqual(runtime.advance(), initial);
  runtime.setSpeed(4); assert.equal(runtime.world.tick, 0);
  runtime.play(); assert.equal(runtime.advance().tick, 1);
  runtime.pause(); assert.equal(runtime.advance().tick, 1);
  runtime.play(); assert.equal(runtime.advance().tick, 2); assert.equal(runtime.playing, false);
  assert.deepEqual(runtime.reset(), initial);
  assert.equal(runtime.playing, false);
  assert.notDeepEqual(runtime.reset(1), initial);
  assert.throws(() => runtime.setSpeed(999));
});
test('invalid action does not advance wear or mutate the environment', () => {
  const world = new SyntheticWorld(), before = world.state();
  assert.throws(() => world.step([0])); assert.deepEqual(world.state(), before);
  for (const config of [{wear_limit: Infinity}, {wear_limit: 1}, {hazard_damage: 0}, {unknown: 4}]) assert.throws(() => new SyntheticWorld({config}));
});
test('Canvas observer draws actual frame geometry without stepping world', () => {
  const world = new SyntheticWorld(), before = world.state(), calls = [];
  const ctx = {canvas: {width: 320, height: 320}};
  for (const name of ['clearRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'arc', 'ellipse',
    'fill', 'fillText', 'save', 'restore', 'translate', 'rotate', 'quadraticCurveTo', 'closePath']) ctx[name] = (...args) => calls.push([name, ...args]);
  drawSyntheticFrame(ctx, world.frame(), world.config);
  assert.equal(calls.filter(v => v[0] === 'fillText').length, 8);
  assert.equal(calls.filter(v => v[0] === 'translate').length, 8);
  const translations = calls.filter(v => v[0] === 'translate').map(v => v.slice(1));
  assert.ok(translations.every(([cx, cy], i) => {
    const [y, x] = world.frame().positions[i];
    return Math.abs(cx - (x + .5) * 20) < 1e-9 && Math.abs(cy - (y + .45) * 20) < 1e-9;
  }));
  // A wide viewport shows every row without stretching mouse geometry.
  calls.length = 0; ctx.canvas.width = 960;
  drawSyntheticFrame(ctx, world.frame(), world.config);
  assert.deepEqual(calls.filter(v => v[0] === 'translate').map(v => v.slice(1)),
    world.frame().positions.map(([y,x]) => [(x+.5)*60, (y+.5)*20-1]));
  assert.ok(calls.filter(v => v[0] === 'arc').every(v => v[3] <= 20));
  assert.ok(calls.filter(v => v[0] === 'fillRect').some(v => v[1] === 900 && v[2] === 300 && v[3] === 60 && v[4] === 20));
  calls.length = 0; ctx.canvas.width = 320;
  drawSyntheticFrame(ctx, world.frame(), world.config);
  assert.ok(calls.every(v => v.slice(1).every(x => typeof x !== 'number' || Number.isFinite(x))));
  assert.deepEqual(world.state(), before);
  const initialCalls = structuredClone(calls);
  calls.length = 0;
  drawSyntheticFrame(ctx, world.frame(), world.config);
  assert.deepEqual(calls, initialCalls); // Drawing has no animation timer or random state.
  let previous = world.frame();
  while (!world.done) {
    world.step(Array(8).fill(0));
    const snapshot = world.state();
    calls.length = 0;
    drawSyntheticFrame(ctx, world.frame(), world.config, previous);
    assert.equal(calls.filter(v => v[0] === 'fillText').length, world.frame().alive.filter(Boolean).length);
    assert.ok(calls.every(v => v.slice(1).every(x => typeof x !== 'number' || Number.isFinite(x))));
    assert.deepEqual(world.state(), snapshot);
    previous = world.frame();
  }
});

test('island renderer keeps all players inside a wide viewport without mutating state', () => {
  const world = new SyntheticWorld(), before = world.state(), calls = [];
  const ctx = {canvas: {width: 960, height: 320}};
  for (const name of ['clearRect','fillRect','beginPath','moveTo','lineTo','stroke','arc','ellipse','fill','fillText','save','restore','translate'])
    ctx[name] = (...args) => calls.push([name, ...args]);
  drawIslandFrame(ctx, world.frame(), world.config);
  assert.deepEqual(calls.filter(v => v[0] === 'translate').map(v => v.slice(1)),
    world.frame().positions.map(([y,x]) => [(x+.5)*60, (y+.5)*20]));
  assert.equal(calls.filter(v => v[0] === 'fillText').length, 8);
  assert.ok(calls.every(v => v.slice(1).every(x => typeof x !== 'number' || Number.isFinite(x))));
  assert.deepEqual(world.state(), before);
});
