// 八字与卦（JavaScript 版）：与本机版 bazi.py 同一套规则，在浏览器里运行。
// 用法：await LiuriEngine.init(); HDBazi.baziView(birthMs, birthZone, male, 'YYYY-MM-DD', viewZone)；返回结构与本机版 /api/bazi 相同。
// 卦用 6 位字符串表示，从初爻到上爻，'1' 为阳爻。
(function (root) {
  'use strict';

  const E = () => root.LiuriEngine || require('./engine.js');
  const DAY = 864e5;
  const STEMS = '甲乙丙丁戊己庚辛壬癸', BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
  const STEM_NUMBER = [6, 2, 8, 7, 1, 9, 3, 4, 6, 2];
  const BRANCH_NUMBERS = { 0: [1, 6], 11: [1, 6], 2: [3, 8], 3: [3, 8], 5: [2, 7], 6: [2, 7], 8: [4, 9], 9: [4, 9], 4: [5, 10], 10: [5, 10], 1: [5, 10], 7: [5, 10] };
  const TRIGRAM_OF_NUMBER = { 1: '010', 2: '000', 3: '100', 4: '011', 6: '111', 7: '110', 8: '001', 9: '101' };
  const TERMS = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'];
  const MONTH_NAMES = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const HEXAGRAM_NAMES = ('乾为天 坤为地 水雷屯 山水蒙 水天需 天水讼 地水师 水地比 风天小畜 天泽履 地天泰 天地否 天火同人 火天大有 ' +
    '地山谦 雷地豫 泽雷随 山风蛊 地泽临 风地观 火雷噬嗑 山火贲 山地剥 地雷复 天雷无妄 山天大畜 山雷颐 泽风大过 ' +
    '坎为水 离为火 泽山咸 雷风恒 天山遯 雷天大壮 火地晋 地火明夷 风火家人 火泽睽 水山蹇 雷水解 山泽损 风雷益 ' +
    '泽天夬 天风姤 泽地萃 地风升 泽水困 水风井 泽火革 火风鼎 震为雷 艮为山 风山渐 雷泽归妹 雷火丰 火山旅 ' +
    '巽为风 兑为泽 风水涣 水泽节 风泽中孚 雷山小过 水火既济 火水未济').split(' ');
  const IMAGE = { 天: '111', 地: '000', 雷: '100', 水: '010', 山: '001', 风: '011', 火: '101', 泽: '110' };
  const SELF = { 乾: '111', 坤: '000', 震: '100', 坎: '010', 艮: '001', 巽: '011', 离: '101', 兑: '110' };
  const bitsOf = name => name[1] === '为' ? SELF[name[0]].repeat(2) : IMAGE[name[1]] + IMAGE[name[0]];
  const HEXAGRAMS = {};
  HEXAGRAM_NAMES.forEach((name, i) => { HEXAGRAMS[bitsOf(name)] = [i + 1, name]; });
  const SUPREME = new Set(['010010', '100010', '001010']);

  // ---------- 时间与节气 ----------
  const sun = ms => E().bodyLongitude(ms, 0);
  const mod = (a, n) => ((a % n) + n) % n;
  const termIndex = ms => Math.floor(mod(sun(ms) - 315, 360) / 30);

  function termMoment(ms) {
    const target = mod(315 + 30 * termIndex(ms), 360), passed = mod(sun(ms) - target, 360);
    let high = ms, low = ms - (passed / 0.95 + 1) * DAY;
    for (let i = 0; i < 40; i++) {
      const middle = low + (high - low) / 2;
      if (mod(sun(middle) - target, 360) < 180) high = middle; else low = middle;
    }
    return high;
  }
  const isYangSeason = ms => { const lon = sun(ms); return lon >= 270 || lon < 90; };
  function solarYear(ms) {
    const year = new Date(ms).getUTCFullYear();
    return ms >= termMoment(Date.UTC(year, 1, 15)) ? year : year - 1;
  }

  // 某时刻在某时区的钟面时间：zone 为 IANA 名称或「+08:00」
  function wall(ms, zone) {
    zone = String(zone || '+08:00').trim();
    if (!zone.includes('/')) {
      const clean = zone.toUpperCase().replace('UTC', '').replace('GMT', '');
      const sign = clean.startsWith('-') ? -1 : 1, [h, m] = clean.replace(/^[+-]/, '').split(':');
      const d = new Date(ms + sign * ((+h || 0) * 60 + (+m || 0)) * 6e4);
      return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
    }
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric',
      day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(ms)).map(x => [x.type, +x.value]));
    return { y: p.year, mo: p.month, d: p.day, h: p.hour, mi: p.minute };
  }
  const pad = n => String(n).padStart(2, '0');
  const dayText = w => `${w.y}-${pad(w.mo)}-${pad(w.d)}`;
  const dayNumber = text => Date.UTC(+text.slice(0, 4), +text.slice(5, 7) - 1, +text.slice(8, 10)) / DAY;
  const dayOf = n => new Date(n * DAY).toISOString().slice(0, 10);

  function pillars(ms, zone) {
    const local = wall(ms, zone), year = solarYear(ms), yearIndex = mod(year - 4, 60), month = termIndex(ms);
    const monthStem = ((yearIndex % 10) % 5 * 2 + 2 + month) % 10;
    const day = dayNumber(dayText(local)) + (local.h >= 23 ? 1 : 0);
    const dayIndex = mod(day - dayNumber('1949-10-01'), 60);
    const hourBranch = Math.floor((local.h + 1) / 2) % 12, hourStem = ((dayIndex % 10) % 5 * 2 + hourBranch) % 10;
    return [[yearIndex % 10, yearIndex % 12], [monthStem, (month + 2) % 12], [dayIndex % 10, dayIndex % 12], [hourStem, hourBranch]];
  }
  const ganzhi = p => STEMS[p[0]] + BRANCHES[p[1]];

  // ---------- 先天卦、元堂、后天卦 ----------
  function reduceNumber(total, base) {
    if (total === base) return base === 25 ? 5 : 3;
    const rest = total > base ? total - base : total;
    return rest % 10 || Math.floor(total / 10) % 10;
  }
  function lodgeFive(year, male, yang) {
    const era = mod(Math.floor((year - 1864) / 60), 3);
    if (era === 0) return male ? 8 : 2;
    if (era === 1) return male === yang ? 8 : 2;
    return male ? 9 : 7;
  }
  const flip = (bits, line) => bits.slice(0, line - 1) + (bits[line - 1] === '1' ? '0' : '1') + bits.slice(line);
  const answer = line => (line + 2) % 6 + 1;

  function yuantang(bits, hourBranch, male, yangSeason) {
    const yangHour = hourBranch < 6, step = hourBranch % 6;
    if (bits === '111111' || bits === '000000') {
      const reverse = (bits === '111111' && !male && yangSeason) || (bits === '000000' && male && !yangSeason);
      const lines = yangHour !== reverse ? (reverse ? [3, 2, 1] : [1, 2, 3]) : (reverse ? [6, 5, 4] : [4, 5, 6]);
      return lines.concat(lines)[step];
    }
    const want = yangHour ? '1' : '0', same = [], other = [];
    for (let i = 0; i < 6; i++) (bits[i] === want ? same : other).push(i + 1);
    const order = same.length <= 3 ? same.concat(same).slice(0, 6) : same;
    return order.concat(other)[step];
  }
  function houtian(bits, line, yangSeason) {
    const changed = flip(bits, line);
    if (SUPREME.has(bits) && ((line === 5 && !yangSeason) || (line === 6 && yangSeason))) return [changed, line];
    return [changed.slice(3) + changed.slice(0, 3), (line + 2) % 6 + 1];
  }
  function natalGua(ms, zone, male) {
    const four = pillars(ms, zone), numbers = [];
    for (const [stem, branch] of four) numbers.push(STEM_NUMBER[stem], ...BRANCH_NUMBERS[branch]);
    const tian = numbers.filter(n => n % 2).reduce((a, b) => a + b, 0), di = numbers.filter(n => n % 2 === 0).reduce((a, b) => a + b, 0);
    const year = solarYear(ms), yang = four[0][1] % 2 === 0;
    const t = reduceNumber(tian, 25), d = reduceNumber(di, 30);
    const tTri = TRIGRAM_OF_NUMBER[t === 5 ? lodgeFive(year, male, yang) : t], dTri = TRIGRAM_OF_NUMBER[d === 5 ? lodgeFive(year, male, yang) : d];
    const bits = male === yang ? dTri + tTri : tTri + dTri;
    const season = isYangSeason(ms), line = yuantang(bits, four[3][1], male, season);
    return { pillars: four, tian, di, xiantian: [bits, line], houtian: houtian(bits, line, season) };
  }

  // ---------- 流年、流月、每 6 天 ----------
  function yearGua(natal, age, year) {
    const stages = [];
    for (const [bits, line] of [natal.xiantian, natal.houtian]) {
      for (let k = 0; k < 6; k++) { const current = (line - 1 + k) % 6 + 1; stages.push([bits, current, bits[current - 1] === '1' ? 9 : 6]); }
    }
    const total = stages.reduce((a, s) => a + s[2], 0);
    let left = mod(age - 1, total), stage;
    for (stage of stages) { if (left < stage[2]) break; left -= stage[2]; }
    const [bits, line, span] = stage;
    const dots = span === 9 ? [line, answer(line), line].concat([1, 2, 3, 4, 5, 6].map(i => (line - 1 + i) % 6 + 1))
      : [0, 1, 2, 3, 4, 5].map(i => (line - 1 + i) % 6 + 1);
    const firstYear = year - left;
    let current = bits;
    for (let i = 0; i <= left; i++) {
      const dot = dots[i], yangYear = mod(firstYear + i - 4, 2) === 0;
      if (!(current[dot - 1] === '1' && yangYear)) current = flip(current, dot);
    }
    return [current, dots[left]];
  }
  function monthGua(yearBits, yearLine, month) {
    let bits = yearBits, line = yearLine;
    for (let k = 0; k <= Math.floor(month / 2); k++) { line = line % 6 + 1; bits = flip(bits, line); }
    if (month % 2) { line = answer(line); bits = flip(bits, line); }
    return [bits, line];
  }
  function blockGua(monthBits, monthLine, block) {
    const line = (monthLine - 1 + block + 1) % 6 + 1;
    return [flip(monthBits, line), line];
  }
  const hexagram = (bits, line) => ({ bits, number: HEXAGRAMS[bits][0], name: HEXAGRAMS[bits][1], line });

  function baziView(birth, birthZone, male, dayTextValue, viewZone) {
    const endOfDay = E().localToUtc(dayTextValue, '23:59', viewZone) + 59999;
    const start = termMoment(endOfDay), next = termMoment(start + 32 * DAY);
    const startDay = dayNumber(dayText(wall(start, viewZone))), nextDay = dayNumber(dayText(wall(next, viewZone)));
    const month = termIndex(start + 36e5), year = solarYear(start + 36e5);
    const yearPair = [mod(year - 4, 10), mod(year - 4, 12)], age = year - solarYear(birth) + 1;
    const sets = [['personality', '个性', birth], ['design', '设计', E().designMoment(birth)]].map(([key, label, ms]) => {
      const natal = natalGua(ms, birthZone, male), w = wall(ms, birthZone);
      const item = { key, label, time: `${dayText(w)} ${pad(w.h)}:${pad(w.mi)}`, pillars: natal.pillars.map(ganzhi),
        tian: natal.tian, di: natal.di, xiantian: hexagram(...natal.xiantian), houtian: hexagram(...natal.houtian),
        year: null, month: null, blocks: [] };
      if (age >= 1) {
        const [yBits, yLine] = yearGua(natal, age, year), [mBits, mLine] = monthGua(yBits, yLine, month);
        item.year = hexagram(yBits, yLine); item.month = hexagram(mBits, mLine);
        for (let b = 0; b < 5; b++) {
          const first = startDay + 6 * b;
          if (first >= nextDay) break;
          item.blocks.push({ start: dayOf(first), end: dayOf(Math.min(first + 5, nextDay - 1)), ...hexagram(...blockGua(mBits, mLine, b)) });
        }
      }
      return item;
    });
    const monthStem = (yearPair[0] % 5 * 2 + 2 + month) % 10;
    return {
      term: { name: TERMS[month], next: TERMS[(month + 1) % 12], start: dayOf(startDay), end: dayOf(nextDay - 1), month: MONTH_NAMES[month],
        monthGanzhi: STEMS[monthStem] + BRANCHES[(month + 2) % 12], year, yearGanzhi: ganzhi(yearPair), age },
      sets,
    };
  }

  const api = { baziView };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HDBazi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
