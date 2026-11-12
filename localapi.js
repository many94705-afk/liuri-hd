// 公开版没有后台服务：页面照旧请求 /api/chart、/api/now、/api/month、/api/saturn、/api/bazi，
// 这里在浏览器里接住这些请求，用 engine.js（Swiss Ephemeris WebAssembly）算好，按本机版接口同样的格式返回。
(function (root) {
  'use strict';

  const E = root.LiuriEngine, S = root.HDSaturn, B = root.HDBazi;
  const ready = E.init();
  const realFetch = root.fetch ? root.fetch.bind(root) : null;
  const iso = ms => ms == null ? null : new Date(ms).toISOString();
  const birthOf = q => E.localToUtc(q.get('birthDate'), q.get('birthTime'), q.get('timezone') || '+08:00');
  const transitZone = q => q.get('transitTimezone') || q.get('timezone') || '+08:00';

  const routes = {
    chart(q) {
      const birth = E.chart(birthOf(q));
      const transit = E.chart(E.localToUtc(q.get('transitDate'), q.get('transitTime') || '00:00', transitZone(q)));
      return { birth, transit, connections: E.connections(birth, transit) };
    },
    now(q) {
      const at = q.get('at'), view = E.nowView(birthOf(q), at ? Date.parse(at) : Date.now());
      return {
        now: iso(view.now), maxDays: view.maxDays,
        channels: view.channels.map(c => ({ ...c, start: iso(c.start), end: iso(c.end) })),
        upcoming: view.upcoming.map(u => ({ ...u, start: iso(u.start), end: iso(u.end) })),
      };
    },
    month(q) {
      const birth = E.birthChart(birthOf(q)), [year, month] = q.get('month').split('-').map(Number), days = [];
      for (let d = 1; new Date(Date.UTC(year, month - 1, d)).getUTCMonth() === month - 1; d++) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const noon = E.localToUtc(date, '12:00', transitZone(q));
        days.push({ date, connections: E.connections(birth, E.chart(noon), E.MONTH_EXCLUDE) });
      }
      return { days };
    },
    saturn(q) { return S.saturnReturn(birthOf(q)); },
    bazi(q) { return B.baziView(birthOf(q), q.get('timezone') || '+08:00', q.get('gender') === '男', q.get('date'), transitZone(q)); },
  };

  root.fetch = async function (url, options) {
    const text = typeof url === 'string' ? url : '';
    if (!text.startsWith('/api/')) return realFetch(url, options);
    const parsed = new URL(text, 'http://local'), route = routes[parsed.pathname.slice(5)];
    let status = 200, body;
    try {
      if (!route) throw new Error('公开版没有这个功能');
      await ready;
      await new Promise(done => setTimeout(done, 0)); // 先让页面显示「计算中…」
      body = route(parsed.searchParams);
    } catch (error) {
      status = 400; body = { error: error.message };
    }
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
