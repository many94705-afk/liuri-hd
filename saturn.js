// 土星回归（JavaScript 版）：与本机版 saturn.py 同一套规则，在浏览器里运行。
// 用法：await LiuriEngine.init(); HDSaturn.saturnReturn(birthMs)；返回结构与本机版 /api/saturn 相同，时间为 ISO 字符串（UTC）。
(function (root) {
  'use strict';

  const MINUTE = 60e3, DAY = 864e5, YEAR = 365.25 * DAY;
  const STEP = 3 * DAY, SEARCH_FROM = 20 * YEAR, SEARCH_TO = 95 * YEAR;
  const SAME_RETURN = 3 * YEAR, WINDOW_MARGIN = 3 * YEAR, PRECISION = MINUTE;
  const SATURN = 6;

  const E = () => root.LiuriEngine || require('./engine.js');
  const saturnLongitude = ms => E().bodyLongitude(ms, SATURN);
  // 流年土星减出生土星，取 [-180, 180) 区间。
  const delta = (ms, natal) => ((saturnLongitude(ms) - natal + 180) % 360 + 360) % 360 - 180;

  // test(low) != test(high)，收窄到 1 分钟内，返回第一个整分钟边界（之后的状态与 test(high) 相同）。
  function bisect(test, low, high) {
    const want = test(high);
    while (high - low > PRECISION) {
      const middle = low + (high - low) / 2;
      if (test(middle) === want) high = middle; else low = middle;
    }
    const mark = Math.floor(low / MINUTE) * MINUTE + MINUTE;
    return test(mark) === want ? mark : mark + MINUTE;
  }

  function exactPoints(birth, natal) {
    const points = [];
    let moment = birth + SEARCH_FROM, previous = delta(moment, natal);
    while (moment < birth + SEARCH_TO) {
      const following = moment + STEP, current = delta(following, natal);
      // 变号且两边都靠近 0（排除 ±180° 处的跳变）
      if ((previous < 0) !== (current < 0) && Math.abs(previous) < 90 && Math.abs(current) < 90) {
        points.push(bisect(t => delta(t, natal) >= 0, moment, following));
      }
      moment = following; previous = current;
    }
    return points;
  }

  // [start, end] 内流年土星位于 gate 的时间段：[[进入, 离开], ...]。
  function gateSpans(gate, start, end) {
    const inside = t => E().mapLongitude(saturnLongitude(t)).gate === gate;
    const spans = [];
    let moment = start, was = inside(start), enter = was ? start : null;
    while (moment < end) {
      const following = moment + STEP, nowIn = inside(following);
      if (nowIn !== was) {
        const edge = bisect(inside, moment, following);
        if (nowIn) enter = edge; else spans.push([enter, edge]);
      }
      moment = following; was = nowIn;
    }
    if (was) spans.push([enter, null]);
    return spans;
  }

  const age = (birth, ms) => Math.round((ms - birth) / (365.2425 * DAY) * 100) / 100;
  const iso = ms => ms == null ? null : new Date(ms).toISOString();

  function saturnReturn(birth) {
    const natal = saturnLongitude(birth), gl = E().mapLongitude(natal), groups = [];
    for (const point of exactPoints(birth, natal)) {
      const last = groups[groups.length - 1];
      if (last && point - last[last.length - 1] < SAME_RETURN) last.push(point); else groups.push([point]);
    }
    return {
      natal: { lon: natal, gate: gl.gate, line: gl.line },
      returns: groups.map((exacts, i) => ({
        number: i + 1,
        exacts: exacts.map(t => ({ time: iso(t), age: age(birth, t) })),
        gateSpans: gateSpans(gl.gate, exacts[0] - WINDOW_MARGIN, exacts[exacts.length - 1] + WINDOW_MARGIN)
          .map(([a, b]) => [iso(a), iso(b)]),
      })),
    };
  }

  const api = { saturnReturn };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HDSaturn = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
