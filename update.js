const fs = require('fs');

// Читаем существующий main.js, чтобы не трогать его
let mainJs = '';
try { mainJs = fs.readFileSync('main.js', 'utf8'); } catch(e) {}

// Если main.js пустой или битый, создаем базовый с поддержкой буфера и музыки
if (!mainJs.includes('clipboard') || !mainJs.includes('get-weather')) {
  mainJs = `const { app, BrowserWindow, screen, ipcMain, globalShortcut, clipboard } = require('electron');
const https = require('https'); const path = require('path');
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
        if (win && !win.isDestroyed()) win.webContents.send('clipboard-update', clipboardHistory);
      }
    } catch(e) {}
  }, 800);
  ipcMain.handle('get-clipboard', () => clipboardHistory);
  ipcMain.handle('copy-to-clipboard', (e, text) => { clipboard.writeText(text); return true; });
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
}
fs.writeFileSync('main.js', mainJs);

// Обновляем index.html с новыми вкладками
const htmlCode = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --bg: #000000; --surface: #1c1c1e; --surface2: #2c2c2e; --text: #ffffff; --text2: #8e8e93; --accent: #0a84ff; --border: rgba(255,255,255,0.1); }
  body { background: transparent; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; padding-top: 10px; user-select: none; overflow: hidden; }
  .island { width: 180px; height: 36px; background: var(--bg); border-radius: 18px; position: relative; cursor: pointer; transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 1px solid var(--border); }
  .island:hover { width: 850px; height: 500px; border-radius: 24px; }
  .compact-view { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; gap: 12px; color: var(--text); font-size: 14px; font-weight: 500; transition: opacity 0.3s; }
  .island:hover .compact-view { opacity: 0; pointer-events: none; }
  .expanded-view { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; pointer-events: none; transition: opacity 0.3s; display: flex; flex-direction: column; background: var(--bg); }
  .island:hover .expanded-view { opacity: 1; pointer-events: auto; }
  .tabs { display: flex; gap: 4px; padding: 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; flex-wrap: wrap; }
  .tab { padding: 8px 14px; background: var(--surface); border-radius: 12px; font-size: 13px; color: var(--text2); cursor: pointer; transition: all 0.2s; border: none; outline: none; }
  .tab:hover { background: var(--surface2); color: var(--text); }
  .tab.active { background: var(--accent); color: white; }
  .content { flex: 1; padding: 16px; overflow-y: auto; color: var(--text); }
  .content::-webkit-scrollbar { width: 6px; }
  .content::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 3px; }
  .player-box { padding: 20px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 20px; display: flex; gap: 20px; align-items: center; margin-bottom: 16px; }
  .album-art { width: 100px; height: 100px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 40px; flex-shrink: 0; }
  .track-info { flex: 1; min-width: 0; }
  .track-name { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
  .track-artist { font-size: 13px; color: var(--text2); margin-bottom: 12px; }
  .progress-bar { width: 100%; height: 4px; background: var(--surface2); border-radius: 2px; margin-bottom: 12px; overflow: hidden; }
  .progress-fill { height: 100%; background: var(--accent); width: 35%; border-radius: 2px; }
  .controls { display: flex; gap: 12px; align-items: center; justify-content: center; }
  .ctrl-btn { background: none; border: none; color: var(--text); font-size: 20px; cursor: pointer; padding: 8px; border-radius: 50%; transition: background 0.2s; }
  .ctrl-btn:hover { background: rgba(255,255,255,0.1); }
  .ctrl-btn.play { font-size: 28px; }
  .upload-area { padding: 24px; background: var(--surface); border-radius: 16px; text-align: center; cursor: pointer; border: 2px dashed var(--border); margin-bottom: 16px; }
  .upload-area:hover { background: var(--surface2); border-color: var(--accent); }
  .upload-area input { display: none; }
  .clip-item { padding: 12px; background: var(--surface); border-radius: 12px; margin-bottom: 8px; cursor: pointer; transition: background 0.2s; }
  .clip-item:hover { background: var(--surface2); }
  .clip-text { font-size: 14px; margin-bottom: 4px; word-break: break-word; }
  .clip-time { font-size: 11px; color: var(--text2); }
  .weather-main { display: flex; gap: 20px; margin-bottom: 20px; padding: 20px; background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); border-radius: 20px; }
  .weather-temp { font-size: 64px; font-weight: 300; line-height: 1; }
  .weather-desc { font-size: 18px; margin-top: 8px; }
  .weather-details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .weather-detail-card { padding: 16px; background: var(--surface); border-radius: 16px; text-align: center; }
  .weather-detail-label { font-size: 11px; color: var(--text2); text-transform: uppercase; margin-bottom: 8px; }
  .weather-detail-value { font-size: 20px; font-weight: 600; }
  .note-input { width: 100%; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; color: var(--text); font-size: 14px; outline: none; resize: none; font-family: inherit; margin-bottom: 12px; }
  .note-input:focus { border-color: var(--accent); }
  .note-list { display: flex; flex-direction: column; gap: 8px; }
  .note-item { padding: 12px; background: var(--surface); border-radius: 12px; display: flex; justify-content: space-between; align-items: start; }
  .note-delete { background: none; border: none; color: #ff453a; cursor: pointer; font-size: 18px; padding: 4px 8px; }
  .timer-display { font-size: 72px; font-weight: 200; text-align: center; margin: 40px 0; font-variant-numeric: tabular-nums; }
  .timer-controls { display: flex; gap: 12px; justify-content: center; }
  .timer-btn { padding: 12px 32px; background: var(--accent); border: none; border-radius: 12px; color: white; font-size: 16px; font-weight: 600; cursor: pointer; }
  .timer-btn.secondary { background: var(--surface); color: white; }
</style>
</head>
<body>
<div class="island">
  <div class="compact-view"><div id="compactTime">00:00</div><div id="compactWeather"><span id="wIcon">☀️</span> <span id="wTemp">--°</span></div></div>
  <div class="expanded-view">
    <div class="tabs">
      <button class="tab active" data-tab="home">🏠 Главная</button>
      <button class="tab" data-tab="music">🎵 Музыка</button>
      <button class="tab" data-tab="weather">🌤️ Погода</button>
      <button class="tab" data-tab="clipboard">📋 Буфер</button>
      <button class="tab" data-tab="notes">📝 Заметки</button>
      <button class="tab" data-tab="timer">⏱️ Таймер</button>
    </div>
    <div class="content" id="content"></div>
  </div>
</div>
<script>
const { ipcRenderer } = require('electron');
let currentTab = 'home', notes = JSON.parse(localStorage.getItem('island_notes') || '[]'), clipboardHistory = [];
let timerTime = 0, timerInterval = null, timerRunning = false;
let weatherData = null, savedCity = localStorage.getItem('island_city') || 'Москва';
let savedCoords = JSON.parse(localStorage.getItem('island_coords') || '{"lat":55.7558,"lon":37.6173}');

function updateClock() { document.getElementById('compactTime').textContent = new Date().toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'}); }
updateClock(); setInterval(updateClock, 1000);

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    renderContent();
  });
});

function renderContent() {
  const c = document.getElementById('content');
  if (currentTab === 'home') {
    c.innerHTML = '<div class="player-box"><div class="album-art">🎵</div><div class="track-info"><div class="track-name">On & On</div><div class="track-artist">Cartoon feat. Daniel Levi</div><div class="progress-bar"><div class="progress-fill"></div></div><div class="controls"><button class="ctrl-btn">⏮</button><button class="ctrl-btn play">▶</button><button class="ctrl-btn">⏭</button></div></div></div><div style="text-align:center;color:var(--text2);margin-top:40px">Добро пожаловать в Ynater!</div>';
  } else if (currentTab === 'music') {
    c.innerHTML = '<div class="upload-area" onclick="document.getElementById(\\'fileInput\\').click()"><input type="file" id="fileInput" accept="audio/*" onchange="playMusic(this)"><div style="font-size:40px;margin-bottom:12px">📁</div><div style="font-size:16px;font-weight:600">Нажмите, чтобы выбрать MP3</div><div style="font-size:13px;color:var(--text2);margin-top:8px">Локальное воспроизведение</div></div><div id="musicPlayer"></div>';
  } else if (currentTab === 'weather') {
    if (!weatherData) { c.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text2)">Загрузка погоды...</div>'; loadWeather(); return; }
    const cur = weatherData.current_weather, hourly = weatherData.hourly, daily = weatherData.daily, nowH = new Date().getHours();
    c.innerHTML = '<div class="weather-main"><div><div class="weather-temp">'+Math.round(cur.temperature)+'°</div><div class="weather-desc">'+getWDesc(cur.weathercode)+'</div><div style="margin-top:8px;font-size:14px">'+savedCity+'</div></div></div><div class="weather-details"><div class="weather-detail-card"><div class="weather-detail-label">Ветер</div><div class="weather-detail-value">'+cur.windspeed+' м/с</div></div><div class="weather-detail-card"><div class="weather-detail-label">Влажность</div><div class="weather-detail-value">'+hourly.relative_humidity_2m[nowH]+'%</div></div><div class="weather-detail-card"><div class="weather-detail-label">Давление</div><div class="weather-detail-value">'+Math.round(hourly.pressure_msl[nowH])+' гПа</div></div><div class="weather-detail-card"><div class="weather-detail-label">UV индекс</div><div class="weather-detail-value">'+daily.uv_index_max[0]+'</div></div><div class="weather-detail-card"><div class="weather-detail-label">Восход</div><div class="weather-detail-value">'+daily.sunrise[0].split("T")[1]+'</div></div><div class="weather-detail-card"><div class="weather-detail-label">Закат</div><div class="weather-detail-value">'+daily.sunset[0].split("T")[1]+'</div></div></div>';
  } else if (currentTab === 'clipboard') {
    if (clipboardHistory.length === 0) { c.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text2)">Буфер обмена пуст</div>'; }
    else { c.innerHTML = '<div>'+clipboardHistory.map((item, i) => '<div class="clip-item" onclick="copyBack(\\''+item.text.replace(/'/g, "\\'")+'\\')"><div class="clip-text">'+item.text+'</div><div class="clip-time">'+item.time+'</div></div>').join('')+'</div>'; }
  } else if (currentTab === 'notes') {
    c.innerHTML = '<textarea class="note-input" id="nInp" placeholder="Новая заметка..." rows="3"></textarea><button class="timer-btn" onclick="addNote()" style="width:100%;margin-bottom:12px;background:var(--accent);border:none;border-radius:12px;color:white;padding:12px;cursor:pointer;font-size:16px">Добавить</button><div class="note-list">'+(notes.length===0?'<div style="text-align:center;padding:40px;color:var(--text2)">Нет заметок</div>':notes.map((n,i)=>'<div class="note-item"><div>'+n+'</div><button class="note-delete" onclick="delNote('+i+')">✕</button></div>').join(''))+'</div>';
  } else if (currentTab === 'timer') {
    const m=Math.floor(timerTime/60), s=timerTime%60;
    const ts=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    c.innerHTML = '<div class="timer-display">'+ts+'</div><div class="timer-controls"><button class="timer-btn" onclick="toggleTimer()">'+(timerRunning?'Пауза':'Старт')+'</button><button class="timer-btn secondary" onclick="resetTimer()">Сброс</button></div><div style="display:flex;gap:8px;justify-content:center;margin-top:24px"><button class="timer-btn secondary" onclick="setTimer(5)">5 мин</button><button class="timer-btn secondary" onclick="setTimer(15)">15 мин</button><button class="timer-btn secondary" onclick="setTimer(25)">25 мин</button></div>';
  }
}

window.playMusic = function(input) {
  const file = input.files[0]; if (!file) return;
  const url = URL.createObjectURL(file);
  document.getElementById('musicPlayer').innerHTML = '<audio controls autoplay style="width:100%;margin-top:16px;border-radius:12px" src="'+url+'"></audio><div style="text-align:center;margin-top:12px;font-weight:600">'+file.name+'</div>';
};
window.copyBack = function(text) { ipcRenderer.invoke('copy-to-clipboard', text); };
window.addNote = function() { const i=document.getElementById('nInp'); if(i&&i.value.trim()){notes.unshift(i.value.trim());localStorage.setItem('island_notes',JSON.stringify(notes));renderContent();} };
window.delNote = function(idx) { notes.splice(idx,1);localStorage.setItem('island_notes',JSON.stringify(notes));renderContent(); };
window.toggleTimer = function() { if(timerRunning){clearInterval(timerInterval);timerRunning=false;}else{timerRunning=true;timerInterval=setInterval(()=>{if(timerTime>0){timerTime--;renderContent();}else{clearInterval(timerInterval);timerRunning=false;alert('Таймер завершён!');}},1000);} renderContent(); };
window.resetTimer = function() { clearInterval(timerInterval);timerRunning=false;timerTime=0;renderContent(); };
window.setTimer = function(min) { timerTime=min*60;renderContent(); };

function getWDesc(c) { const d={0:'Ясно',1:'Преим. ясно',2:'Облачно',3:'Пасмурно',45:'Туман',51:'Морось',61:'Дождь',71:'Снег',80:'Ливень',95:'Гроза'}; return d[c]||'Неизвестно'; }

async function loadWeather() {
  try {
    weatherData = await ipcRenderer.invoke('get-weather', savedCoords.lat, savedCoords.lon);
    const cur = weatherData.current_weather;
    document.getElementById('wIcon').textContent = cur.weathercode===0?'☀️':'☁️';
    document.getElementById('wTemp').textContent = Math.round(cur.temperature)+'°';
    renderContent();
  } catch(e) { console.error(e); }
}

ipcRenderer.invoke('get-clipboard').then(history => { clipboardHistory = history; if(currentTab==='clipboard') renderContent(); });
ipcRenderer.on('clipboard-update', (event, history) => { clipboardHistory = history; if(currentTab==='clipboard') renderContent(); });

loadWeather(); setInterval(loadWeather, 10*60*1000);
renderContent();
</script>
</body>
</html>`;

fs.writeFileSync('index.html', htmlCode);
console.log('✅ Добавлены вкладки Музыка и Буфер обмена!');
console.log('Теперь выполни: npm start');