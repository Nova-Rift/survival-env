/** Canvas observer only. It receives a copied frame, never controls policy input. */
export function drawSyntheticFrame(ctx, frame, config) {
  const cell = ctx.canvas.width/config.size;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = '#14241f'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = frame.hazardsActive ? '#a54a26' : '#463628';
  for (const [y, x] of frame.hazardCells) ctx.fillRect(x*cell+1, y*cell+1, cell-2, cell-2);
  ctx.strokeStyle = '#30483c'; ctx.lineWidth = .5;
  for (let i = 0; i <= config.size; i++) {
    ctx.beginPath(); ctx.moveTo(i*cell, 0); ctx.lineTo(i*cell, ctx.canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i*cell); ctx.lineTo(ctx.canvas.width, i*cell); ctx.stroke();
  }
  ctx.fillStyle = '#9cdb87';
  for (const [y, x] of frame.resources) {ctx.beginPath(); ctx.arc((x+.5)*cell, (y+.5)*cell, cell*.15, 0, Math.PI*2); ctx.fill();}
  frame.positions.forEach(([y, x], i) => {
    if (!frame.alive[i]) {
      ctx.fillStyle = '#53615a'; ctx.fillRect((x+.35)*cell, (y+.35)*cell, cell*.3, cell*.3); return;
    }
    ctx.fillStyle = `hsl(${i*45},75%,70%)`; ctx.fillRect((x+.1)*cell, (y+.08)*cell, cell*.8, cell*.62);
    ctx.fillStyle = '#10241b'; ctx.font = `bold ${cell*.43}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(String(i), (x+.5)*cell, (y+.55)*cell);
    for (const [offset, value, color] of [[.73, frame.power[i]/config.power_limit, '#9cdb87'],
      [.82, frame.integrity[i]/config.max_integrity, '#70c7f0'], [.91, frame.wear[i]/config.wear_limit, '#f2c778']]) {
      ctx.fillStyle = '#35473f'; ctx.fillRect((x+.1)*cell, (y+offset)*cell, cell*.8, cell*.06);
      ctx.fillStyle = color; ctx.fillRect((x+.1)*cell, (y+offset)*cell, cell*.8*value, cell*.06);
    }
  });
}
