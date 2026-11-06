// 流日计算（JavaScript 版）：与正式版 engine.py / timeline.py 同一套规则，在本机浏览器里运行。
// 用法：await LiuriEngine.init(); LiuriEngine.nowView(birthDate, nowDate)
(function (root) {
  'use strict';

  const GATE_ORDER = [25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35,
    45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59,
    40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43,
    14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60, 41, 19,
    13, 49, 30, 55, 37, 63, 22, 36];
  // 星体 → Swiss Ephemeris 编号；地球、南交点由太阳、北交点 +180° 得到。
  const PLANETS = [['太阳', 0], ['地球', null], ['月亮', 1], ['水星', 2], ['金星', 3], ['火星', 4],
    ['木星', 5], ['土星', 6], ['天王星', 7], ['海王星', 8], ['冥王星', 9], ['北交点', 11], ['南交点', null]];
  const CHANNELS = [[1, 8], [2, 14], [3, 60], [4, 63], [5, 15], [6, 59], [7, 31],
    [9, 52], [10, 20], [10, 34], [10, 57], [11, 56], [12, 22],
    [13, 33], [16, 48], [17, 62], [18, 58], [19, 49], [20, 34],
    [20, 57], [21, 45], [23, 43], [24, 61], [25, 51], [26, 44],
    [27, 50], [28, 38], [29, 46], [30, 41], [32, 54], [34, 57],
    [35, 36], [37, 40], [39, 55], [42, 53], [47, 64]];
  const MAPPING_OFFSET_DEG = 1.75;
  const FLAGS = 4 | 256; // 内置 Moshier 星历 + 速度，与正式版 pyswisseph 实际使用的一致
  const MINUTE = 60e3, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
  const FINE_STEP = 30 * MINUTE, FINE_SPAN = 3 * DAY, COARSE_STEP = 6 * HOUR;
  const MAX_SPAN = 45 * DAY, UPCOMING_SPAN = DAY, PRECISION = 10e3;

  let calcRaw = null, mod = null, xx = 0, serr = 0;

  async function init() {
    if (calcRaw) return;
    const factory = root.SwissEphModule || (typeof require === 'function' && require('./vendor/swisseph.js'));
    const base64 = root.SWISSEPH_WASM_BASE64 || (typeof require === 'function' && require('./vendor/swisseph-wasm.js').SWISSEPH_WASM_BASE64);
    const binary = typeof Buffer !== 'undefined' ? Buffer.from(base64, 'base64')
      : Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    // WASM 内嵌在脚本里直接实例化，双击打开本地文件（file://）也能用，不需要联网或服务器。
    mod = await factory({
      print: () => {}, printErr: () => {},
      instantiateWasm: (imports, done) => {
        WebAssembly.instantiate(binary, imports).then(result => done(result.instance));
        return {};
      },
    });
    calcRaw = mod.cwrap('swe_calc_ut_wrap', 'number', ['number', 'number', 'number', 'number', 'number']);
    xx = mod._malloc(6 * 8);
    serr = mod._malloc(256);
  }

  const wrap = v => ((v % 360) + 360) % 360;
  const jd = ms => ms / 86400000 + 2440587.5;

  function longitude(julian, body) {
    if (calcRaw(julian, body, FLAGS, xx, serr) < 0) throw new Error(mod.UTF8ToString(serr));
    return wrap(mod.getValue(xx, 'double'));
  }

  function mapLongitude(lon) {
    const aligned = wrap(lon + MAPPING_OFFSET_DEG);
    const sector = Math.min(63, Math.floor(aligned / (360 / 64)));
    const inside = aligned - sector * (360 / 64);
    const line = Math.min(6, Math.floor((inside + 1e-9) / (360 / 384)) + 1);
    return { gate: GATE_ORDER[sector], line };
  }

  function positions(ms) {
    const j = jd(ms), sun = longitude(j, 0), node = longitude(j, 11), out = {};
    for (const [name, body] of PLANETS) {
      const lon = name === '太阳' ? sun : name === '地球' ? wrap(sun + 180)
        : name === '北交点' ? node : name === '南交点' ? wrap(node + 180) : longitude(j, body);
      out[name] = { lon, gl: mapLongitude(lon) };
    }
    return out;
  }

  // 设计时刻：太阳比此刻往前 88° 的历史时刻。
  function designMoment(ms) {
    const current = longitude(jd(ms), 0);
    let low = ms - 100 * DAY, high = ms - 80 * DAY;
    for (let i = 0; i < 50; i++) {
      const middle = low + (high - low) / 2;
      const delta = wrap(longitude(jd(middle), 0) - current + 180) - 180;
      if (delta < -88) low = middle; else high = middle;
    }
    return low + (high - low) / 2;
  }

  function chart(ms) {
    const designAt = designMoment(ms);
    return { personality: positions(ms), design: positions(designAt), designTime: designAt };
  }

  function gates(one, exclude = []) {
    const set = new Set();
    for (const part of [one.personality, one.design]) {
      for (const [name, p] of Object.entries(part)) if (!exclude.includes(name)) set.add(p.gl.gate);
    }
    return set;
  }
  // 月历只看长期的星体：月亮大约半天就换一个闸门，只靠它点亮的闸门不算（同一闸门还有其他星体时照常计入）。
  const MONTH_EXCLUDE = ['月亮'];

  // 流日接通的通道：本人没有定义，但本人 + 流日凑齐两端，且至少一端来自流日。
  function connections(personal, transit, exclude = []) {
    const mine = personal.gates || gates(personal), flow = gates(transit, exclude), result = [];
    for (const [a, b] of CHANNELS) {
      if (mine.has(a) && mine.has(b)) continue;
      if ((mine.has(a) || flow.has(a)) && (mine.has(b) || flow.has(b)) && (flow.has(a) || flow.has(b))) {
        result.push({ channel: `${a}-${b}`, mine: [a, b].filter(g => mine.has(g)), flow: [a, b].filter(g => flow.has(g)) });
      }
    }
    return result;
  }

  // ---- 此刻接通：起止时间与星体来源 ----
  function sources(one, owner) {
    const byGate = {};
    for (const [key, label] of [['design', '设计'], ['personality', '个性']]) {
      for (const [planet, body] of Object.entries(one[key])) {
        (byGate[body.gl.gate] = byGate[body.gl.gate] || []).push({ owner, side: label, planet, line: body.gl.line });
      }
    }
    return byGate;
  }

  function active(birth, ms) { return new Set(connections(birth, chart(ms)).map(c => c.channel)); }

  function* offsets() {
    for (let offset = FINE_STEP; offset <= MAX_SPAN; offset += offset < FINE_SPAN ? FINE_STEP : COARSE_STEP) yield offset;
  }

  function bisect(birth, channel, inside, outside) {
    while (Math.abs(outside - inside) > PRECISION) {
      const middle = inside + (outside - inside) / 2;
      if (active(birth, middle).has(channel)) inside = middle; else outside = middle;
    }
    return [inside, outside];
  }

  // 边界统一取「第一个整分钟」：开始 = 第一个已接通的整分钟，结束 = 第一个已断开的整分钟。
  // 这样同一个边界不管从哪个时刻算起，结果都完全相同。
  function edge(birth, channel, inside, outside, wantActive) {
    const mark = Math.floor(Math.min(inside, outside) / MINUTE) * MINUTE + MINUTE;
    return active(birth, mark).has(channel) === wantActive ? mark : mark + MINUTE;
  }

  function scan(birth, now, current, direction) {
    const pending = new Set(current), edges = {}, upcoming = {};
    let previousMoment = now, previous = current;
    for (const offset of offsets()) {
      if (!pending.size && (direction < 0 || offset > UPCOMING_SPAN)) break;
      const moment = now + direction * offset, act = active(birth, moment);
      for (const channel of [...pending].sort()) {
        if (act.has(channel)) continue;
        const [inside, outside] = bisect(birth, channel, previousMoment, moment);
        edges[channel] = edge(birth, channel, inside, outside, direction < 0);
        pending.delete(channel);
      }
      if (direction > 0 && offset <= UPCOMING_SPAN) {
        for (const channel of [...act].sort()) {
          if (previous.has(channel) || current.has(channel) || channel in upcoming) continue;
          upcoming[channel] = edge(birth, channel, ...bisect(birth, channel, moment, previousMoment), true);
          pending.add(channel);
        }
      }
      previousMoment = moment; previous = act;
    }
    return [edges, upcoming];
  }

  function birthChart(birthMs) {
    const birth = chart(birthMs);
    birth.gates = gates(birth);
    return birth;
  }

  // 返回结构与正式版 /api/now 相同，时间为毫秒时间戳（找不到边界时为 null）。
  function nowView(birthMs, nowMs, birth) {
    birth = birth || birthChart(birthMs);
    const transit = chart(nowMs), list = connections(birth, transit);
    const current = new Set(list.map(c => c.channel));
    const [starts] = scan(birth, nowMs, current, -1);
    const [ends, upcoming] = scan(birth, nowMs, current, 1);
    const mine = sources(birth, '个人'), flow = sources(transit, '流日');
    const channels = list.map(item => ({
      channel: item.channel,
      start: starts[item.channel] ?? null,
      end: ends[item.channel] ?? null,
      gates: item.channel.split('-').map(Number).map(g => ({ gate: g, sources: [...(mine[g] || []), ...(flow[g] || [])] })),
    }));
    channels.sort((a, b) => (a.end ?? Infinity) - (b.end ?? Infinity));
    return {
      now: nowMs, maxDays: MAX_SPAN / DAY, channels,
      upcoming: Object.entries(upcoming).map(([channel, start]) => ({ channel, start, end: ends[channel] ?? null }))
        .sort((a, b) => a.start - b.start),
    };
  }

  // 出生地钟面时间 → UTC 毫秒。zone 可以是 IANA 名称（如 Asia/Shanghai，自动处理历史夏令时）或固定偏移（如 +09:00）。
  function localToUtc(dateText, timeText, zone) {
    const [y, mo, d] = dateText.split('-').map(Number), [h, mi] = (timeText || '00:00').split(':').map(Number);
    const wall = Date.UTC(y, mo - 1, d, h, mi);
    zone = String(zone || '+08:00').trim();
    if (!zone.includes('/')) {
      const clean = zone.toUpperCase().replace('UTC', '').replace('GMT', '');
      const sign = clean.startsWith('-') ? -1 : 1, body = clean.replace(/^[+-]/, '') || '0';
      const minutes = body.includes(':') ? body.split(':').reduce((hh, mm) => +hh * 60 + +mm) : parseFloat(body) * 60;
      return wall - sign * minutes * MINUTE;
    }
    const format = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric',
      month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    const offset = ms => {
      const p = Object.fromEntries(format.formatToParts(new Date(ms)).map(x => [x.type, +x.value]));
      return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms;
    };
    let utc = wall - offset(wall);
    utc = wall - offset(utc);
    return utc;
  }

  const bodyLongitude = (ms, body) => longitude(jd(ms), body);
  const api = { init, bodyLongitude, positions, chart, designMoment, connections, birthChart, nowView, localToUtc, mapLongitude, MONTH_EXCLUDE };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LiuriEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
