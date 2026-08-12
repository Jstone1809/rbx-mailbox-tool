/* charts.js — the chart code both dashboards share, so they behave identically.
   Plain inline SVG, no libraries.

   Rules kept deliberately:
     - one y-axis per chart, never two. Measures on different scales (money vs a
       ratio like ROAS or margin %) get their own chart instead.
     - 2px lines, markers ringed in the surface colour so overlapping points stay
       separable, and a 2px gap between stacked segments.
     - a legend whenever there is more than one series, plus a direct label on the
       final point, so identity never rests on colour alone.
     - crosshair and tooltip on every plot.
*/
const NS = 'http://www.w3.org/2000/svg';
const el = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };

let _tip;
function tipEl() {
  if (!_tip) { _tip = document.createElement('div'); _tip.className = 'tip'; document.body.appendChild(_tip); }
  return _tip;
}
export function showTip(html, x, y) {
  const t = tipEl();
  t.innerHTML = html; t.style.opacity = 1;
  const r = t.getBoundingClientRect();
  t.style.left = Math.min(Math.max(8, x - r.width / 2), innerWidth - r.width - 8) + 'px';
  t.style.top = Math.max(8, y - r.height - 14) + 'px';
}
export const hideTip = () => { if (_tip) _tip.style.opacity = 0; };

export const gbp = n => '£' + (n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = n => (n || 0).toLocaleString('en-GB');
export const shortDate = s => new Date(s + 'T00:00:00')
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function frame(svg, days, H, P, max, fmt, compact) {
  const W = 880, iw = W - P.l - P.r, ih = H - P.t - P.b;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const X = i => P.l + (days.length === 1 ? iw / 2 : i * iw / (days.length - 1));
  const Y = v => P.t + ih - (max ? (v / max) * ih : 0);
  const gridN = compact ? 3 : 4;
  for (let g = 0; g <= gridN; g++) {
    const v = max * g / gridN, y = Y(v);
    svg.appendChild(el('line', { x1: P.l, x2: W - P.r, y1: y, y2: y, stroke: 'var(--grid)', 'stroke-width': 1 }));
    const t = el('text', { x: P.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 11 });
    t.textContent = fmt.axis(v); svg.appendChild(t);
  }
  const every = compact ? 4 : 8;
  days.forEach((d, i) => {
    if (days.length > every && i % Math.ceil(days.length / every) !== 0 && i !== days.length - 1) return;
    const t = el('text', { x: X(i), y: H - P.b + 18, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 11 });
    t.textContent = shortDate(d); svg.appendChild(t);
  });
  return { W, iw, ih, X, Y };
}

function hover(svg, days, P, geo, rows, onPick) {
  const cross = el('line', { y1: P.t, y2: P.t + geo.ih, stroke: 'var(--muted)', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0 });
  svg.appendChild(cross);
  const hit = el('rect', { x: P.l, y: P.t, width: geo.iw, height: geo.ih, fill: 'transparent' });
  if (onPick) hit.setAttribute('style', 'cursor:pointer');
  svg.appendChild(hit);
  const indexAt = ev => {
    const bb = svg.getBoundingClientRect();
    const i = Math.round(((ev.clientX - bb.left) / bb.width * geo.W - P.l) / (geo.iw / Math.max(1, days.length - 1)));
    return Math.max(0, Math.min(days.length - 1, i));
  };
  hit.addEventListener('pointermove', ev => {
    const k = indexAt(ev);
    cross.setAttribute('x1', geo.X(k)); cross.setAttribute('x2', geo.X(k)); cross.setAttribute('opacity', 1);
    showTip(`<b>${shortDate(days[k])}</b><br>` + rows(days[k])
      + (onPick ? '<br><span style="color:var(--muted)">click for the breakdown</span>' : ''),
      ev.clientX, ev.clientY);
  });
  hit.addEventListener('pointerleave', () => { cross.setAttribute('opacity', 0); hideTip(); });
  if (onPick) hit.addEventListener('click', ev => onPick(days[indexAt(ev)]));
}

/* Marks the selected day so the chart and the detail panel agree. */
export function markSelected(svg, days, date) {
  const old = svg.querySelector('.sel-marker');
  if (old) old.remove();
  const i = days.indexOf(date);
  if (i < 0 || !svg._geo) return;
  const { geo, P, H } = svg._geo;
  const m = el('rect', {
    class: 'sel-marker', x: geo.X(i) - 1, y: P.t, width: 2, height: geo.ih,
    fill: 'var(--leaf)', opacity: 0.55
  });
  svg.insertBefore(m, svg.firstChild);
}

export function lineChart(svg, days, series, fmt, opt = {}) {
  svg.innerHTML = '';
  if (!days.length) { const t = el('text', { x: 440, y: 100, 'text-anchor': 'middle', fill: 'var(--muted)' }); t.textContent = 'No data'; svg.appendChild(t); return; }
  const compact = !!opt.compact;
  const H = opt.h || 260, P = { t: 16, r: 20, b: 30, l: compact ? 48 : 56 };
  const max = Math.max(...series.flatMap(s => days.map(d => s.get(d) || 0)), 0) * 1.15 || 1;
  const geo = frame(svg, days, H, P, max, fmt, compact);
  svg._geo = { geo, P, H };

  series.forEach(s => {
    const pts = days.map((d, i) => [geo.X(i), geo.Y(s.get(d) || 0)]);
    svg.appendChild(el('path', {
      d: 'M' + pts.map(p => p.join(' ')).join(' L '), fill: 'none',
      stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }));
    pts.forEach(p => svg.appendChild(el('circle', {
      cx: p[0], cy: p[1], r: compact ? 3.6 : 4.4, fill: s.color,
      stroke: 'var(--panel)', 'stroke-width': 2
    })));
    const last = pts[pts.length - 1];
    const t = el('text', { x: last[0] - 6, y: last[1] - 12, 'text-anchor': 'end', fill: 'var(--text)', 'font-size': 11, 'font-weight': 700 });
    t.textContent = fmt.label(s.get(days[days.length - 1]) || 0); svg.appendChild(t);
  });

  hover(svg, days, P, geo, d => series.map(s => `${s.name} ${fmt.label(s.get(d) || 0)}`).join('<br>'), opt.onPick);
}

/* Stacked bars: the parts must SUM to the whole, which is why COGS + ads +
   profit works here and why a line chart would misrepresent it. */
export function stackedBars(svg, days, series, fmt, opt = {}) {
  svg.innerHTML = '';
  if (!days.length) { const t = el('text', { x: 440, y: 100, 'text-anchor': 'middle', fill: 'var(--muted)' }); t.textContent = 'No data'; svg.appendChild(t); return; }
  const H = opt.h || 280, P = { t: 16, r: 20, b: 30, l: 56 };
  const totals = days.map(d => series.reduce((a, s) => a + Math.max(0, s.get(d) || 0), 0));
  const max = Math.max(...totals, 0) * 1.15 || 1;
  const geo = frame(svg, days, H, P, max, fmt, false);
  svg._geo = { geo, P, H };
  const bw = Math.max(6, Math.min(38, geo.iw / days.length - 8));

  days.forEach((d, i) => {
    let acc = 0;
    series.forEach(s => {
      const v = Math.max(0, s.get(d) || 0);
      if (!v) return;
      const y0 = geo.Y(acc), y1 = geo.Y(acc + v);
      // 2px surface gap so adjacent segments never blur into one block.
      const h = Math.max(1, y0 - y1 - 2);
      svg.appendChild(el('rect', {
        x: geo.X(i) - bw / 2, y: y1, width: bw, height: h, rx: 3, fill: s.color
      }));
      acc += v;
    });
  });

  hover(svg, days, P, geo, d => series.map(s => `${s.name} ${fmt.label(s.get(d) || 0)}`).join('<br>'), opt.onPick);
}
