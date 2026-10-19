import test from 'node:test';
import assert from 'node:assert/strict';
import {IslandGame} from '../island-game.mjs';
function council(game) { game.play(); while(game.playing) game.advance(); assert.equal(game.phase,'council'); }
test('mandatory council blocks time; invalid, self, duplicate and missing votes are atomic', () => {
 const game = new IslandGame({councilEvery:1,config:{hazard_count:0}}); council(game);
 const before = game.frame(); game.play(); game.advance(); assert.deepEqual(game.frame(),before);
 const valid=game.ruleBallots();
 for(const bad of [valid.slice(1),valid.map((v,i)=>i===0?{...v,target:v.voter}:v),valid.map((v,i)=>i===0?{...v,voter:valid[1].voter}:v)]) {
   assert.throws(()=>game.resolveCouncil(bad)); assert.deepEqual(game.frame(),before);
 }
 game.resolveCouncil(valid); assert.equal(game.remaining.length,7); assert.equal(game.frame().councils[0].ballots.length,8);
 const out=game.frame().councils[0].eliminated; assert.equal(game.world.base.alive[out],false);
 assert.deepEqual(game.frame().failureCauses[out],['voted out']);
 assert.deepEqual(game.frame().rewards,Array(8).fill(0));
});
test('last player wins +1, all others get 0, with no survival-step reward; reset and ties reproduce', () => {
 const game=new IslandGame({seed:7,councilEvery:1,config:{hazard_count:0}}), history=[];
 while(!game.done) { council(game); const result=game.resolveCouncil(game.ruleBallots()); history.push(result.frame);
   assert.equal(result.rewards.reduce((a,b)=>a+b,0),result.done?1:0);
 }
 assert.equal(game.rewards[game.winner],1); assert.equal(game.remaining.length,1);
 const final=game.frame(); game.play(); game.advance(); assert.deepEqual(game.frame(),final);
 game.reset(); assert.equal(game.councils.length,0); assert.deepEqual(game.rewards,Array(8).fill(0));
 for(const expected of history) { council(game); game.resolveCouncil(game.ruleBallots()); assert.deepEqual(game.frame(),expected); }
});
test('a simultaneous total survival failure produces no invented winner', () => {
 const game=new IslandGame({councilEvery:8,config:{wear_limit:2,hazard_count:0}});
 game.play(); game.advance(); game.advance();
 assert.equal(game.done,true); assert.equal(game.winner,null); assert.deepEqual(game.rewards,Array(8).fill(0));
});
