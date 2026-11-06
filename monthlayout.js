// 月历排布：让连续多天的通道看得出持续性。
// 1. 前一天就有、今天还在的通道排在上面，并尽量待在同一行（同一周内行号不变）；今天新出现的排在下面。
// 2. 持续 minLong 天及以上的通道标为长期，前后相邻的日子连成一条色带；名称只在开头那天和每周第一天显示。
// 主产品与流日小窗（liuri-widget/web/monthlayout.js）共用这一份，改动时两边同步复制。
(function (root) {
  'use strict';

  const PALETTE = ['#f6cfa8', '#c9dcf0', '#d3e7c3', '#f3c9d8', '#e2d4f2', '#f2e2a4', '#c6e6e2', '#f0d0c4'];
  const byNumber = (a, b) => a.localeCompare(b, undefined, { numeric: true });

  // days：每天接通的通道编号数组；firstWeekday：1 号是星期几（0 = 周日）。
  // 返回每天的格子数组，空位为 null，其余为 {channel, long, days, joinL, joinR, label, color}。
  function layoutMonth(days, firstWeekday, minLong = 3) {
    const n = days.length, sets = days.map(list => new Set(list));
    const runs = {};
    for (let d = 0; d < n; d++) {
      for (const ch of days[d]) {
        if (d > 0 && sets[d - 1].has(ch)) continue;
        let e = d;
        while (e + 1 < n && sets[e + 1].has(ch)) e++;
        (runs[ch] = runs[ch] || []).push([d, e]);
      }
    }
    const runAt = (d, ch) => runs[ch].find(([s, e]) => d >= s && d <= e);

    const out = [];
    let lanes = [];
    for (let d = 0; d < n; d++) {
      const col = (firstWeekday + d) % 7;
      lanes = lanes.map(ch => (ch && sets[d].has(ch) ? ch : null));
      // 每周第一天把空行收紧，延续的通道保持原来的先后顺序
      if (col === 0) lanes = lanes.filter(Boolean);
      const kept = new Set(lanes.filter(Boolean));
      const lastKept = lanes.reduce((m, ch, i) => (ch ? i : m), -1);
      const fresh = days[d].filter(ch => !kept.has(ch)).sort((a, b) => {
        const la = runAt(d, a), lb = runAt(d, b);
        return (lb[1] - lb[0]) - (la[1] - la[0]) || byNumber(a, b);
      });
      // 新通道只能放在所有延续通道的下面（可以用下面的空行），保证「延续的在上」
      for (const ch of fresh) {
        let i = lanes.findIndex((x, k) => x === null && k > lastKept);
        if (i < 0) { i = lanes.length; lanes.push(null); }
        lanes[i] = ch;
      }
      while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop();
      out.push(lanes.map(ch => ch && { channel: ch }));
    }

    const colors = {};
    let next = 0;
    for (let d = 0; d < n; d++) {
      const col = (firstWeekday + d) % 7;
      for (const cell of out[d]) {
        if (!cell) continue;
        const [s, e] = runAt(d, cell.channel), len = e - s + 1;
        cell.days = len;
        cell.long = len >= minLong;
        cell.joinL = cell.long && col > 0 && d > s;
        cell.joinR = cell.long && col < 6 && d < e;
        cell.label = !cell.joinL;
        if (cell.long) {
          if (!(cell.channel in colors)) colors[cell.channel] = PALETTE[next++ % PALETTE.length];
          cell.color = colors[cell.channel];
        }
      }
    }
    // 同一周的格子补齐到一样的行数，色带才能横向对齐
    for (let d = 0; d < n;) {
      const end = Math.min(n, d + 7 - (firstWeekday + d) % 7);
      const rows = Math.max(0, ...out.slice(d, end).map(x => x.length));
      for (let k = d; k < end; k++) while (out[k].length < rows) out[k].push(null);
      d = end;
    }
    return out;
  }

  const api = { layoutMonth };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MonthLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
