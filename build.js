const fs = require('fs');

// 1. package.json с настройками сборки
const pkg = {
  name: "ynater",
  version: "1.0.0",
  description: "Dynamic Island виджет для Windows",
  main: "main.js",
  author: "Ynater",
  license: "MIT",
  scripts: {
    start: "electron .",
    build: "electron-builder",
    "build:win": "electron-builder --win"
  },
  devDependencies: {
    electron: "^28.0.0",
    "electron-builder": "^24.13.3"
  },
  build: {
    appId: "com.ynater.app",
    productName: "Ynater",
    directories: { output: "dist" },
    files: ["main.js", "index.html", "package.json"],
    win: {
      target: [{ target: "nsis", arch: ["x64"] }],
      artifactName: "Ynater-Setup-${version}.${ext}"
    },
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: "Ynater"
    }
  }
};
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

// 2. main.js
const mainCode = `const { app, BrowserWindow, screen, ipcMain, globalShortcut, clipboard } = require('electron');
const https = require('https');
let win, isVisible = true, clipboardHistory = [], lastClipText = '';
app.whenReady().then(() => {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({ width: 850, height: 500, x: Math.round((width-850)/2), y: 0, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, webPreferences: { nodeIntegration: true, contextIsolation: false } });
  win.loadFile('index.html');
  globalShortcut.register('CommandOrControl+Space', () => { isVisible = !isVisible; isVisible ? win.show() : win.hide(); });
  globalShortcut.register('CommandOrControl+1', () => { if(win&&!win.isDestroyed()) win.webContents.executeJavaScript('switchTab("home")').catch(()=>{}); });
  globalShortcut.register('CommandOrControl+2', () => { if(win&&!win.isDestroyed()) win.webContents.executeJavaScript('switchTab("music")').catch(()=>{}); });
  globalShortcut.register('CommandOrControl+3', () => { if(win&&!win.isDestroyed()) win.webContents.executeJavaScript('switchTab("weather")').catch(()=>{}); });
  globalShortcut.register('CommandOrControl+4', () => { if(win&&!win.isDestroyed()) win.webContents.executeJavaScript('switchTab("clipboard")').catch(()=>{}); });
  globalShortcut.register('CommandOrControl+5', () => { if(win&&!win.isDestroyed()) win.webContents.executeJavaScript('switchTab("notes")').catch(()=>{}); });
  setInterval(() => {
    try { const text = clipboard.readText();
      if (text && text !== lastClipText && text.length > 0 && text.length < 500) {
        lastClipText = text; clipboardHistory.unshift({ text, time: new Date().toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'}) });
        if (clipboardHistory.length > 20) clipboardHistory.pop();
        if (win && !win.isDestroyed()) win.webContents.send('clip-update', clipboardHistory);
      }
    } catch(e) {}
  }, 800);
  ipcMain.handle('get-clip', () => clipboardHistory);
  ipcMain.handle('copy-clip', (e, t) => { clipboard.writeText(t); return true; });
  ipcMain.handle('get-weather', async (e, lat, lon) => new Promise((res, rej) => {
    https.get('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current_weather=true&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,pressure_msl&daily=uv_index_max,sunrise,sunset', {rejectUnauthorized:false}, (r) => {
      let d=''; r.on('data', c=>d+=c); r.on('end', ()=>{ try{res(JSON.parse(d));}catch(err){rej(err);} });
    }).on('error', rej);
  }));
  ipcMain.handle('geocode-city', async (e, city) => new Promise((res, rej) => {
    https.get('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(city)+'&count=1&language=ru', {rejectUnauthorized:false}, (r) => {
      let d=''; r.on('data', c=>d+=c); r.on('end', ()=>{ try{const j=JSON.parse(d); if(!j.results||!j.results.length) rej(new Error('Нет')); else res({lat:j.results[0].latitude, lon:j.results[0].longitude, name:j.results[0].name});}catch(err){rej(err);} });
    }).on('error', rej);
  }));
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });`;
fs.writeFileSync('main.js', mainCode);

// 3. index.html - полный рабочий код
const htmlCode = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --bg: #000000; --surface: #1c1c1e; --surface2: #2c2c2e; --text: #ffffff; --text2: #8e8e93; --accent: #ffffff; --border: rgba(255,255,255,0.1); }
  body { background: transparent; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; padding-top: 10px; user-select: none; overflow: hidden; }
  .island { width: 180px; height: 36px; background: var(--bg); border-radius: 18px; position: relative; cursor: pointer; transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 1px solid var(--border); }
  .island:hover { width: 850px; height: 500px; border-radius: 24px; }
  .cv { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; gap: 12px; color: var(--text); font-size: 14px; font-weight: 500; transition: opacity 0.3s; }
  .island:hover .cv { opacity: 0; pointer-events: none; }
  .ev { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; pointer-events: none; transition: opacity 0.3s; display: flex; flex-direction: column; background: var(--bg); }
  .island:hover .ev { opacity: 1; pointer-events: auto; }
  .tabs { display: flex; gap: 4px; padding: 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; flex-wrap: wrap; }
  .tab { padding: 8px 14px; background: var(--surface); border-radius: 12px; font-size: 13px; color: var(--text2); cursor: pointer; transition: all 0.2s; border: none; outline: none; }
  .tab:hover { background: var(--surface2); color: var(--text); }
  .tab.active { background: var(--accent); color: #000; }
  .content { flex: 1; padding: 16px; overflow-y: auto; color: var(--text); }
  .content::-webkit-scrollbar { width: 6px; }
  .content::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 3px; }
  .dash { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .dc { background: var(--surface); border-radius: 16px; padding: 16px; }
  .dc.full { grid-column: 1/-1; }
  .dt { font-size: 11px; color: var(--text2); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: 600; }
  .greet { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
  .greet-sub { font-size: 13px; color: var(--text2); }
  .qt { display: flex; gap: 8px; flex-wrap: wrap; }
  .qb { flex: 1; min-width: 80px; padding: 12px; background: var(--surface2); border: none; border-radius: 12px; color: var(--text); cursor: pointer; transition: all 0.2s; font-size: 13px; font-weight: 600; }
  .qb:hover { background: var(--accent); color: #000; transform: scale(1.05); }
  .qb .tm { font-size: 18px; display: block; margin-bottom: 2px; }
  .qb .lb { font-size: 10px; color: var(--text2); }
  .qb:hover .lb { color: #000; }
  .rn { display: flex; flex-direction: column; gap: 6px; }
  .ri { padding: 10px; background: var(--surface2); border-radius: 10px; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ri.empty { color: var(--text2); font-style: italic; text-align: center; padding: 20px; }
  .wf { display: flex; justify-content: space-between; gap: 8px; }
  .wi { flex: 1; text-align: center; padding: 8px; background: var(--surface2); border-radius: 10px; }
  .wih { font-size: 11px; color: var(--text2); margin-bottom: 4px; }
  .wic { font-size: 20px; margin-bottom: 4px; }
  .wit { font-size: 13px; font-weight: 600; }
  .quote { font-size: 14px; font-style: italic; color: var(--text2); text-align: center; padding: 12px; line-height: 1.5; }
  .quote-a { font-size: 11px; margin-top: 8px; font-style: normal; font-weight: 600; color: var(--accent); }
  .upload { padding: 24px; background: var(--surface); border-radius: 16px; text-align: center; cursor: pointer; border: 2px dashed var(--border); margin-bottom: 16px; }
  .upload:hover { background: var(--surface2); border-color: var(--accent); }
  .upload input { display: none; }
  .ci { padding: 12px; background: var(--surface); border-radius: 12px; margin-bottom: 8px; cursor: pointer; transition: background 0.2s; }
  .ci:hover { background: var(--surface2); }
  .ct { font-size: 14px; margin-bottom: 4px; word-break: break-word; }
  .ctm { font-size: 11px; color: var(--text2); }
  .wm { display: flex; gap: 20px; margin-bottom: 20px; padding: 20px; background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); border-radius: 20px; }
  .wtemp { font-size: 64px; font-weight: 300; line-height: 1; }
  .wdesc { font-size: 18px; margin-top: 8px; }
  .wd { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .wdc { padding: 16px; background: var(--surface); border-radius: 16px; text-align: center; }
  .wdl { font-size: 11px; color: var(--text2); text-transform: uppercase; margin-bottom: 8px; }
  .wdv { font-size: 20px; font-weight: 600; }
  .ni { width: 100%; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; color: var(--text); font-size: 14px; outline: none; resize: none; font-family: inherit; margin-bottom: 12px; }
  .ni:focus { border-color: var(--accent); }
  .nl { display: flex; flex-direction: column; gap: 8px; }
  .nit { padding: 12px; background: var(--surface); border-radius: 12px; display: flex; justify-content: space-between; align-items: start; }
  .nd { background: none; border: none; color: #ff453a; cursor: pointer; font-size: 18px; padding: 4px 8px; }
  .td { font-size: 72px; font-weight: 200; text-align: center; margin: 40px 0; font-variant-numeric: tabular-nums; }
  .tc { display: flex; gap: 12px; justify-content: center; }
  .tb { padding: 12px 32px; background: var(--accent); border: none; border-radius: 12px; color: #000; font-size: 16px; font-weight: 600; cursor: pointer; }
  .tb.sec { background: var(--surface); color: #fff; }
  .ss { margin-bottom: 24px; }
  .st { font-size: 13px; color: var(--text2); text-transform: uppercase; margin-bottom: 12px; font-weight: 600; }
  .cp { display: flex; gap: 12px; flex-wrap: wrap; }
  .co { width: 48px; height: 48px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; transition: all 0.2s; position: relative; }
  .co:hover { transform: scale(1.15); }
  .co.active { border-color: #000; box-shadow: 0 0 0 2px #fff, 0 0 0 4px #000; }
  .co.active::after { content: "✓"; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #000; font-weight: bold; font-size: 20px; }
  .co[data-color="#ffffff"].active::after { color: #fff; text-shadow: 0 0 4px #000; }
</style>
</head>
<body>
<div class="island">
  <div class="cv"><div id="cTime">00:00</div><div id="cW"><span id="wI">☀️</span> <span id="wT">--°</span></div></div>
  <div class="ev">
    <div class="tabs">
      <button class="tab active" data-tab="home">🏠 Главная</button>
      <button class="tab" data-tab="music">🎵 Музыка</button>
      <button class="tab" data-tab="weather">🌤️ Погода</button>
      <button class="tab" data-tab="clipboard">📋 Буфер</button>
      <button class="tab" data-tab="notes">📝 Заметки</button>
      <button class="tab" data-tab="timer">⏱️ Таймер</button>
      <button class="tab" data-tab="settings">⚙️ Настройки</button>
    </div>
    <div class="content" id="content"></div>
  </div>
</div>
<script>
const { ipcRenderer } = require('electron');
let curTab = 'home', notes = JSON.parse(localStorage.getItem('island_notes') || '[]'), clipHist = [];
let tTime = 0, tInt = null, tRun = false;
let wData = null, sCity = localStorage.getItem('island_city') || 'Москва';
let sCoords = JSON.parse(localStorage.getItem('island_coords') || '{"lat":55.7558,"lon":37.6173}');
const colors = [{n:'Белый',v:'#ffffff'},{n:'Синий',v:'#0a84ff'},{n:'Зеленый',v:'#30d158'},{n:'Оранжевый',v:'#ff9f0a'},{n:'Красный',v:'#ff453a'},{n:'Фиолетовый',v:'#bf5af2'},{n:'Розовый',v:'#ff375f'},{n:'Бирюзовый',v:'#64d2ff'},{n:'Желтый',v:'#ffd60a'},{n:'Индиго',v:'#5e5ce6'},{n:'Мятный',v:'#32d74b'},{n:'Коралловый',v:'#ff6961'}];
const quotes = [{t:'Каждый день — новый шанс стать лучше.',a:'Неизвестно'},{t:'Успех — это сумма маленьких усилий.',a:'Роберт Кольер'},{t:'Не бойся медлить, бойся остановиться.',a:'Китайская пословица'},{t:'Ты сильнее, чем думаешь.',a:'Неизвестно'},{t:'Дисциплина — мост между целями и достижениями.',a:'Джим Рон'}];
function getGreet(){const h=new Date().getHours();if(h>=5&&h<12)return{t:'Доброе утро',i:'☀️'};if(h>=12&&h<18)return{t:'Добрый день',i:'🌤️'};if(h>=18&&h<23)return{t:'Добрый вечер',i:'🌙'};return{t:'Доброй ночи',i:'✨'};}
function getQuote(){const d=Math.floor((new Date()-new Date(new Date().getFullYear(),0,0))/86400000);return quotes[d%quotes.length];}
function updClock(){document.getElementById('cTime').textContent=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});}
updClock();setInterval(updClock,1000);
document.querySelectorAll('.tab').forEach(tab=>{tab.addEventListener('click',(e)=>{e.stopPropagation();document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');curTab=tab.dataset.tab;render();});});
function render(){const c=document.getElementById('content');
if(curTab==='home'){const g=getGreet(),q=getQuote(),dt=new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'}),rn=notes.slice(0,3);
let fh='';if(wData&&wData.hourly){const ch=new Date().getHours(),hs=[ch,ch+3,ch+6,ch+9,ch+12].filter(h=>h<24);fh=hs.map(h=>{const tp=Math.round(wData.hourly.temperature_2m[h]),ic=wIc(wData.hourly.weather_code?wData.hourly.weather_code[h]:0);return'<div class="wi"><div class="wih">'+h+':00</div><div class="wic">'+ic+'</div><div class="wit">'+tp+'°</div></div>';}).join('');}else{fh='<div style="text-align:center;color:var(--text2);padding:20px;grid-column:1/-1">Загрузка прогноза...</div>';}
c.innerHTML='<div class="dash"><div class="dc full"><div class="greet">'+g.i+' '+g.t+'</div><div class="greet-sub">'+dt.charAt(0).toUpperCase()+dt.slice(1)+'</div></div><div class="dc"><div class="dt">⚡ Быстрые таймеры</div><div class="qt"><button class="qb" onclick="qTimer(5)"><span class="tm">5</span><span class="lb">минут</span></button><button class="qb" onclick="qTimer(15)"><span class="tm">15</span><span class="lb">минут</span></button><button class="qb" onclick="qTimer(25)"><span class="tm">25</span><span class="lb">минут</span></button></div></div><div class="dc"><div class="dt">📝 Последние заметки</div><div class="rn">'+(rn.length===0?'<div class="ri empty">Нет заметок</div>':rn.map(n=>'<div class="ri">'+n+'</div>').join(''))+'</div></div><div class="dc full"><div class="dt">🌤️ Прогноз на день</div><div class="wf">'+fh+'</div></div><div class="dc full"><div class="quote">"'+q.t+'"<div class="quote-a">— '+q.a+'</div></div></div></div>';}
else if(curTab==='music'){c.innerHTML='<div class="upload" onclick="document.getElementById(\\'fIn\\').click()"><input type="file" id="fIn" accept="audio/*" onchange="playM(this)"><div style="font-size:40px;margin-bottom:12px">📁</div><div style="font-size:16px;font-weight:600">Нажмите, чтобы выбрать MP3</div><div style="font-size:13px;color:var(--text2);margin-top:8px">Локальное воспроизведение</div></div><div id="mP"></div>';}
else if(curTab==='weather'){if(!wData){c.innerHTML='<div style="text-align:center;padding:60px;color:var(--text2)">Загрузка погоды...</div>';loadW();return;}const cu=wData.current_weather,ho=wData.hourly,da=wData.daily,nH=new Date().getHours();c.innerHTML='<div class="wm"><div><div class="wtemp">'+Math.round(cu.temperature)+'°</div><div class="wdesc">'+wD(cu.weathercode)+'</div><div style="margin-top:8px;font-size:14px">'+sCity+'</div></div></div><div class="wd"><div class="wdc"><div class="wdl">Ветер</div><div class="wdv">'+cu.windspeed+' м/с</div></div><div class="wdc"><div class="wdl">Влажность</div><div class="wdv">'+ho.relative_humidity_2m[nH]+'%</div></div><div class="wdc"><div class="wdl">Давление</div><div class="wdv">'+Math.round(ho.pressure_msl[nH])+' гПа</div></div><div class="wdc"><div class="wdl">UV индекс</div><div class="wdv">'+da.uv_index_max[0]+'</div></div><div class="wdc"><div class="wdl">Восход</div><div class="wdv">'+da.sunrise[0].split("T")[1]+'</div></div><div class="wdc"><div class="wdl">Закат</div><div class="wdv">'+da.sunset[0].split("T")[1]+'</div></div></div>';}
else if(curTab==='clipboard'){if(clipHist.length===0){c.innerHTML='<div style="text-align:center;padding:60px;color:var(--text2)">Буфер обмена пуст</div>';}else{c.innerHTML='<div>'+clipHist.map((it,i)=>'<div class="ci" onclick="copyB(\\''+it.text.replace(/'/g,"\\\\'")+'\\')"><div class="ct">'+it.text+'</div><div class="ctm">'+it.time+'</div></div>').join('')+'</div>';}}
else if(curTab==='notes'){c.innerHTML='<textarea class="ni" id="nI" placeholder="Новая заметка..." rows="3"></textarea><button class="tb" onclick="addN()" style="width:100%;margin-bottom:12px">Добавить</button><div class="nl">'+(notes.length===0?'<div style="text-align:center;padding:40px;color:var(--text2)">Нет заметок</div>':notes.map((n,i)=>'<div class="nit"><div>'+n+'</div><button class="nd" onclick="delN('+i+')">✕</button></div>').join(''))+'</div>';}
else if(curTab==='timer'){const m=Math.floor(tTime/60),s=tTime%60,ts=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');c.innerHTML='<div class="td">'+ts+'</div><div class="tc"><button class="tb" onclick="togT()">'+(tRun?'Пауза':'Старт')+'</button><button class="tb sec" onclick="resT()">Сброс</button></div><div style="display:flex;gap:8px;justify-content:center;margin-top:24px"><button class="tb sec" onclick="setT(5)">5 мин</button><button class="tb sec" onclick="setT(15)">15 мин</button><button class="tb sec" onclick="setT(25)">25 мин</button></div>';}
else if(curTab==='settings'){const ca=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();c.innerHTML='<div class="ss"><div class="st">🎨 Цвет акцента (12 цветов)</div><div class="cp">'+colors.map(col=>'<div class="co '+(col.v.toLowerCase()===ca.toLowerCase()?'active':'')+'" style="background:'+col.v+'" data-color="'+col.v+'" title="'+col.n+'" onclick="setA(\\''+col.v+'\\',this)"></div>').join('')+'</div><div style="margin-top:12px;font-size:12px;color:var(--text2)">Выбрано: <span id="cCN" style="color:var(--accent);font-weight:600">'+cN(ca)+'</span></div></div><div class="ss"><div class="st">🌍 Город для погоды</div><input type="text" class="ni" id="cIn" value="'+sCity+'" placeholder="Введите город"><button class="tb" onclick="chCity()" style="width:100%;margin-top:8px">Сохранить</button></div>';}
}
window.qTimer=function(m){tTime=m*60;tRun=false;clearInterval(tInt);document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.querySelector('.tab[data-tab="timer"]').classList.add('active');curTab='timer';render();};
window.playM=function(inp){const f=inp.files[0];if(!f)return;const u=URL.createObjectURL(f);document.getElementById('mP').innerHTML='<audio controls autoplay style="width:100%;margin-top:16px;border-radius:12px" src="'+u+'"></audio><div style="text-align:center;margin-top:12px;font-weight:600">'+f.name+'</div>';};
window.copyB=function(t){ipcRenderer.invoke('copy-clip',t);};
window.addN=function(){const i=document.getElementById('nI');if(i&&i.value.trim()){notes.unshift(i.value.trim());localStorage.setItem('island_notes',JSON.stringify(notes));render();}};
window.delN=function(idx){notes.splice(idx,1);localStorage.setItem('island_notes',JSON.stringify(notes));render();};
window.togT=function(){if(tRun){clearInterval(tInt);tRun=false;}else{tRun=true;tInt=setInterval(()=>{if(tTime>0){tTime--;render();}else{clearInterval(tInt);tRun=false;alert('Таймер завершён!');}},1000);}render();};
window.resT=function(){clearInterval(tInt);tRun=false;tTime=0;render();};
window.setT=function(m){tTime=m*60;render();};
window.setA=function(col,el){document.documentElement.style.setProperty('--accent',col);localStorage.setItem('island_accent',col);document.querySelectorAll('.co').forEach(e=>e.classList.remove('active'));el.classList.add('active');const n=document.getElementById('cCN');if(n)n.textContent=cN(col);};
window.chCity=async function(){const inp=document.getElementById('cIn');if(inp&&inp.value.trim()){try{const r=await ipcRenderer.invoke('geocode-city',inp.value.trim());sCity=r.name;sCoords={lat:r.lat,lon:r.lon};localStorage.setItem('island_city',sCity);localStorage.setItem('island_coords',JSON.stringify(sCoords));wData=null;render();}catch(e){alert('Город не найден');}}};
function cN(h){const c=colors.find(p=>p.v.toLowerCase()===h.toLowerCase());return c?c.n:h;}
function wD(c){const d={0:'Ясно',1:'Преим. ясно',2:'Облачно',3:'Пасмурно',45:'Туман',51:'Морось',61:'Дождь',71:'Снег',80:'Ливень',95:'Гроза'};return d[c]||'Неизвестно';}
function wIc(c){if(c===0)return'☀️';if(c<=3)return'⛅';if(c<=48)return'🌫️';if(c<=67)return'🌧️';if(c<=77)return'🌨️';if(c>=95)return'⛈️';return'🌥️';}
async function loadW(){try{wData=await ipcRenderer.invoke('get-weather',sCoords.lat,sCoords.lon);const cu=wData.current_weather;document.getElementById('wI').textContent=wIc(cu.weathercode);document.getElementById('wT').textContent=Math.round(cu.temperature)+'°';if(curTab==='home')render();}catch(e){console.error(e);}}
ipcRenderer.invoke('get-clip').then(h=>{clipHist=h;if(curTab==='clipboard')render();});
ipcRenderer.on('clip-update',(e,h)=>{clipHist=h;if(curTab==='clipboard')render();});
loadW();setInterval(loadW,10*60*1000);
const sa=localStorage.getItem('island_accent');if(sa)document.documentElement.style.setProperty('--accent',sa);
window.switchTab=function(n){const t=document.querySelector('.tab[data-tab="'+n+'"]');if(t)t.click();};
render();
</script>
</body>
</html>`;
fs.writeFileSync('index.html', htmlCode);

console.log('✅ Все файлы созданы для версии 1.0.0!');
console.log('Теперь выполни:');
console.log('  npm install');
console.log('  npm run build:win');