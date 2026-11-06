// 人体图（SVG）。布局参照参考 App：九个中心 + 64 个闸门 + 36 条通道。
// 闸门只按是否激活着色；通道半段区分个人深蓝与流日亮粉（本命模式下为个性深蓝与设计亮粉）。中心只按个人闸门上色；被流日接通的中心用粉色边框单独标记。想调位置，改下面的坐标即可。
const BG_POS={64:[255.5,92.6],61:[280,92.6],63:[304.5,92.6],47:[255,152.6],24:[280,152.6],4:[304,152.6],17:[255.5,172],11:[304.5,172],43:[280,217],
62:[255.5,305],23:[280,305],56:[304.5,305],16:[244,323],20:[244,344],35:[316,323],12:[318,344],45:[318,366],31:[255,383.6],8:[279.3,383.6],33:[304,383.6],
1:[279.3,435.4],7:[255,459.5],13:[304,459.5],10:[240,483.7],25:[331,483.7],15:[254.8,515],46:[303.8,515],2:[280,537.6],
21:[400,530],51:[385,542],26:[370,558],40:[423,569],
48:[50,629],57:[72,638],44:[94,648],50:[116,658],32:[94,672],28:[72,684],18:[50,696],
36:[506,624],22:[484,635],37:[462,645],6:[440,655],49:[462,668],55:[484,681],30:[506,694],
5:[254.8,626],14:[280,626],29:[303.8,626],34:[243,651],27:[243,686],59:[318,686],42:[255.5,705.9],3:[280,705.9],9:[303.8,705.9],
53:[255.5,763],60:[280,763],52:[304.5,763],54:[243,782],19:[318,782],38:[243,806],39:[318,806],58:[243,830.5],41:[318,830.5]};
const BG_CENTERS=[
{n:'head',pts:'280,5.6 227,103.6 333,103.6',c:'#f7e48b',g:[64,61,63]},
{n:'ajna',pts:'227,142 333,142 280,239',c:'#9ed49a',g:[47,24,4,17,43,11]},
{n:'throat',pts:'229.6,294 330.4,294 330.4,395.5 229.6,395.5',c:'#f0d5b8',g:[62,23,56,16,20,35,12,45,31,8,33]},
{n:'g',pts:'280,420 347,486.5 280,553 213,486.5',c:'#f5c84c',g:[1,7,13,10,25,15,46,2]},
{n:'heart',pts:'402,512 346,563.5 444,584.5',c:'#f0d5b8',g:[21,51,26,40]},
{n:'spleen',pts:'36.4,611 36.4,715 142.8,658',c:'#f0d5b8',g:[48,57,44,50,32,28,18]},
{n:'solar',pts:'520,605.5 520,715 418,654.5',c:'#f0d5b8',g:[36,22,37,6,49,55,30]},
{n:'sacral',pts:'229.6,617 330.4,617 330.4,715 229.6,715',c:'#a0523d',g:[5,14,29,34,27,59,42,3,9]},
{n:'root',pts:'229.6,752.5 330.4,752.5 330.4,852.6 229.6,852.6',c:'#a0523d',g:[53,60,52,54,19,38,39,58,41]}];
// opts.natal：只看本命图时，蓝色表示个性、粉色表示设计（不叠加流日）。opts.target：画到哪个元素（默认 #chart）。
function drawBodygraph(person,design,flow,flowDesign,opts){
  const natal=!!(opts&&opts.natal);
  const st={},mark=(s,k)=>Object.values(s).forEach(x=>{(st[x.gl.gate]=st[x.gl.gate]||{})[k]=1});
  mark(person,'p');mark(design,'d');mark(flow,'t');mark(flowDesign,'u');
  const mine=g=>st[g]&&(st[g].p||st[g].d);
  const anyOn=g=>st[g]&&(st[g].p||st[g].d||st[g].t||st[g].u);
  const defined=new Set(),touched=new Set(),ctr={};
  BG_CENTERS.forEach(c=>c.g.forEach(g=>ctr[g]=c));
  CHANNELS.forEach(([a,b])=>{
    if(mine(a)&&mine(b)){defined.add(ctr[a]);defined.add(ctr[b])}
    else if(anyOn(a)&&anyOn(b)){touched.add(ctr[a]);touched.add(ctr[b])}});
  let out='<svg viewBox="0 0 560 870" style="width:100%;height:auto;display:block;background:#fbe9d5;border-radius:12px" stroke-linecap="round">';
  const f=n=>Math.round(n*10)/10;
  const strands=(s,d,from,to)=>{
    const personal=natal?s.p:(s.p||s.d),transit=natal?s.d:(s.t||s.u);
    if(!personal&&!transit)return '';
    if(personal&&transit){
      const dx=to[0]-from[0],dy=to[1]-from[1],length=Math.hypot(dx,dy)||1;
      const x=f(-dy/length*2.6),y=f(dx/length*2.6);
      return `<path d="${d}" transform="translate(${x} ${y})" fill="none" stroke="#244b78" stroke-width="4.5"/>`+
        `<path d="${d}" transform="translate(${-x} ${-y})" fill="none" stroke="#f04f87" stroke-width="4.5"/>`;
    }
    return `<path d="${d}" fill="none" stroke="${personal?'#244b78':'#f04f87'}" stroke-width="7"/>`;
  };
  let base='',top='';
  const sharedGates=new Set([10,20,34,57]);
  const channelControl=(A,B)=>{
    const mx=(A[0]+B[0])/2,my=(A[1]+B[1])/2,len=Math.hypot(A[0]-B[0],A[1]-B[1]);
    return Math.abs(A[0]-B[0])<35?[mx,my]:[mx+(mx<280?-1:1)*0.22*len,my];
  };
  CHANNELS.forEach(([a,b])=>{
    if(sharedGates.has(a)&&sharedGates.has(b))return;
    const A=BG_POS[a],B=BG_POS[b],C=channelControl(A,B);
    const M=[.25*A[0]+.5*C[0]+.25*B[0],.25*A[1]+.5*C[1]+.25*B[1]];
    const h1=`M${f(A[0])} ${f(A[1])}Q${f((A[0]+C[0])/2)} ${f((A[1]+C[1])/2)} ${f(M[0])} ${f(M[1])}`;
    const h2=`M${f(M[0])} ${f(M[1])}Q${f((C[0]+B[0])/2)} ${f((C[1]+B[1])/2)} ${f(B[0])} ${f(B[1])}`;
    base+=`<path d="${h1}${h2.replace('M','L').replace(/^L[^Q]*/,'')}" fill="none" stroke="#d8cdc4" stroke-width="3"/>`;
    top+=strands(st[a]||{},h1,A,M)+strands(st[b]||{},h2,M,B)});
  // 20–57 复用 16–48 的弧线算法，再在 10 的高度拆开以分别着色。
  const lerp=(A,B,t)=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t];
  const A=BG_POS[20],B=BG_POS[57],C=channelControl(A,B);
  const t=(BG_POS[10][1]-A[1])/(B[1]-A[1]);
  const upperControl=lerp(A,C,t),lowerControl=lerp(C,B,t);
  const junction=lerp(upperControl,lowerControl,t);
  const f3=n=>Math.round(n*1000)/1000;
  sharedGates.forEach(g=>{
    const [x,y]=BG_POS[g];
    const d=g===20?`M${f(x)} ${f(y)}Q${f3(upperControl[0])} ${f3(upperControl[1])} ${f3(junction[0])} ${f3(junction[1])}`:
      g===57?`M${f(x)} ${f(y)}Q${f3(lowerControl[0])} ${f3(lowerControl[1])} ${f3(junction[0])} ${f3(junction[1])}`:
      `M${f(x)} ${f(y)}L${f3(junction[0])} ${f3(junction[1])}`;
    base+=`<path d="${d}" fill="none" stroke="#d8cdc4" stroke-width="3"/>`;
    top+=strands(st[g]||{},d,[x,y],junction)});
  out+=base+top;
  BG_CENTERS.forEach(c=>{out+=`<polygon points="${c.pts}" fill="${defined.has(c)?c.c:'#fffaf4'}" stroke="${touched.has(c)?'#f04f87':'#444'}" stroke-width="${touched.has(c)?3.5:1.5}" stroke-linejoin="round"/>`});
  Object.entries(BG_POS).forEach(([g,[x,y]])=>{
    const s=st[g]||{},on=s.p||s.d||s.t||s.u;
    if(on)out+=`<circle cx="${x}" cy="${y}" r="8.5" fill="#244b78"/>`;
    out+=`<text x="${x}" y="${y+3.5}" text-anchor="middle" font-size="10" font-family="sans-serif" fill="${on?'#fff':'#2b2320'}">${g}</text>`});
  $((opts&&opts.target)||'chart').innerHTML=out+'</svg>';
}
