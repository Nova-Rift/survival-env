// Replace act() and vote() with your own agent; promises are supported.
export function createAgent({id, seed}) {
  let randomState = (seed ^ Math.imul(id+1, 0x9e3779b1)) >>> 0;
  const random = () => { randomState = (Math.imul(randomState,1664525)+1013904223)>>>0; return randomState/2**32; };
  return {
    act({observation}) {
      // observation is only this player's local Float32Array. This baseline ignores it.
      return Math.floor(random()*5);
    },
    vote({candidates}) { return candidates[Math.floor(random()*candidates.length)]; },
    // Optional: learn({phase, observation, action, reward, nextObservation, terminated, truncated, done}) {}
  };
}
