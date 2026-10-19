/** Local JSON-lines subprocess transport; no listening port or HTTP server. */
import {createInterface} from 'node:readline';
import {createEnvironment} from './api.mjs';
let env;
const json = value => JSON.stringify(value, (_, v) => ArrayBuffer.isView(v) ? Array.from(v) : v);
for await (const line of createInterface({input:process.stdin, crlfDelay:Infinity})) {
  let request;
  try {
    request = JSON.parse(line);
    if (!request || typeof request !== 'object') throw new TypeError('Expected a request object');
    let result;
    if (request.method === 'create') {
      const next = createEnvironment(request.options);
      env = next;
      result = {id:env.id, apiVersion:env.apiVersion, agentCount:env.agentCount, observationShape:env.observationShape, actionCount:env.actionCount, config:env.config};
    } else {
      if (!env) throw new Error('Create an environment first');
      switch(request.method) {
        case 'reset': result=env.reset(request.options);break;
        case 'step': result=env.step(request.actions);break;
        case 'vote': result=env.vote(request.targets);break;
        case 'frame': result=env.frame();break;
        default: throw new Error('Unknown method');
      }
    }
    process.stdout.write(json({id:request.id,result})+'\n');
  } catch (error) { process.stdout.write(json({id:request?.id,error:error.message})+'\n'); }
}
