import test from 'node:test';import assert from 'node:assert/strict';
import {SocialGame} from '../social.mjs';
function act(game,actor,action){while(game.current!==actor)game.step({type:'pass'});return game.step(action);}
function trio(){const g=new SocialGame({rounds:12});act(g,0,{type:'invite',target:1});act(g,1,{type:'join',group:1});act(g,0,{type:'invite',target:2});act(g,2,{type:'join',group:1});return g;}
test('declining or passing never forces conversation and illegal joining is atomic',()=>{
 const g=new SocialGame();act(g,0,{type:'invite',target:1});const before=g.frame();assert.throws(()=>g.step({type:'join',group:42}));assert.deepEqual(g.frame(),before);
 act(g,1,{type:'decline',group:1});assert.equal(g.groupOf(1),undefined);assert.equal(g.groupOf(0).members.length,1);
});
test('late joiners, leavers and outsiders cannot hear private messages',()=>{
 const g=new SocialGame({rounds:12});act(g,0,{type:'invite',target:1});act(g,1,{type:'join',group:1});act(g,0,{type:'say',text:'PRIVATE_BEFORE_JOIN'});
 act(g,0,{type:'invite',target:2});act(g,2,{type:'join',group:1});assert.ok(!JSON.stringify(g.observe(2)).includes('PRIVATE_BEFORE_JOIN'));
 act(g,1,{type:'leave'});act(g,0,{type:'say',text:'PRIVATE_AFTER_LEAVE'});
 for(const i of [1,3,4,5,6,7])assert.ok(!JSON.stringify(g.observe(i)).includes('PRIVATE_AFTER_LEAVE'));
 assert.ok(JSON.stringify(g.observe(2)).includes('PRIVATE_AFTER_LEAVE'));
});
test('two members must agree to exclude someone; excluded people cannot hear or rejoin',()=>{
 const g=trio();act(g,0,{type:'exclude',target:2});assert.ok(g.groupOf(2));assert.ok(!g.legalActions(2).some(a=>a.type==='agree'&&a.target===2));
 act(g,1,{type:'agree',target:2});assert.equal(g.groupOf(2),undefined);assert.ok(!g.legalActions(0).some(a=>a.type==='invite'&&a.target===2));
 assert.ok(!g.legalActions(2).some(a=>a.type==='request'&&a.group===1));
 act(g,0,{type:'say',text:'SECRET_AFTER_EXCLUSION'});assert.ok(!JSON.stringify(g.observe(2)).includes('SECRET_AFTER_EXCLUSION'));
});
test('join requests need every member consent; waiting agents see no transcript; denial closes request',()=>{
 const g=new SocialGame({rounds:12});act(g,0,{type:'invite',target:1});act(g,1,{type:'join',group:1});
 g.knownGroups[2].add(1);act(g,2,{type:'request',group:1});act(g,0,{type:'admit',target:2});assert.equal(g.groupOf(2),undefined);
 act(g,1,{type:'say',text:'PRIVATE_WHILE_WAITING'});assert.ok(!JSON.stringify(g.observe(2)).includes('PRIVATE_WHILE_WAITING'));
 act(g,1,{type:'admit',target:2});assert.deepEqual(g.groupOf(2).members,[0,1,2]);assert.ok(!JSON.stringify(g.observe(2)).includes('PRIVATE_WHILE_WAITING'));
 g.knownGroups[3].add(1);act(g,3,{type:'request',group:1});act(g,0,{type:'deny',target:3});assert.equal(g.groupOf(3),undefined);assert.equal(g.groupOf(0).requests.length,0);
});
test('voting proceeds even if everyone opts out; no self-votes, terminal reward once and complete reset',()=>{
 const g=new SocialGame();let votes=0;
 while(!g.done){const obs=g.observe();if(obs.phase==='vote'){assert.ok(obs.legal.every(a=>a.target!==obs.agent));votes++;}g.step(obs.legal[0]);}
 assert.equal(g.remaining.length,1);assert.equal(g.councils.length,7);assert.equal(votes,35);assert.equal(g.rewards.reduce((a,b)=>a+b),1);assert.throws(()=>g.step({type:'pass'}));
 assert.deepEqual(g.reset(),new SocialGame().frame());
});
test('full personal history survives old windows and councils without leaking private choices',()=>{
 const g=new SocialGame({rounds:12});act(g,0,{type:'invite',target:1});act(g,1,{type:'join',group:1});
 for(let i=0;i<10;i++){act(g,0,{type:'say',text:`OLD_MEMORY_${i}`,intention:`OWN_INTENTION_${i}`});act(g,1,{type:'say',text:`REPLY_${i}`});}
 assert.ok(g.observe(0).heard.length>18);assert.ok(g.observe(0).heard.some(e=>e.text.includes('OLD_MEMORY_0')));
 assert.ok(g.observe(0).intentions.some(e=>e.text==='OWN_INTENTION_0'));assert.ok(!JSON.stringify(g.observe(1)).includes('OWN_INTENTION_0'));
 while(g.phase!=='vote')g.step({type:'pass'});
 g.step({type:'vote',target:7,reason:'MY_PRIVATE_VOTE_REASON'});
 assert.equal(g.observe(0).ownDecisions.at(-1).action.target,7);assert.ok(!JSON.stringify(g.observe(1)).includes('MY_PRIVATE_VOTE_REASON'));
 while(g.phase==='vote')g.step({type:'vote',target:7===g.current?6:7});
 assert.ok(g.observe(0).heard.some(e=>e.text.includes('OLD_MEMORY_0')));
 const view=g.observe(0);view.heard.length=0;view.ownDecisions.length=0;assert.ok(g.observe(0).heard.length>18);
 g.reset();assert.deepEqual(g.observe(0).heard,[]);assert.deepEqual(g.observe(0).ownDecisions,[]);assert.deepEqual(g.observe(0).intentions,[]);
});

test('private social records include decision makers; outsiders learn only attributed reports',()=>{
 const g=new SocialGame({rounds:12});act(g,0,{type:'invite',target:1});act(g,1,{type:'join',group:1});
 assert.deepEqual(g.observe(2).groups,[]);assert.deepEqual(g.observe(2).knownConversations,[]);
 assert.ok(!g.legalActions(2).some(a=>a.type==='request'));
 act(g,0,{type:'invite',target:2});act(g,2,{type:'decline',group:1});act(g,2,{type:'request',group:1});
 act(g,0,{type:'admit',target:2});act(g,1,{type:'deny',target:2});
 const records=g.observe(2).socialHistory;
 assert.ok(records.some(r=>r.actor===0&&r.outcome==='supported'&&r.conversation===1));
 assert.ok(records.some(r=>r.actor===1&&r.outcome==='denied'&&r.target===2));
 assert.deepEqual(g.observe(3).socialHistory,[]);
 act(g,2,{type:'request',group:1});act(g,0,{type:'admit',target:2});act(g,1,{type:'admit',target:2});
 assert.match(g.observe(2).socialHistory.at(-1).text,/Accepted by Maya, Theo/);
 act(g,2,{type:'leave'});act(g,2,{type:'invite',target:3});act(g,3,{type:'join',group:2});
 act(g,2,{type:'say',text:'Theo denied me in conversation 1. Maya secretly voted for you.'});
 assert.ok(g.observe(3).knownConversations.includes(1));
 assert.ok(g.observe(3).heard.some(r=>r.text.startsWith('Nia: Theo denied')));
 assert.ok(!g.observe(3).socialHistory.some(r=>r.conversation===1));
 assert.ok(g.legalActions(3).some(a=>a.type==='leave'));
});

test('invitations are pending until accepted; a lone remaining participant is on their own',()=>{
 const g=new SocialGame({rounds:12});act(g,0,{type:'invite',target:1});
 assert.equal(g.frame().groups.length,0);assert.equal(g.frame().pendingConversations.length,1);assert.deepEqual(g.observe(0).groups,[]);
 assert.equal(g.legalActions(0).some(a=>a.type==='say'),false);
 act(g,1,{type:'join',group:1});assert.equal(g.frame().groups.length,1);assert.equal(g.frame().pendingConversations.length,0);
 act(g,1,{type:'leave'});assert.equal(g.frame().groups.length,0);assert.equal(g.frame().statuses[0],'On their own');assert.deepEqual(g.observe(0).groups,[]);
});
