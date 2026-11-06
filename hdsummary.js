// 本命人体图概要：类型（策略）、权威、人生角色、轮回交叉、定义的通道。
// 只用个人设计 + 个人个性两组数据，按人类图通行规则推算。
(function (root) {
  'use strict';

  const CHANNEL_LIST = [[1, 8], [2, 14], [3, 60], [4, 63], [5, 15], [6, 59], [7, 31], [9, 52], [10, 20], [10, 34], [10, 57],
    [11, 56], [12, 22], [13, 33], [16, 48], [17, 62], [18, 58], [19, 49], [20, 34], [20, 57], [21, 45], [23, 43], [24, 61],
    [25, 51], [26, 44], [27, 50], [28, 38], [29, 46], [30, 41], [32, 54], [34, 57], [35, 36], [37, 40], [39, 55], [42, 53], [47, 64]];
  const CENTER_GATES = {
    head: [64, 61, 63], ajna: [47, 24, 4, 17, 43, 11], throat: [62, 23, 56, 16, 20, 35, 12, 45, 31, 8, 33],
    g: [1, 7, 13, 10, 25, 15, 46, 2], heart: [21, 51, 26, 40], spleen: [48, 57, 44, 50, 32, 28, 18],
    solar: [36, 22, 37, 6, 49, 55, 30], sacral: [5, 14, 29, 34, 27, 59, 42, 3, 9], root: [53, 60, 52, 54, 19, 38, 39, 58, 41],
  };
  const CENTER_NAMES = { head: '头脑', ajna: '逻辑', throat: '喉咙', g: 'G 中心', heart: '意志力', spleen: '直觉',
    solar: '情绪', sacral: '荐骨', root: '根部' };
  const MOTORS = ['heart', 'solar', 'sacral', 'root'];
  const CENTER_OF = {};
  for (const [center, gates] of Object.entries(CENTER_GATES)) for (const g of gates) CENTER_OF[g] = center;

  const STRATEGY = { '生产者': '等待回应', '显示生产者': '等待回应，行动前告知', '显示者': '行动前告知',
    '投射者': '等待邀请', '反映者': '等待一个月亮周期（约 28 天）' };
  const LINE_NAMES = { 1: '研究者', 2: '隐士', 3: '烈士', 4: '机会主义者', 5: '异端者', 6: '角色模型' };
  // 人生角色决定交叉的角度：4/1 为并列交叉；5、6 开头（及 5/1、5/2、6/2、6/3）为左角度；其余为右角度。
  function crossAngle(p, d) {
    if (p === 4 && d === 1) return '并列交叉';
    return p >= 5 ? '左角度交叉' : '右角度交叉';
  }

  function summary(personality, design) {
    const gates = new Set([...Object.values(personality), ...Object.values(design)].map(b => b.gl.gate));
    const channels = CHANNEL_LIST.filter(([a, b]) => gates.has(a) && gates.has(b));
    const defined = new Set(channels.flatMap(([a, b]) => [CENTER_OF[a], CENTER_OF[b]]));
    // 定义的中心之间按通道连成的图，用来判断马达能否连到喉咙
    const links = {};
    for (const [a, b] of channels) {
      const x = CENTER_OF[a], y = CENTER_OF[b];
      (links[x] = links[x] || new Set()).add(y);
      (links[y] = links[y] || new Set()).add(x);
    }
    const reach = from => {
      const seen = new Set([from]), queue = [from];
      while (queue.length) for (const next of links[queue.shift()] || []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
      return seen;
    };
    const fromThroat = defined.has('throat') ? reach('throat') : new Set();
    const motorToThroat = MOTORS.some(m => fromThroat.has(m));

    let type;
    if (!defined.size) type = '反映者';
    else if (defined.has('sacral')) type = motorToThroat ? '显示生产者' : '生产者';
    else type = motorToThroat ? '显示者' : '投射者';

    let authority;
    if (defined.has('solar')) authority = '情绪权威';
    else if (defined.has('sacral')) authority = '荐骨权威';
    else if (defined.has('spleen')) authority = '直觉权威（脾）';
    else if (defined.has('heart')) authority = (links.heart && links.heart.has('throat')) ? '意志力权威（自我显示）' : '意志力权威（自我投射）';
    else if (defined.has('g') && links.g && links.g.has('throat')) authority = '自我投射权威';
    else if (type === '反映者') authority = '月亮权威';
    else authority = '无内在权威（心智投射）';

    const p = personality['太阳'].gl.line, d = design['太阳'].gl.line;
    return {
      type, strategy: STRATEGY[type], authority,
      profile: { text: `${p}/${d}`, names: `${LINE_NAMES[p]} / ${LINE_NAMES[d]}` },
      cross: {
        angle: crossAngle(p, d),
        gates: [personality['太阳'].gl.gate, personality['地球'].gl.gate, design['太阳'].gl.gate, design['地球'].gl.gate],
      },
      channels: channels.map(c => c.join('-')),
      definedCenters: Object.keys(CENTER_GATES).filter(c => defined.has(c)).map(c => CENTER_NAMES[c]),
    };
  }

  const api = { summary };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HDSummary = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
