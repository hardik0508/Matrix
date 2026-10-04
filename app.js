'use strict';
// ═══ SENA LOGIX AI — app.js (Full Implementation) ═══

// ── Clock ─────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const t = now.toLocaleTimeString('en-IN', {hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const d = now.toLocaleDateString('en-IN', {weekday:'short',day:'2-digit',month:'short',year:'numeric'});
  document.getElementById('clockTime').textContent = t;
  document.getElementById('clockDate').textContent = d;
}
setInterval(updateClock, 1000);
updateClock();

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type='success', dur=3500) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = {success:'✓',error:'✕',info:'ℹ',warning:'⚠'};
  t.innerHTML = `<span>${icons[type]||'ℹ'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), dur);
}

// ── Navigation ────────────────────────────────────────────────
function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('page-' + pageId);
  const nv = document.getElementById('nav-' + pageId);
  if (pg) pg.classList.add('active');
  if (nv) nv.classList.add('active');
  if (pageId === 'gismap' && !window._mapInit) initMap();
  if (pageId === 'forecast') initForecastCharts();
  if (pageId === 'inventory') initInvCharts();
  if (pageId === 'weather') initWeatherCharts();
  if (pageId === 'transport') { initTransportChart(); populateConvoys(); }
  if (pageId === 'readiness') initReadinessPage();
  if (pageId === 'insights') initInsightsPage();
  if (pageId === 'reports') initReportsChart();
  if (pageId === 'simulator') initSimulatorPage();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    switchPage(item.dataset.page);
  });
});

document.getElementById('alertsToggle').addEventListener('click', () => {
  document.getElementById('alertsPanel').classList.toggle('open');
});

// ── Modal Helpers ─────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── Chart defaults ────────────────────────────────────────────
const CHT = {
  color: {
    green:'#4ade80', blue:'#3b82f6', amber:'#f59e0b',
    red:'#ef4444', purple:'#a855f7', muted:'rgba(255,255,255,0.08)'
  },
  font: { family:"'Share Tech Mono', monospace" },
  defaults() {
    Chart.defaults.color = '#8aad8f';
    Chart.defaults.borderColor = 'rgba(74,222,128,0.1)';
    Chart.defaults.font.family = this.font.family;
    Chart.defaults.font.size = 10;
  }
};
CHT.defaults();

function makeGradient(ctx, color, alpha=0.3) {
  const g = ctx.createLinearGradient(0,0,0,300);
  g.addColorStop(0, color.replace(')',`,${alpha})`).replace('rgb','rgba'));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  return g;
}

// ════════════════ DATA ════════════════
const BASES = [
  {name:'Leh',cmd:'Northern',lat:34.16,lng:77.58,status:'normal',fuel:72,ammo:88,rations:81,med:74,transport:76,weather:'HIGH',ready:79},
  {name:'Siachen',cmd:'Northern',lat:35.42,lng:77.11,status:'critical',fuel:18,ammo:65,rations:68,med:71,transport:45,weather:'SEVERE',ready:52},
  {name:'Tawang',cmd:'Eastern',lat:27.58,lng:91.86,status:'watch',fuel:61,ammo:74,rations:77,med:28,transport:68,weather:'MODERATE',ready:63},
  {name:'Jaisalmer',cmd:'Western',lat:26.91,lng:70.91,status:'normal',fuel:88,ammo:91,rations:94,med:87,transport:92,weather:'LOW',ready:91},
  {name:'Srinagar',cmd:'Northern',lat:34.08,lng:74.79,status:'watch',fuel:66,ammo:78,rations:82,med:79,transport:71,weather:'MODERATE',ready:72},
  {name:'Arunachal Sector',cmd:'Eastern',lat:27.10,lng:93.62,status:'watch',fuel:59,ammo:71,rations:74,med:68,transport:62,weather:'HIGH',ready:66},
];

const CMD_DATA = {
  northern:{readiness:78,bases:10,alerts:4,transport:142,shortages:5,weather:6.4},
  western:{readiness:86,bases:7,alerts:1,transport:198,shortages:2,weather:2.1},
  eastern:{readiness:71,bases:5,alerts:3,transport:118,shortages:4,weather:5.2},
  southern:{readiness:89,bases:4,alerts:0,transport:210,shortages:1,weather:1.4},
  central:{readiness:83,bases:3,alerts:2,transport:176,shortages:2,weather:2.8},
};

// ════════════════ DASHBOARD ════════════════
function updateCommandData() {
  const sel = document.getElementById('commandSelect').value;
  const d = CMD_DATA[sel] || CMD_DATA.northern;
  animateVal('mv-readiness', d.readiness, '%');
  animateVal('mv-bases', d.bases);
  animateVal('mv-alerts', d.alerts);
  animateVal('mv-transport', d.transport);
  animateVal('mv-shortages', d.shortages);
  document.getElementById('mv-weather').innerHTML = `${d.weather}<span class="metric-unit">/10</span>`;
}

function animateVal(id, target, suffix='') {
  const el = document.getElementById(id);
  if (!el) return;
  let cur = 0;
  const step = target / 40;
  const iv = setInterval(() => {
    cur = Math.min(cur + step, target);
    const base = el.querySelector('.metric-unit');
    el.childNodes[0].nodeValue = Math.round(cur);
    if (!base && suffix) el.textContent = Math.round(cur) + suffix;
    if (cur >= target) clearInterval(iv);
  }, 20);
}

function refreshDashboard() {
  updateCommandData();
  refreshActivityFeed();
  showToast('Dashboard refreshed — data synchronized', 'success');
}

function populateRegionTable() {
  const tbody = document.getElementById('regionTableBody');
  if (!tbody) return;
  tbody.innerHTML = BASES.map(b => {
    const rc = b.status==='critical'?'red':b.status==='watch'?'amber':'green';
    const rb = `<span class="rb ${rc}">${b.status.toUpperCase()}</span>`;
    const bar = v => `<div style="display:flex;align-items:center;gap:6px"><div style="width:50px;height:4px;background:rgba(255,255,255,0.06);border-radius:2px"><div style="width:${v}%;height:4px;background:${v<35?'#ef4444':v<65?'#f59e0b':'#4ade80'};border-radius:2px"></div></div>${v}%</div>`;
    return `<tr>
      <td><strong>${b.name}</strong></td>
      <td>${b.cmd}</td>
      <td>${bar(b.ready)}</td>
      <td class="${b.fuel<35?'red':b.fuel<65?'amber':'green'}">${b.fuel}%</td>
      <td class="${b.ammo<35?'red':b.ammo<65?'amber':'green'}">${b.ammo}%</td>
      <td class="${b.rations<35?'red':b.rations<65?'amber':'green'}">${b.rations}%</td>
      <td class="${b.med<35?'red':b.med<65?'amber':'green'}">${b.med}%</td>
      <td class="${b.transport<35?'red':b.transport<65?'amber':'green'}">${b.transport}%</td>
      <td class="${b.weather==='SEVERE'?'red':b.weather==='HIGH'||b.weather==='MODERATE'?'amber':'green'}">${b.weather}</td>
      <td>${rb}</td>
    </tr>`;
  }).join('');
}

// Supply Trend Chart
let supplyChart = null;
const SUPPLY_DATA = {
  fuel:    [420,410,435,448,421,439,455,468,445,462,471,480,458,442,476,485,462,491,484,470,499,510,488,502,497,508,521,515,530,524],
  ammo:    [180,175,182,178,185,179,183,188,181,186,190,184,188,193,187,192,198,195,201,197,203,199,205,202,208,206,212,209,215,211],
  rations: [1820,1840,1830,1860,1850,1870,1855,1880,1870,1895,1880,1900,1885,1910,1920,1905,1930,1915,1940,1925,1950,1935,1960,1945,1970,1955,1980,1965,1990,1975],
  medicine:[82,80,85,83,88,86,91,89,87,92,90,95,93,97,94,99,96,101,98,103,100,105,102,107,104,109,106,111,108,113],
};
const SUPPLY_LABELS = Array.from({length:30},(_,i)=>`D-${30-i}`);
const SUPPLY_UNITS = {fuel:'kL',ammo:'T',rations:'packs',medicine:'units'};

function initSupplyChart(cat='fuel') {
  const ctx = document.getElementById('supplyTrendChart');
  if (!ctx) return;
  const data = SUPPLY_DATA[cat];
  if (supplyChart) supplyChart.destroy();
  supplyChart = new Chart(ctx, {
    type:'line',
    data:{
      labels: SUPPLY_LABELS,
      datasets:[{
        label:`${cat.charAt(0).toUpperCase()+cat.slice(1)} (${SUPPLY_UNITS[cat]})`,
        data, borderColor:'#4ade80', borderWidth:2, pointRadius:0, tension:0.4,
        fill:true, backgroundColor: ctx.getContext('2d').createLinearGradient(0,0,0,200).toString()
      }]
    },
    options:{
      responsive:true, animation:{duration:600},
      plugins:{legend:{display:false}},
      scales:{
        x:{grid:{color:'rgba(74,222,128,0.06)'},ticks:{maxTicksLimit:10}},
        y:{grid:{color:'rgba(74,222,128,0.06)'}}
      }
    }
  });
  const g = supplyChart.ctx.createLinearGradient(0,0,0,200);
  g.addColorStop(0,'rgba(74,222,128,0.25)');
  g.addColorStop(1,'rgba(74,222,128,0)');
  supplyChart.data.datasets[0].backgroundColor = g;
  supplyChart.update();
}

function switchSupplyTab(btn, cat) {
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  initSupplyChart(cat);
}

// Readiness Donut
let donutChart = null;
function initReadinessDonut() {
  const ctx = document.getElementById('readinessDonut');
  if (!ctx) return;
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels:['Inventory','Transport','Weather','Supply Chain','Op Risk'],
      datasets:[{data:[82,76,61,79,68],backgroundColor:['#4ade80','#3b82f6','#f59e0b','#a855f7','#ef4444'],borderWidth:0,hoverOffset:8}]
    },
    options:{
      responsive:true, cutout:'68%',
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.label}: ${c.raw}%`}}}
    }
  });
}

function refreshActivityFeed() {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;
  const now = new Date();
  const fmt = d => d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false});
  const items = [
    {type:'critical',msg:'🔴 ALERT: Fuel convoy to Siachen delayed – road blockage at 14,000 ft', offset:0},
    {type:'warning', msg:'🟡 WARNING: Medical supplies below threshold at Tawang Base', offset:3},
    {type:'info',    msg:'🔵 INFO: Helicopter sortie dispatched – 2.4 tonnes rations to Siachen', offset:11},
    {type:'success', msg:'🟢 SUCCESS: Ammunition convoy arrived at Leh – 94% on schedule', offset:19},
    {type:'info',    msg:'🔵 INFO: AI forecast updated – winter gear demand spike predicted Oct 20', offset:31},
    {type:'success', msg:'🟢 SUCCESS: Supply depot Jaisalmer restocked – rations +30 day buffer', offset:43},
    {type:'warning', msg:'🟡 WARNING: NH-58 landslide probability 72% – rerouting convoy 7-B', offset:56},
    {type:'info',    msg:'🔵 INFO: Engineering supplies dispatched – Arunachal forward post', offset:71},
  ];
  feed.innerHTML = items.map(i => {
    const t = new Date(now - i.offset * 60000);
    return `<div class="af-item ${i.type}"><span class="af-time">${fmt(t)}</span><span class="af-msg">${i.msg}</span></div>`;
  }).join('');
}

// ── Dashboard Init ─────────────────────────────────────────────
function initDashboard() {
  initSupplyChart('fuel');
  initReadinessDonut();
  populateRegionTable();
  refreshActivityFeed();
}
initDashboard();

// ════════════════ GIS MAP ════════════════
let map = null;
let mapLayers = {bases:[], depots:[], routes:[], hubs:[]};

function initMap() {
  if (window._mapInit) return;
  window._mapInit = true;
  map = L.map('logisticsMap', {zoomControl:true, attributionControl:false}).setView([28,78], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:18}).addTo(map);

  const mkIcon = (color,emoji,size=32) => L.divIcon({
    html:`<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${size/2.2}px;border:2px solid rgba(255,255,255,0.3);box-shadow:0 0 12px ${color}">${emoji}</div>`,
    iconSize:[size,size], iconAnchor:[size/2,size/2], className:''
  });

  const baseIcon  = (s) => mkIcon(s==='critical'?'#ef4444':s==='watch'?'#f59e0b':'#4ade80','🏔',34);
  const depotIcon = mkIcon('rgba(59,130,246,0.9)','📦',28);
  const hubIcon   = mkIcon('rgba(168,85,247,0.9)','⚙',28);

  BASES.forEach(b => {
    const m = L.marker([b.lat,b.lng],{icon:baseIcon(b.status)}).addTo(map);
    m.bindPopup(`<div style="color:#e2f5e8;min-width:180px"><b style="color:#4ade80;font-size:13px">${b.name}</b><br><small style="color:#8aad8f">${b.cmd} Command</small><hr style="border-color:rgba(74,222,128,0.2);margin:6px 0"><div style="font-size:11px;display:grid;gap:4px"><span>⛽ Fuel: <b style="color:${b.fuel<35?'#ef4444':b.fuel<65?'#f59e0b':'#4ade80'}">${b.fuel}%</b></span><span>💊 Medical: <b style="color:${b.med<35?'#ef4444':b.med<65?'#f59e0b':'#4ade80'}">${b.med}%</b></span><span>🛡 Readiness: <b style="color:#4ade80">${b.ready}%</b></span></div></div>`);
    m.on('click',()=>showMapPanel(b));
    mapLayers.bases.push(m);
  });

  const depots = [
    {name:'Chandigarh Depot',lat:30.74,lng:76.79},{name:'Delhi ASC',lat:28.61,lng:77.21},
    {name:'Jammu Depot',lat:32.73,lng:74.86},{name:'Dibrugarh Depot',lat:27.48,lng:94.91}
  ];
  depots.forEach(d => {
    const m = L.marker([d.lat,d.lng],{icon:depotIcon}).addTo(map);
    m.bindPopup(`<div style="color:#e2f5e8"><b style="color:#3b82f6">${d.name}</b><br><small style="color:#8aad8f">Supply Depot</small></div>`);
    mapLayers.depots.push(m);
  });

  const routeCoords = [
    {name:'NH-1',coords:[[34.08,74.79],[34.16,77.58]],color:'#f59e0b',risk:'HIGH'},
    {name:'NH-3',coords:[[32.25,77.18],[34.16,77.58]],color:'#4ade80',risk:'MEDIUM'},
    {name:'NH-13',coords:[[27.48,94.91],[27.58,91.86]],color:'#f59e0b',risk:'MEDIUM'},
    {name:'NH-44',coords:[[32.08,75.34],[34.08,74.79]],color:'#4ade80',risk:'LOW'},
    {name:'Siachen Route',coords:[[34.16,77.58],[35.42,77.11]],color:'#ef4444',risk:'SEVERE'},
  ];
  routeCoords.forEach(r => {
    const pl = L.polyline(r.coords,{color:r.color,weight:3,opacity:0.7,dashArray:r.risk==='SEVERE'?'6,4':null}).addTo(map);
    pl.bindTooltip(`${r.name} — ${r.risk}`,{permanent:false});
    mapLayers.routes.push(pl);
  });

  const hubs = [{name:'Northern HQ',lat:32.73,lng:74.86},{name:'Eastern HQ',lat:27.10,lng:93.62}];
  hubs.forEach(h => {
    const m = L.marker([h.lat,h.lng],{icon:hubIcon}).addTo(map);
    m.bindPopup(`<div style="color:#e2f5e8"><b style="color:#a855f7">${h.name}</b></div>`);
    mapLayers.hubs.push(m);
  });

  setTimeout(()=>map.invalidateSize(),300);
}

function showMapPanel(b) {
  document.getElementById('mipTitle').textContent = b.name.toUpperCase();
  document.getElementById('mipContent').innerHTML = `
    <div class="mip-field"><div class="mip-field-label">COMMAND</div><div class="mip-field-val">${b.cmd} Command</div></div>
    <div class="mip-field"><div class="mip-field-label">STATUS</div><div class="mip-field-val" style="color:${b.status==='critical'?'#ef4444':b.status==='watch'?'#f59e0b':'#4ade80'}">${b.status.toUpperCase()}</div></div>
    ${['fuel','ammo','rations','med','transport'].map(k=>{
      const labels={fuel:'FUEL',ammo:'AMMO',rations:'RATIONS',med:'MEDICINE',transport:'TRANSPORT'};
      const v=b[k]; const c=v<35?'red':v<65?'amber':'green';
      return `<div class="mip-field"><div class="mip-field-label">${labels[k]}</div>
        <div class="mip-field-val">${v}%</div>
        <div class="mip-progress-wrap"><div class="mip-bar-fill ${c}" style="width:${v}%"></div></div></div>`;
    }).join('')}
    <div class="mip-field"><div class="mip-field-label">READINESS SCORE</div><div class="mip-field-val" style="color:#4ade80;font-size:20px">${b.ready}%</div></div>
    <div class="mip-field"><div class="mip-field-label">WEATHER RISK</div><div class="mip-field-val" style="color:${b.weather==='SEVERE'?'#ef4444':b.weather==='HIGH'||b.weather==='MODERATE'?'#f59e0b':'#4ade80'}">${b.weather}</div></div>`;
}

function closeMapPanel() {
  document.getElementById('mipTitle').textContent = 'SELECT A LOCATION';
  document.getElementById('mipContent').innerHTML = `<p class="mip-placeholder">Click on any base, depot, or hub on the map to view detailed logistics intelligence.</p>`;
}

function toggleLayer(btn, layer) {
  btn.classList.toggle('active');
  const on = btn.classList.contains('active');
  mapLayers[layer].forEach(m => on ? m.addTo(map) : map.removeLayer(m));
}

// ════════════════ DEMAND FORECASTING ════════════════
let forecastChart = null;
const FDATA = {
  fuel:{
    hist:[380,390,410,400,420,415,430,440,425,438,450,460,442,458,470,480,465,478,490,500],
    forecast:[490,505,518,512,528,542,535,550,558,545],
    unit:'kL', val7:'1,560 kL', val30:'6,240 kL', conf:'91.4%', risk:'HIGH'
  },
  ammo:{
    hist:[165,170,168,175,172,178,180,176,182,185,183,188,190,186,192,195,191,196,200,197],
    forecast:[198,202,205,200,208,212,207,215,218,213],
    unit:'Tons', val7:'1,420 T', val30:'4,820 T', conf:'87.0%', risk:'MEDIUM'
  },
  rations:{
    hist:[1720,1740,1730,1760,1750,1780,1765,1790,1780,1810,1795,1820,1810,1840,1830,1860,1848,1870,1860,1890],
    forecast:[1890,1920,1910,1940,1925,1960,1945,1980,1968,2000],
    unit:'Packs', val7:'13,240 packs', val30:'18,600 packs', conf:'94.0%', risk:'LOW'
  },
  medicine:{
    hist:[75,78,80,77,82,85,83,88,86,90,92,89,94,97,95,100,98,103,101,105],
    forecast:[106,110,108,114,112,118,115,121,118,125],
    unit:'Units', val7:'750 units', val30:'2,140 units', conf:'89.0%', risk:'HIGH'
  },
  winter:{
    hist:[120,130,145,160,175,198,220,250,290,335,380,430,490,560,640,720,810,900,1010,1130],
    forecast:[1260,1410,1580,1760,1950,2150,2380,2620,2870,3130],
    unit:'Sets', val7:'2,100 sets', val30:'8,450 sets', conf:'96.0%', risk:'MEDIUM'
  },
  engineering:{
    hist:[42,44,43,46,45,48,47,50,49,52,51,54,53,56,55,58,57,60,59,62],
    forecast:[62,64,63,66,65,68,67,70,69,72],
    unit:'Units', val7:'445 units', val30:'1,280 units', conf:'83.0%', risk:'LOW'
  }
};
let currentFCat = 'fuel';

function showForecastDetail(cat) {
  currentFCat = cat;
  document.querySelectorAll('.fcat-card').forEach((c,i) => c.style.borderColor = '');
  const d = FDATA[cat];
  const labels = [...Array.from({length:20},(_,i)=>`D-${20-i}`),...Array.from({length:10},(_,i)=>`+${i+1}`)];
  const title = cat.charAt(0).toUpperCase()+cat.slice(1);
  document.getElementById('forecastChartTitle').textContent = `${title.toUpperCase()} DEMAND FORECAST – 30 DAY PROJECTION`;
  document.getElementById('fsr7').textContent = d.val7;
  document.getElementById('fsr30').textContent = d.val30;
  document.getElementById('fsr30').nextElementSibling && null;
  updateForecastChart(labels, d, cat);
}

function updateForecastChart(labels, d, cat) {
  const ctx = document.getElementById('forecastChart');
  if (!ctx) return;
  if (forecastChart) forecastChart.destroy();
  const full = [...d.hist, ...d.forecast];
  const histFull = [...d.hist, ...Array(d.forecast.length).fill(null)];
  const fcFull   = [...Array(d.hist.length-1).fill(null), d.hist[d.hist.length-1], ...d.forecast];
  forecastChart = new Chart(ctx, {
    type:'line',
    data:{
      labels,
      datasets:[
        {label:'Historical',data:histFull,borderColor:'#4ade80',borderWidth:2,pointRadius:0,tension:0.4,fill:false},
        {label:'AI Forecast',data:fcFull,borderColor:'#3b82f6',borderWidth:2,pointRadius:0,tension:0.4,fill:true,backgroundColor:'rgba(59,130,246,0.1)',borderDash:[5,3]}
      ]
    },
    options:{
      responsive:true,animation:{duration:700},
      plugins:{legend:{display:false}},
      scales:{
        x:{grid:{color:'rgba(74,222,128,0.06)'},ticks:{maxTicksLimit:12}},
        y:{grid:{color:'rgba(74,222,128,0.06)'}}
      }
    }
  });
}

function updateForecastCharts() { showForecastDetail(currentFCat); }

function initForecastCharts() {
  if (!window._fcInit) {
    window._fcInit = true;
    showForecastDetail('fuel');
  }
}

// ════════════════ INVENTORY ════════════════
let invCharts = {};
const INV_CAT = [
  {id:'invFuelChart', color:'#ef4444', hist:[420,415,418,422,419,424,421,426,423,427,425,430,428,432]},
  {id:'invAmmoChart', color:'#4ade80', hist:[48,47,49,48,50,49,51,50,52,51,53,52,54,53]},
  {id:'invRationsChart', color:'#4ade80', hist:[1840,1830,1855,1845,1870,1858,1880,1868,1895,1882,1910,1898,1925,1912]},
  {id:'invMedChart', color:'#ef4444', hist:[86,85,88,87,90,88,92,90,93,91,95,93,97,95]},
  {id:'invWinterChart', color:'#f59e0b', hist:[210,220,230,245,260,280,300,325,350,380,410,445,480,520]},
  {id:'invEngChart', color:'#4ade80', hist:[28,29,28,30,29,31,30,32,31,33,32,34,33,35]},
];

function initInvCharts() {
  if (window._invInit) return;
  window._invInit = true;
  INV_CAT.forEach(c => {
    const ctx = document.getElementById(c.id);
    if (!ctx) return;
    if (invCharts[c.id]) invCharts[c.id].destroy();
    invCharts[c.id] = new Chart(ctx, {
      type:'bar',
      data:{
        labels:Array.from({length:14},(_,i)=>`D-${14-i}`),
        datasets:[{data:c.hist,backgroundColor:c.color+'33',borderColor:c.color,borderWidth:1,borderRadius:2}]
      },
      options:{responsive:true,animation:{duration:600},plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:false}}}
    });
  });
}

function generateReorderRecommendations() {
  showToast('🤖 VEER AI analyzing inventory levels...', 'info', 2000);
  setTimeout(() => showToast('Reorder recommendations updated – 4 priority actions generated', 'success'), 2200);
}

function dispatchAlert(type, base) {
  showToast(`Dispatch request initiated: ${type.toUpperCase()} → ${base}`, 'success');
}

function approveReorder(btn) {
  const item = btn.closest('.reorder-item');
  btn.textContent = '✓ APPROVED';
  btn.style.background = 'rgba(74,222,128,0.3)';
  btn.disabled = true;
  showToast('Reorder approved — procurement initiated', 'success');
}

// ════════════════ WEATHER ════════════════
let weatherCharts = {};
function initWeatherCharts() {
  if (window._wxInit) return;
  window._wxInit = true;
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  const snowCtx = document.getElementById('snowfallChart');
  if (snowCtx) {
    weatherCharts.snow = new Chart(snowCtx, {
      type:'bar',
      data:{
        labels:days,
        datasets:[
          {label:'Siachen (cm)',data:[55,68,42,80,72,45,60],backgroundColor:'rgba(239,68,68,0.6)',borderRadius:3},
          {label:'Leh (cm)',data:[20,28,15,35,30,18,22],backgroundColor:'rgba(245,158,11,0.6)',borderRadius:3},
          {label:'Srinagar (cm)',data:[8,12,5,14,10,6,9],backgroundColor:'rgba(59,130,246,0.5)',borderRadius:3},
        ]
      },
      options:{responsive:true,animation:{duration:700},plugins:{legend:{position:'top'}},scales:{x:{grid:{color:'rgba(74,222,128,0.06)'}},y:{grid:{color:'rgba(74,222,128,0.06)'},title:{display:true,text:'Snowfall (cm)'}}}}
    });
  }

  const terrCtx = document.getElementById('terrainHeatmap');
  if (terrCtx) {
    weatherCharts.terrain = new Chart(terrCtx, {
      type:'bar',
      data:{
        labels:['Siachen','Ladakh','Tawang','Srinagar','J&K','Arunachal','Jaisalmer'],
        datasets:[{
          label:'Terrain Risk Score',
          data:[9.2,7.4,5.2,4.5,6.1,4.8,1.2],
          backgroundColor:['#ef4444','#f59e0b','#f59e0b','#f59e0b','#f59e0b','#4ade80','#4ade80'],
          borderRadius:4
        }]
      },
      options:{responsive:true,animation:{duration:700},indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{max:10,grid:{color:'rgba(74,222,128,0.06)'},title:{display:true,text:'Risk Score /10'}},y:{grid:{display:false}}}}
    });
  }
}

// ════════════════ TRANSPORT ════════════════
let transportChart = null;
const CONVOYS = [
  {id:'CNV-24-LEH-01',from:'Chandigarh',to:'Leh',cargo:'Rations',mode:'Road',eta:'18h',status:'EN ROUTE',progress:68},
  {id:'CNV-24-SIA-02',from:'Jammu',to:'Siachen',cargo:'Fuel',mode:'Helicopter',eta:'2h',status:'URGENT',progress:22},
  {id:'CNV-24-TAW-03',from:'Dibrugarh',to:'Tawang',cargo:'Medicine',mode:'Road',eta:'6h',status:'DELAYED',progress:41},
  {id:'CNV-24-LEH-04',from:'Delhi ASC',to:'Leh',cargo:'Ammo',mode:'AN-32',eta:'2.5h',status:'EN ROUTE',progress:85},
  {id:'CNV-24-SRI-05',from:'Chandigarh',to:'Srinagar',cargo:'Winter Gear',mode:'Road',eta:'5h',status:'ON SCHEDULE',progress:53},
  {id:'CNV-24-JAI-06',from:'Delhi ASC',to:'Jaisalmer',cargo:'Mixed',mode:'Rail+Road',eta:'12h',status:'ON SCHEDULE',progress:34},
];

function populateConvoys() {
  const tbody = document.getElementById('convoyTableBody');
  if (!tbody) return;
  const sc = {
    'EN ROUTE':'<span style="color:#3b82f6">● EN ROUTE</span>',
    'URGENT':'<span style="color:#ef4444;font-weight:700">⚠ URGENT</span>',
    'DELAYED':'<span style="color:#f59e0b">▲ DELAYED</span>',
    'ON SCHEDULE':'<span style="color:#4ade80">✓ ON SCHEDULE</span>'
  };
  tbody.innerHTML = CONVOYS.map(c => `<tr>
    <td><strong style="font-family:var(--font-mono)">${c.id}</strong></td>
    <td>${c.from}</td><td>${c.to}</td><td>${c.cargo}</td><td>${c.mode}</td><td>${c.eta}</td>
    <td>${sc[c.status]||c.status}</td>
    <td><div class="progress-bar-cell"><div class="pbc-bar"><div class="pbc-fill" style="width:${c.progress}%"></div></div><span class="pbc-val">${c.progress}%</span></div></td>
  </tr>`).join('');
}

function initTransportChart() {
  if (window._transInit) return;
  window._transInit = true;
  const ctx = document.getElementById('transportChart');
  if (!ctx) return;
  transportChart = new Chart(ctx, {
    type:'radar',
    data:{
      labels:['Trucks','Helicopters','Airlift','Rail','Mule/Porter'],
      datasets:[
        {label:'Current',data:[76,64,45,90,70],backgroundColor:'rgba(74,222,128,0.15)',borderColor:'#4ade80',borderWidth:2,pointBackgroundColor:'#4ade80'},
        {label:'Capacity',data:[100,100,100,100,100],backgroundColor:'rgba(59,130,246,0.05)',borderColor:'rgba(59,130,246,0.3)',borderWidth:1,pointRadius:0}
      ]
    },
    options:{
      responsive:true,
      scales:{r:{grid:{color:'rgba(74,222,128,0.1)'},ticks:{display:false},pointLabels:{color:'#8aad8f',font:{size:11}},beginAtZero:true,max:100}},
      plugins:{legend:{position:'bottom'}}
    }
  });
}

function planNewConvoy() { openModal('convoyModal'); }
function optimizeRoutes() { showToast('VEER AI running route optimization — analyzing 847 route combinations...', 'info', 4000); }

function createConvoy() {
  const id = document.getElementById('newConvoyId').value || `CNV-${Date.now()}-AUTO`;
  closeModal('convoyModal');
  showToast(`Convoy ${id} created and scheduled`, 'success');
}

function computeRoute() {
  const orig = document.getElementById('roOrigin').value;
  const dest = document.getElementById('roDest').value;
  showToast(`Computing optimal route: ${orig} → ${dest}`, 'info', 2000);
}

// ════════════════ MISSION READINESS ════════════════
let gaugeChart = null, readinessTrend = null;
function initReadinessPage() {
  if (window._rdInit) return;
  window._rdInit = true;

  const gc = document.getElementById('readinessGauge');
  if (gc) {
    gaugeChart = new Chart(gc, {
      type:'doughnut',
      data:{
        labels:['Readiness','Gap'],
        datasets:[{data:[78,22],backgroundColor:['#4ade80','rgba(255,255,255,0.04)'],borderWidth:0,circumference:270,rotation:-135}]
      },
      options:{responsive:false,cutout:'72%',plugins:{legend:{display:false},tooltip:{enabled:false}}}
    });
  }

  const rtc = document.getElementById('readinessTrendChart');
  if (rtc) {
    const days = Array.from({length:30},(_,i)=>`D-${30-i}`);
    readinessTrend = new Chart(rtc, {
      type:'line',
      data:{
        labels:days,
        datasets:[
          {label:'Northern',data:[72,73,71,74,75,73,76,77,75,78,76,79,77,78,79,80,78,79,81,79,80,82,80,81,79,80,82,81,78,78],borderColor:'#4ade80',borderWidth:2,pointRadius:0,tension:0.4,fill:false},
          {label:'Western', data:[84,85,83,86,87,85,88,87,86,89,87,88,90,88,89,91,89,90,92,90,91,90,89,91,90,88,89,87,86,86],borderColor:'#3b82f6',borderWidth:2,pointRadius:0,tension:0.4,fill:false},
          {label:'Eastern', data:[68,70,69,71,70,72,71,73,70,72,71,73,72,74,71,73,72,70,72,71,73,72,71,73,70,72,71,70,71,71],borderColor:'#f59e0b',borderWidth:2,pointRadius:0,tension:0.4,fill:false},
        ]
      },
      options:{responsive:true,animation:{duration:800},plugins:{legend:{position:'top'}},scales:{x:{grid:{color:'rgba(74,222,128,0.06)'},ticks:{maxTicksLimit:10}},y:{min:60,max:100,grid:{color:'rgba(74,222,128,0.06)'}}}}
    });
  }

  populateCommandReadiness();
  populateBaseReadiness();
}

function populateCommandReadiness() {
  const grid = document.getElementById('commandReadinessGrid');
  if (!grid) return;
  const cmds = [
    {name:'NORTHERN',score:78,label:'OPERATIONAL',cls:'green'},
    {name:'WESTERN', score:86,label:'HIGH READY',cls:'green'},
    {name:'EASTERN', score:71,label:'WATCH',cls:'amber'},
    {name:'SOUTHERN',score:89,label:'FULL READY',cls:'green'},
    {name:'CENTRAL', score:83,label:'OPERATIONAL',cls:'green'},
  ];
  grid.innerHTML = cmds.map(c=>`
    <div class="cmd-readiness-card ${c.cls}">
      <div class="crc-name">${c.name} CMD</div>
      <div class="crc-score ${c.cls}">${c.score}<span style="font-size:16px">%</span></div>
      <div class="crc-label ${c.cls}">${c.label}</div>
      <div class="crc-bar ${c.cls}" style="width:100%"></div>
    </div>`).join('');
}

function populateBaseReadiness() {
  const tbody = document.getElementById('baseReadinessBody');
  if (!tbody) return;
  tbody.innerHTML = BASES.map(b => {
    const cls = v => v>=75?'green':v>=50?'amber':'red';
    const rb = `<span class="rb ${cls(b.ready)}">${b.ready}%</span>`;
    return `<tr>
      <td><strong>${b.name}</strong></td>
      <td class="${cls(b.rations)}">${b.rations}%</td>
      <td class="${cls(b.transport)}">${b.transport}%</td>
      <td class="${b.weather==='SEVERE'?'red':b.weather==='HIGH'||b.weather==='MODERATE'?'amber':'green'}">${b.weather}</td>
      <td class="${cls(b.fuel)}">${b.fuel}%</td>
      <td class="${b.status==='critical'?'red':b.status==='watch'?'amber':'green'}">${b.status.toUpperCase()}</td>
      <td>${rb}</td>
      <td><span class="rb ${cls(b.ready)}">${b.status==='critical'?'CRITICAL':b.status==='watch'?'WATCH':'OPERATIONAL'}</span></td>
    </tr>`;
  }).join('');
}

// ════════════════ AI INSIGHTS ════════════════
let riskChart = null;
const INSIGHTS = [
  {type:'critical',priority:'P1-CRITICAL',title:'Immediate Fuel Airlift — Siachen Base',body:'Siachen will exhaust fuel in 6 days. Helicopter airlift of 2,400 kL required within 48 hours. Ground route blocked due to severe snowfall.', action:'DISPATCH ORDER'},
  {type:'warning', priority:'P2-HIGH',   title:'Medical Resupply — Tawang Base',body:'Medical stock at 28% of safety threshold. AI predicts altitude illness cases to spike 22% next week. Road convoy via NH-13 feasible within 72 hours.', action:'INITIATE REORDER'},
  {type:'warning', priority:'P3-HIGH',   title:'Winter Gear Pre-positioning',body:'85% probability of heavy snowfall by Oct 20. Current stock deficit: 2,050 sets. Procure from ASC depot Chandigarh and dispatch via NH-3 immediately.', action:'PRE-POSITION'},
  {type:'info',    priority:'P4-MEDIUM', title:'Increase Leh Fuel Buffer by 15%',body:'Troop rotation next week will drive 18% demand surge. Buffer adjustment of 2,760 kL recommended before Oct 15 to prevent shortfall.', action:'SCHEDULE DISPATCH'},
  {type:'info',    priority:'P5-MEDIUM', title:'Reallocate Transport — Northern Command',body:'Northern Command faces 23% transport deficit in Oct operations. Recommend temporary reallocation of 18 trucks from Central Command (low-ops period).', action:'REQUEST REALLOCATION'},
  {type:'info',    priority:'P6-LOW',    title:'Route Redundancy — NH-1 Alternative',body:'NH-1 blockage probability reaching 82%. Pre-clear NH-3 (Manali-Leh) and establish air corridor protocols to maintain supply continuity.', action:'PLAN ALTERNATIVE'},
];

function initInsightsPage() {
  if (window._insInit) return;
  window._insInit = true;
  populateInsights();

  const rc = document.getElementById('riskTrendChart');
  if (rc) {
    riskChart = new Chart(rc, {
      type:'line',
      data:{
        labels:Array.from({length:30},(_,i)=>`D-${30-i}`),
        datasets:[
          {label:'Supply Risk',data:[55,57,54,58,60,58,62,64,61,65,63,67,65,68,66,70,67,69,71,68,72,70,73,71,75,72,76,74,77,74],borderColor:'#ef4444',borderWidth:2,tension:0.4,fill:false,pointRadius:0},
          {label:'Weather Risk',data:[30,32,35,40,38,42,45,48,44,50,52,48,55,58,54,60,62,58,65,68,64,70,68,72,71,75,73,77,76,80],borderColor:'#f59e0b',borderWidth:2,tension:0.4,fill:false,pointRadius:0},
          {label:'Readiness',  data:[78,77,79,78,80,79,81,80,78,79,81,80,82,81,79,80,82,81,80,82,81,83,82,80,81,83,82,81,79,78],borderColor:'#4ade80',borderWidth:2,tension:0.4,fill:false,pointRadius:0},
        ]
      },
      options:{responsive:true,animation:{duration:800},plugins:{legend:{position:'top'}},scales:{x:{grid:{color:'rgba(74,222,128,0.06)'},ticks:{maxTicksLimit:10}},y:{min:0,max:100,grid:{color:'rgba(74,222,128,0.06)'}}}}
    });
  }

  const pal = document.getElementById('priorityActionsList');
  if (pal) {
    pal.innerHTML = INSIGHTS.slice(0,4).map((ins,i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border-radius:4px;border:1px solid var(--border-color);margin-bottom:8px">
        <div><div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-bottom:3px">${ins.priority}</div><div style="font-size:11px;color:var(--text-primary)">${ins.title.substring(0,30)}...</div></div>
        <button class="btn-tactical small" onclick="showToast('Action initiated: ${ins.action}','success')">${ins.action.split(' ')[0]}</button>
      </div>`).join('');
  }
}

function populateInsights() {
  const grid = document.getElementById('insightsGrid');
  if (!grid) return;
  grid.innerHTML = INSIGHTS.map(ins => `
    <div class="insight-item ${ins.type}">
      <div style="min-width:80px"><span style="font-family:var(--font-mono);font-size:9px;padding:3px 6px;border-radius:3px;background:rgba(168,85,247,0.15);color:var(--purple)">${ins.priority}</span></div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:700;margin-bottom:4px;color:var(--text-primary)">${ins.title}</div>
        <div style="font-size:11px;color:var(--text-secondary);line-height:1.5">${ins.body}</div>
      </div>
      <button class="btn-tactical small" style="flex-shrink:0" onclick="showToast('${ins.action} initiated','success')">${ins.action}</button>
    </div>`).join('');
}

function refreshInsights() {
  showToast('VEER AI refreshing intelligence analysis...', 'info', 2000);
  setTimeout(() => { populateInsights(); showToast('AI insights updated — 6 recommendations active', 'success'); }, 2200);
}

// ════════════════ SCENARIO SIMULATOR ════════════════
let scenChart = null;
const SCENARIOS = {
  snowfall:{
    title:'❄️ HEAVY SNOWFALL – 72HR SIMULATION',
    impact:[
      {label:'Routes Blocked',val:'NH-1, NH-3, Siachen Route',cls:'red'},
      {label:'Supply Disruption',val:'4 bases affected — 48-72 hrs',cls:'red'},
      {label:'Fuel Risk',val:'Siachen: CRITICAL (3 days)',cls:'red'},
      {label:'Helicopter Ops',val:'MARGINAL — 40% capacity',cls:'amber'},
      {label:'Readiness Drop',val:'-12% (78% → 66%)',cls:'amber'},
    ],
    recs:['Emergency airlift fuel to Siachen within 12 hours','Pre-position 30-day supplies at all mountain bases','Activate NH-3 clearance operations immediately','Alert 3 ALH Dhruv helicopters for emergency ops'],
    chart:[78,72,66,62,60,58,61,64,68,72],
  },
  roadclosure:{
    title:'🚧 NH-1 COMPLETE BLOCKAGE SCENARIO',
    impact:[
      {label:'Primary Route',val:'NH-1 BLOCKED — 7-14 days',cls:'red'},
      {label:'Leh Supply',val:'45% reduction in throughput',cls:'red'},
      {label:'Alt Route NH-3',val:'ACTIVATED — +8h transit',cls:'amber'},
      {label:'Air Bridge',val:'Required for priority cargo',cls:'amber'},
      {label:'Cost Impact',val:'+340% per ton (airlift vs road)',cls:'amber'},
    ],
    recs:['Route all critical supplies via NH-3 immediately','Establish Chandigarh–Leh air bridge (3 AN-32 sorties/day)','Pre-position 2-week buffer at Leh before closure','Coordinate with BRO for emergency road clearance'],
    chart:[78,76,72,68,65,64,66,68,71,74],
  },
  mobilization:{
    title:'🪖 5,000 TROOP FORWARD DEPLOYMENT',
    impact:[
      {label:'Ration Demand',val:'+42% (5,200 packs/day)',cls:'red'},
      {label:'Fuel Demand',val:'+38% (580 kL/day)',cls:'red'},
      {label:'Medical Demand',val:'+55% (133 units/day)',cls:'amber'},
      {label:'Transport Needed',val:'+28 trucks, +4 helicopters',cls:'amber'},
      {label:'Readiness Target',val:'Full combat ready: D+14',cls:'green'},
    ],
    recs:['Requisition 28 additional trucks from Central Command','Increase Leh fuel stock by 4,500 kL before D+3','Pre-deploy medical teams to 3 forward bases','Coordinate rail logistics to Jammu for heavy equipment'],
    chart:[78,80,82,84,86,84,86,88,88,90],
  },
  medical:{
    title:'🏥 MASS CASUALTY EVENT – FORWARD BASE',
    impact:[
      {label:'Medical Demand',val:'+800% — 688 units/day',cls:'red'},
      {label:'Evacuation Routes',val:'3 helipads activated',cls:'amber'},
      {label:'Blood Supply',val:'CRITICAL — 0% at site',cls:'red'},
      {label:'Surgeon Teams',val:'2 of 5 required on-site',cls:'amber'},
      {label:'ETA to Stabilize',val:'36-48 hours with airlift',cls:'amber'},
    ],
    recs:['Immediate helicopter evacuation of critical cases to Leh hospital','Air-dispatch emergency medical kit (Priority-1 package)','Activate Army Medical Corps rapid response team','Establish forward surgical team at nearest accessible base'],
    chart:[78,70,62,55,52,55,60,66,72,76],
  },
  escalation:{
    title:'⚠️ BORDER ESCALATION – HIGH READINESS',
    impact:[
      {label:'Ammo Demand',val:'+120% — all categories',cls:'red'},
      {label:'Fuel Consumption',val:'+85% — vehicle ops up',cls:'red'},
      {label:'Transport Assets',val:'100% mobilization required',cls:'amber'},
      {label:'Readiness Target',val:'92%+ within 48 hours',cls:'green'},
      {label:'Supply Chain',val:'Priority-1 surge mode',cls:'amber'},
    ],
    recs:['Activate emergency ammo draw from strategic reserves','Mobilize all available transport assets immediately','Establish 24/7 logistics operations center','Coordinate airlift for time-critical ammunition'],
    chart:[78,82,86,89,91,93,92,94,93,92],
  },
  airlift:{
    title:'✈️ EMERGENCY AIRLIFT – HELICOPTER ONLY',
    impact:[
      {label:'Access Mode',val:'HELICOPTER ONLY — all routes closed',cls:'red'},
      {label:'Capacity',val:'2.4 tonnes/sortie × 8 sorties/day',cls:'amber'},
      {label:'Priority Cargo',val:'Fuel, Medicine, Rations',cls:'amber'},
      {label:'Daily Throughput',val:'19.2 tonnes (vs 180 by road)',cls:'red'},
      {label:'Duration Estimate',val:'Operation sustained 7-10 days',cls:'amber'},
    ],
    recs:['Schedule 8 helicopter sorties/day (ALH Dhruv + Cheetah)','Prioritize: 1) Fuel 2) Medicine 3) Rations 4) Ammo','Activate Leh air-forward refuelling point','Request additional HAROP helicopters from IAF if needed'],
    chart:[78,72,68,65,64,65,67,70,73,76],
  }
};

function initSimulatorPage() {
  // Nothing to pre-init
}

function runScenario(key) {
  const s = SCENARIOS[key];
  if (!s) return;
  document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active-scen'));
  document.getElementById('scen-'+key)?.classList.add('active-scen');
  document.getElementById('scenarioResultTitle').textContent = s.title;
  document.getElementById('scenarioResultContent').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
      <div>
        <div style="font-family:var(--font-mono);font-size:10px;color:var(--army-green);letter-spacing:2px;margin-bottom:10px">IMPACT ASSESSMENT</div>
        ${s.impact.map(i=>`<div style="display:flex;justify-content:space-between;padding:8px;border-radius:4px;border:1px solid var(--border-color);margin-bottom:6px;font-size:11px">
          <span style="color:var(--text-muted)">${i.label}</span>
          <span class="${i.cls}" style="color:${i.cls==='red'?'#ef4444':i.cls==='amber'?'#f59e0b':'#4ade80'};font-weight:700">${i.val}</span>
        </div>`).join('')}
      </div>
      <div>
        <div style="font-family:var(--font-mono);font-size:10px;color:var(--army-green);letter-spacing:2px;margin-bottom:10px">AI RECOMMENDATIONS</div>
        ${s.recs.map((r,i)=>`<div style="display:flex;gap:10px;padding:8px;border-radius:4px;border:1px solid rgba(74,222,128,0.2);margin-bottom:6px;font-size:11px;background:rgba(74,222,128,0.04)">
          <span style="font-family:var(--font-mono);color:var(--army-green);flex-shrink:0">R${i+1}</span>
          <span style="color:var(--text-secondary);line-height:1.4">${r}</span>
        </div>`).join('')}
      </div>
    </div>
    <button class="btn-tactical" onclick="showToast('Scenario response plan exported to Reports','success')">📄 EXPORT RESPONSE PLAN</button>`;

  const chartCard = document.getElementById('scenImpactChartCard');
  chartCard.style.display = 'block';
  document.getElementById('scenChartTitle').textContent = 'READINESS IMPACT – 10 DAY PROJECTION';
  const ctx = document.getElementById('scenarioImpactChart');
  if (scenChart) scenChart.destroy();
  scenChart = new Chart(ctx, {
    type:'line',
    data:{
      labels:['D+0','D+1','D+2','D+3','D+4','D+5','D+6','D+7','D+8','D+9'],
      datasets:[
        {label:'Projected Readiness',data:s.chart,borderColor:'#f59e0b',borderWidth:2,tension:0.4,fill:true,backgroundColor:'rgba(245,158,11,0.1)',pointRadius:4,pointBackgroundColor:'#f59e0b'},
        {label:'Without Intervention',data:[78,...s.chart.slice(1).map(v=>Math.max(v-8,35))],borderColor:'#ef4444',borderWidth:2,tension:0.4,fill:false,borderDash:[4,3],pointRadius:0},
      ]
    },
    options:{responsive:true,animation:{duration:700},plugins:{legend:{position:'top'}},scales:{x:{grid:{color:'rgba(74,222,128,0.06)'}},y:{min:30,max:100,grid:{color:'rgba(74,222,128,0.06)'}}}}
  });

  showToast(`Scenario "${s.title}" simulation complete`, 'info');
}

// Add active-scen styling
const style = document.createElement('style');
style.textContent = `.scenario-btn.active-scen{border-color:var(--army-green)!important;background:rgba(74,222,128,0.1)!important;box-shadow:var(--glow-green);}`;
document.head.appendChild(style);

// ════════════════ REPORTS ════════════════
let reportChart = null;
function initReportsChart() {
  if (window._repInit) return;
  window._repInit = true;
  const ctx = document.getElementById('reportChart');
  if (!ctx) return;
  const days = Array.from({length:30},(_,i)=>`D-${30-i}`);
  reportChart = new Chart(ctx, {
    type:'bar',
    data:{
      labels:days,
      datasets:[
        {label:'PDF Reports',data:[3,2,4,3,5,4,6,5,7,6,4,5,8,6,7,9,7,8,10,8,9,11,9,10,8,9,12,10,11,9],backgroundColor:'rgba(74,222,128,0.6)',borderRadius:3},
        {label:'Excel Exports',data:[1,2,1,2,3,2,3,2,4,3,2,3,4,3,4,5,3,4,5,4,5,6,4,5,3,4,6,5,4,5],backgroundColor:'rgba(59,130,246,0.5)',borderRadius:3},
      ]
    },
    options:{responsive:true,animation:{duration:700},plugins:{legend:{position:'top'}},scales:{x:{grid:{color:'rgba(74,222,128,0.06)'},ticks:{maxTicksLimit:10}},y:{grid:{color:'rgba(74,222,128,0.06)'}}}}
  });
}

function downloadReport(type, fmt) {
  showToast(`Generating ${type.toUpperCase()} report as ${fmt.toUpperCase()}...`, 'info', 2000);
  setTimeout(() => showToast(`${type.toUpperCase()} report downloaded successfully`, 'success'), 2500);
}
function printReport(type) { showToast(`Print queue: ${type.toUpperCase()} report — sending to secure printer`, 'info'); }

// ════════════════ VEER AI CHAT ════════════════
const AI_RESPONSES = {
  fuel: `**FUEL ANALYSIS — NORTHERN COMMAND**\n\nCurrent fuel reserves: **18,400 kL** (vs safety stock 22,000 kL)\n\n🔴 **Critical**: Siachen Forward Base — 6 days remaining\n🟡 **Watch**: Leh Base — 43 days at current consumption\n\n**Recommendation**: Dispatch 2,400 kL to Siachen via helicopter within 48 hours. Increase Leh buffer by 2,760 kL before troop rotation. AI Confidence: **91.4%**`,
  medical: `**MEDICAL SUPPLY ASSESSMENT — TAWANG BASE**\n\nCurrent stock: **3,200 units** (30-day demand: 2,580 units)\n🟡 Status: **BELOW SAFETY THRESHOLD**\n\n**AI Forecast**: Altitude illness cases predicted to spike 22% next week due to fresh troop induction.\n\n**Recommendation**: Dispatch 4,200 units via NH-13 road convoy. ETA: 72 hours. Confidence: **89%**`,
  route: `**ROUTE ANALYSIS — SIACHEN ACCESS**\n\n| Route | Status | Risk | ETA |\n|-------|--------|------|-----|\n| Road (Leh–Siachen) | ❌ BLOCKED | SEVERE | N/A |\n| Helicopter (ALH) | ⚠ MARGINAL | HIGH | 2.5h |\n| AN-32 Airlift | ✓ BEST OPTION | MEDIUM | 3h |\n\n**Recommendation**: Use AN-32 airlift from Chandigarh. Pre-position supplies at Leh as intermediate depot.`,
  readiness: `**MISSION READINESS — NORTHERN COMMAND**\n\n**Overall Score: 78% — OPERATIONAL**\n\n| Factor | Score |\n|--------|-------|\n| Inventory Availability | 82% |\n| Transport Capacity | 76% |\n| Weather Accessibility | 61% |\n| Supply Reliability | 79% |\n| Operational Risk | 68% |\n\n**Key Gap**: Weather accessibility dragging readiness. Addressing NH-1 disruption could raise score to 84%.`,
  weather: `**7-DAY WEATHER RISK SUMMARY**\n\n🔴 **Siachen**: SEVERE — Heavy snowfall 40-60cm, -18°C, 72km/h winds. No road access.\n🟡 **Leh/Ladakh**: HIGH — NH-1 disruption probability 82%.\n🟡 **Srinagar/Kashmir**: MODERATE — Light snowfall 5-10cm.\n🟢 **Tawang**: MODERATE — Fog, reduced visibility.\n🟢 **Jaisalmer**: LOW — Clear, no disruption expected.\n\n**Action**: Pre-position 14-day supplies at mountain bases before Oct 18.`,
  transport: `**TRANSPORT ASSET STATUS**\n\nTotal Assets: **187 vehicles/platforms**\n\n| Type | Available | In Transit | Maintenance |\n|------|-----------|------------|-------------|\n| Trucks | 98 | 32 | 12 |\n| Helicopters | 11 | 5 | 2 |\n| Airlift (AN-32) | 6 | 3 | 1 |\n| Rail Rakes | 18 | 6 | 3 |\n| Mule Columns | 42 | 18 | 0 |\n\n**Utilization**: 76% trucks, 64% helicopters, 90% rail. Rail is at near-capacity — consider additional rakes.`,
  default: `**VEER AI — ANALYSIS COMPLETE**\n\nI have analyzed the current logistics intelligence for the Indian Army Northern Command.\n\n**Key Findings:**\n• Mission Readiness: 78% (operational threshold met)\n• Critical alerts: 4 requiring immediate action\n• Predicted shortages: 7 bases in next 30 days\n• Weather disruption risk: HIGH (NH-1 corridor)\n\nPlease ask me about fuel, medical supplies, transport, routes, weather risk, or mission readiness for detailed analysis.`
};

function formatAIResponse(txt) {
  return txt
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\n\n/g,'<br><br>')
    .replace(/\n/g,'<br>')
    .replace(/\|(.+)\|/g, (m,cells) => {
      if (cells.trim().match(/^[-| ]+$/)) return '';
      const cols = cells.split('|').map(c => `<td style="padding:4px 8px;border:1px solid rgba(74,222,128,0.1)">${c.trim()}</td>`).join('');
      return `<table style="border-collapse:collapse;width:100%;margin:4px 0"><tr>${cols}</tr></table>`;
    });
}

function getAIAnswer(q) {
  const ql = q.toLowerCase();
  if (ql.includes('fuel') || ql.includes('petroleum')) return AI_RESPONSES.fuel;
  if (ql.includes('medical') || ql.includes('medicine') || ql.includes('health')) return AI_RESPONSES.medical;
  if (ql.includes('route') || ql.includes('convoy') || ql.includes('siachen')) return AI_RESPONSES.route;
  if (ql.includes('readiness') || ql.includes('ready') || ql.includes('status')) return AI_RESPONSES.readiness;
  if (ql.includes('weather') || ql.includes('snow') || ql.includes('terrain')) return AI_RESPONSES.weather;
  if (ql.includes('transport') || ql.includes('truck') || ql.includes('helicopter') || ql.includes('asset')) return AI_RESPONSES.transport;
  return AI_RESPONSES.default;
}

function addChatMsg(role, content) {
  const box = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  const initials = role==='ai'?'V':'AS';
  div.innerHTML = `
    <div class="chat-avatar ${role}">${initials}</div>
    <div class="chat-bubble ${role}">${role==='ai'?formatAIResponse(content):content}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function addThinking() {
  const box = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg ai'; div.id = 'thinkingMsg';
  div.innerHTML = `<div class="chat-avatar ai">V</div><div class="chat-bubble ai"><div class="chat-thinking"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div></div></div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function sendChatMsg() {
  const inp = document.getElementById('chatInput');
  const q = inp.value.trim();
  if (!q) return;
  inp.value = '';
  inp.disabled = true;
  document.getElementById('chatSendBtn').disabled = true;
  addChatMsg('user', q);
  addThinking();
  const delay = 900 + Math.random()*800;
  setTimeout(() => {
    document.getElementById('thinkingMsg')?.remove();
    addChatMsg('ai', getAIAnswer(q));
    inp.disabled = false;
    document.getElementById('chatSendBtn').disabled = false;
    inp.focus();
  }, delay);
}

function clearChat() {
  const box = document.getElementById('chatMessages');
  box.innerHTML = `<div class="chat-msg ai">
    <div class="chat-avatar ai">V</div>
    <div class="chat-bubble ai"><strong>Jai Hind! I am VEER AI</strong>, your AI-powered Logistics Intelligence Assistant.<br><br>How can I assist your mission today?</div>
  </div>`;
  showToast('Chat history cleared', 'info');
}

function useSuggestedPrompt(btn) {
  document.getElementById('chatInput').value = btn.textContent;
  sendChatMsg();
}

// ════════════════ STARTUP ════════════════
window.addEventListener('load', () => {
  updateCommandData();
  populateRegionTable();
  setTimeout(() => showToast('SENA LOGIX AI — System Online · All modules active', 'success', 4000), 800);
});
