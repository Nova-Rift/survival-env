import test from 'node:test';
import assert from 'node:assert/strict';
import {createEnvironment, ENVIRONMENTS} from '../api.mjs';
import {SurvivalWorld} from '../simulator.mjs';
import {SyntheticWorld} from '../synthetic.mjs';

test('API matches canonical legacy and synthetic transitions and never exposes a world frame as policy state',()=>{
 for(const [id,World] of [['legacy-v1',SurvivalWorld],['survival-v2',SyntheticWorld]]){
  const env=createEnvironment({id,seed:17}), world=new World({seed:17});let state=env.reset();
  assert.deepEqual(state.observations,world.observe());
  while(!state.done){const actions=Array(env.agentCount).fill(0), expected=world.step(actions);state=env.step(actions);
   assert.deepEqual(state.observations,expected.observations);assert.deepEqual(state.rewards,Array.from(expected.rewards));assert.equal(state.done,expected.done);}
  assert.deepEqual(env.frame(),world.frame());assert.ok(!('positions' in state.info));
  assert.throws(()=>env.step(Array(env.agentCount).fill(0)));
 }
});
test('truncation retains live bootstrapping while simultaneous wear death is terminal',()=>{
 const truncated=createEnvironment({id:'survival-v2',config:{horizon:1,hazard_count:0}}).step(Array(8).fill(0));
 assert.ok(truncated.truncated.every(Boolean));assert.ok(truncated.terminated.every(v=>!v));
 const env=createEnvironment({id:'survival-v2',config:{horizon:2,wear_limit:2,hazard_count:0}});env.step(Array(8).fill(0));const dead=env.step(Array(8).fill(0));
 assert.ok(dead.terminated.every(Boolean));assert.ok(dead.truncated.every(v=>!v));
});
test('mandatory custom votes, terminal winner reward, reset reproducibility and invalid-input atomicity',()=>{
 const env=createEnvironment({id:'island-v1',config:{hazard_count:0},councilEvery:1});const initial=env.reset();
 let state=env.step(Array(8).fill(0));const before=env.frame();assert.throws(()=>env.step(Array(8).fill(0)));assert.deepEqual(env.frame(),before);
 assert.throws(()=>env.vote(Array(8).fill(0)));assert.deepEqual(env.frame(),before);
 const totals=Array(8).fill(0);
 while(!state.done){if(state.phase==='council'){
   const active=state.info.alive.flatMap((a,i)=>a?[i]:[]);
   state=env.vote(state.info.alive.map((a,i)=>a?active.find(j=>j!==i):null));
  }else state=env.step(Array(8).fill(0));
  state.rewards.forEach((r,i)=>totals[i]+=r);
 }
 assert.equal(totals.reduce((a,b)=>a+b,0),1);assert.equal(totals[state.info.winner],1);
 assert.ok(state.terminated.every(Boolean));assert.ok(state.truncated.every(v=>!v));assert.equal(state.info.councils[0].ballots[0].source,'agent');
 assert.deepEqual(env.reset(),initial);assert.throws(()=>env.reset({seed:-1}));assert.deepEqual(env.reset(),initial);
});
test('observations and observer frames cannot mutate engine state; IDs and shapes are explicit',()=>{
 for(const id of ENVIRONMENTS){const env=createEnvironment({id});const state=env.reset();const expected=env.frame();state.observations[0].fill(99);env.frame().alive.fill(false);assert.deepEqual(env.frame(),expected);
  assert.deepEqual(env.observationShape,[id==='legacy-v1'?5:8,5,5]);}
 assert.throws(()=>createEnvironment({id:'unknown'}));assert.throws(()=>createEnvironment({id:'island-v1',config:{agents:1}}));
});
