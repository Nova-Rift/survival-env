import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync,spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('custom async agents receive local inputs and learning transitions; episodes reset memory',()=>{
 const dir=mkdtempSync(join(tmpdir(),'survival-agent-api-')),file=join(dir,'agent.mjs');
 try{
  writeFileSync(file,`import assert from 'node:assert/strict';
export async function createAgent({id,observationShape}) {
 let previousTick=-1;
 assert.deepEqual(observationShape,[8,5,5]);
 return {
  async act(input){assert.equal(input.observation.length,200);assert.ok(!('frame' in input));assert.ok(!('positions' in input));assert.ok(input.tick>previousTick);previousTick=input.tick;return 0;},
  async vote({candidates}){assert.ok(!candidates.includes(id));return candidates[0];},
  async learn(t){assert.equal(typeof t.terminated,'boolean');assert.equal(typeof t.truncated,'boolean');assert.equal(t.nextObservation.length,200);assert.ok(['survival','council'].includes(t.phase));if(t.reward===1)assert.equal(t.done,true);}
 };
}`);
  const args=['browser/run-agent.mjs','--agent',file,'--episodes','2'];
  const first=execFileSync('node',args,{cwd:root,encoding:'utf8'});
  assert.equal(first,execFileSync('node',args,{cwd:root,encoding:'utf8'}));
  const reports=first.trim().split('\n').map(JSON.parse);assert.equal(reports.length,2);
  assert.ok(reports.every(r=>r.returns.reduce((a,b)=>a+b,0)<=1));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('missing required vote callback fails instead of silently supplying fallback behavior',()=>{
 const dir=mkdtempSync(join(tmpdir(),'survival-agent-api-')),file=join(dir,'bad-agent.mjs');
 try{writeFileSync(file,'export function createAgent(){return {act:()=>0};}');
 const result=spawnSync('node',['browser/run-agent.mjs','--agent',file],{cwd:root,encoding:'utf8'});
 assert.notEqual(result.status,0);assert.match(result.stderr,/plus vote/);assert.equal(result.stdout,'');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
