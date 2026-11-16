const fs = require('fs');

const htmlCode = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --bg: #000000; --surface: #1c1c1e; --text: #ffffff; --accent: #ffffff; --border: rgba(255,255,255,0.1); }
  :root.light-theme { --bg: #ffffff; --surface: #f2f2f7; --text: #000000; }
  body { background: transparent; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; padding-top: 10px; user-select: none; overflow: hidden; }
  
  .island { width: 180px; height: 36px; background: var(--bg); border-radius: 18px; position: relative; cursor: pointer; transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 1px solid var(--border); }
  .island:hover { width: 850px; height: 480px; border-radius: 24px; }
  
  .compact-view { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; gap: 12px; color: var(--text); font-size: 14px; font-weight: 500; transition: opacity 0.3s; }
  .island:hover .compact-view { opacity: 0; pointer-events: none; }
  
  .expanded-view { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; pointer-events: none; transition: opacity 0.3s; display: flex; flex-direction: column; background: var(--bg); }
  .island:hover .expanded-view { opacity: 1; pointer-events: auto; }
  
  .tabs { display: flex; gap: 4px; padding: 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .tab { padding: 8px 16px; background: var(--surface); border-radius: 12px; font-size: 13px; color: #8e8e93; cursor: pointer; transition: all 0.2s; border: none; outline: none; }
  .tab:hover { background: #2c2c2e; color: white; }
  .tab.active { background: var(--accent); color: #000; }
  
  .content { flex: 1; padding: 16px; overflow-y: auto; color: var(--text); }
  .content::-webkit-scrollbar { width: 6px; }
  .content::-webkit-scrollbar-thumb { background: #2c2c2e; border-radius: 3px; }
  
  .player { display: flex; gap: 20px; align-items: center; padding: 20px; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border-radius: 20px; margin-bottom: 20px; }
  .player-cover { width: 120px; height: 120px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 48px; flex-shrink: 0; }
  .player-info { flex: 1; }
  .player-title { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
  .player-artist { font-size: 14px; color: #8e8e93; margin-bottom: 16px; }
  .player-progress { width: 100%; height: 4px; background: var(--surface); border-radius: 2px; margin-bottom: 12px; overflow: hidden; }
  .player-progress-bar { height: 100%; background: var(--accent); width: 35%; border-radius: 2px; }
  .player-controls { display: flex; gap: 16px; align-items: center; }
  .player-btn { background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 8px; border-radius: 50%; transition: background 0.2s; }
  .player-btn:hover { background: rgba(255,255,255,0.1); }
  .player-btn.play { font-size: 28px; }
  
  .weather-main { display: flex; gap: 20px; margin-bottom: 20px; padding: 20px; background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); border-radius: 20px; }
  .weather-temp { font-size: 64px; font-weight: 300; line-height: 1; }
  .weather-desc { font-size: 18px; margin-top: 8px; }
  .weather-details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .weather-detail-card { padding: 16px; background: var(--surface); border-radius: 16px; text-align: center; }
  .weather-detail-label { font-size: 11px; color: #8e8e93; text-transform: uppercase; margin-bottom: 8px; }
  .weather-detail-value { font-size: 20px; font-weight: 600; }
  
  .note-input { width: 100%; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; color: white; font-size: 14px; outline: none; resize: none; font-family: inherit; margin-bottom: 12px; }
  .note-input:focus { border-color: var(--accent); }
  .note-list { display: flex; flex-direction: column; gap: 8px; }
  .note-item { padding: 12px; background: var(--surface); border-radius: 12px; display: flex; justify-content: space-between; align-items: start; }
  .note-delete { background: none; border: none; color: #ff453a; cursor: pointer; font-size: 18px; padding: 4px 8px; }
  
  .timer-display { font-size: 72px; font-weight: 200; text-align: center; margin: 40px 0; font-variant-numeric: tabular-nums; }
  .timer-controls { display: flex; gap: 12px; justify-content: center; }
  .timer-btn { padding: 12px 32px; background: var(--accent); border: none; border-radius: 12px; color: #000; font-size: 16px; font-weight: 600; cursor: pointer; }
  .timer-btn.secondary { background: var(--surface); color: white; }
  
  .settings-section { margin-bottom: 24px; }
  .settings-title { font-size: 13px; color: #8e8e93; text-transform: uppercase; margin-bottom: 12px; font-weight: 600; }
  .color-picker { display: flex; gap: 12px; flex-wrap: wrap; }
  .color-option { width: 48px; height: 48px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; transition: all 0.2s; position: relative; }
  .color-option:hover { transform: scale(1.15); }
  .color-option.active { border-color: #000; box-shadow: 0 0 0 2px #fff, 0 0 0 4px #000; }
  .color-option.active::after { content: '✓'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #000; font-weight: bold; font-size: 20px; }
  .color-option[data-color="#ffffff"].active::after { color: #fff; text-shadow: 0 0 4px #000; }
</style>
</head>
<body>
<div class="island">
  <div class="compact-view">
    <div id="compactTime">00:00</div>
    <div id="compactWeather"><span id="wIcon">☀️</span> <span id="wTemp">--°</span></div>
  </div>
  
  <div class="expanded-view">
    <div class="tabs">
      <button class="tab active" data-tab="home">🏠 Главная</button>
      <button class="tab" data-tab="weather">🌤️ Погода</button>
      <button class="tab" data-tab="notes">📝 Заметки</button>
      <button class="tab" data-tab="timer">⏱️ Таймер</button>
      <button class="tab" data-tab="settings">⚙️ Настройки</button>
    </div>
    <div class="content" id="content"></div>
  </div>
</div>

<script>
const { ipcRenderer } = require('electron');
let currentTab = 'home';
let notes = JSON.parse(localStorage.getItem('island_notes') || '[]');
let timerTime = 0, timerInterval = null, timerRunning = false;
let weatherData = null;
let savedCity = localStorage.getItem('island_city') || 'Москва';
let savedCoords = JSON.parse(localStorage.getItem('island_coords') || '{"lat":55.7558,"lon":37.6173}');

const colors = [
  {name: 'Белый', value: '#ffffff'},
  {name: 'Синий', value: '#0a84ff'},
  {name: 'Зеленый', value: '#30d158'},
  {name: 'Оранжевый', value: '#ff9f0a'},
  {name: 'Красный', value: '#ff453a'},
  {name: 'Фиолетовый', value: '#bf5af2'},
  {name: 'Розовый', value: '#ff375f'},
  {name: 'Бирюзовый', value: '#64d2ff'},
  {name: 'Желтый', value: '#ffd60a'},
  {name: 'Индиго', value: '#5e5ce6'},
  {name: 'Мятный', value: '#30d158'},
  {name: 'Коралловый', value: '#ff6961'}
];

function updateClock() {
  const now = new Date();
  document.getElementById('compactTime').textContent = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
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
    c.innerHTML = '<div class="player"><div class="player-cover">🎵</div><div class="player-info"><div class="player-title">On & On</div><div class="player-artist">Cartoon feat. Daniel Levi</div><div class="player-progress"><div class="player-progress-bar"></div></div><div class="player-controls"><button class="player-btn">⏮</button><button class="player-btn play">▶</button><button class="player-btn">⏭</button></div></div></div><div style="text-align:center;color:#8e8e93;margin-top:40px;font-size:14px;">Интеграция с музыкальными плеерами недоступна в базовой версии Electron.</div>';
  }
  else if (currentTab === 'weather') {
    if (!weatherData) { c.innerHTML = '<div style="text-align:center;padding:60px;color:#8e8e93">Загрузка погоды...</div>'; loadWeather(); return; }
    const cur = weatherData.current_weather;
    const hourly = weatherData.hourly;
    const daily = weatherData.daily;
    const nowH = new Date().getHours();
    c.innerHTML = '<div class="weather-main"><div><div class="weather-temp">'+Math.round(cur.temperature)+'°</div><div class="weather-desc">'+getWDesc(cur.weathercode)+'</div><div style="margin-top:8px;font-size:14px">'+savedCity+'</div></div></div><div class="weather-details"><div class="weather-detail-card"><div class="weather-detail-label">Ветер</div><div class="weather-detail-value">'+cur.windspeed+' м/с</div></div><div class="weather-detail-card"><div class="weather-detail-label">Влажность</div><div class="weather-detail-value">'+hourly.relative_humidity_2m[nowH]+'%</div></div><div class="weather-detail-card"><div class="weather-detail-label">Давление</div><div class="weather-detail-value">'+Math.round(hourly.pressure_msl[nowH])+' гПа</div></div><div class="weather-detail-card"><div class="weather-detail-label">UV индекс</div><div class="weather-detail-value">'+daily.uv_index_max[0]+'</div></div><div class="weather-detail-card"><div class="weather-detail-label">Восход</div><div class="weather-detail-value">'+daily.sunrise[0].split("T")[1]+'</div></div><div class="weather-detail-card"><div class="weather-detail-label">Закат</div><div class="weather-detail-value">'+daily.sunset[0].split("T")[1]+'</div></div></div>';
  }
  else if (currentTab === 'notes') {
    c.innerHTML = '<textarea class="note-input" id="nInp" placeholder="Новая заметка..." rows="3"></textarea><button class="timer-btn" onclick="addNote()" style="width:100%;margin-bottom:12px">Добавить</button><div class="note-list">'+(notes.length===0?'<div style="text-align:center;padding:40px;color:#8e8e93">Нет заметок</div>':notes.map((n,i)=>'<div class="note-item"><div>'+n+'</div><button class="note-delete" onclick="delNote('+i+')">✕</button></div>').join(''))+'</div>';
  }
  else if (currentTab === 'timer') {
    const m=Math.floor(timerTime/60), s=timerTime%60;
    const ts=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    c.innerHTML = '<div class="timer-display">'+ts+'</div><div class="timer-controls"><button class="timer-btn" onclick="toggleTimer()">'+(timerRunning?'Пауза':'Старт')+'</button><button class="timer-btn secondary" onclick="resetTimer()">Сброс</button></div><div style="display:flex;gap:8px;justify-content:center;margin-top:24px"><button class="timer-btn secondary" onclick="setTimer(5)">5 мин</button><button class="timer-btn secondary" onclick="setTimer(15)">15 мин</button><button class="timer-btn secondary" onclick="setTimer(25)">25 мин</button></div>';
  }
  else if (currentTab === 'settings') {
    const ca = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    c.innerHTML = '<div class="settings-section"><div class="settings-title">Цвет акцента (12 цветов)</div><div class="color-picker">'+colors.map(col=>'<div class="color-option '+(col.value.toLowerCase()===ca.toLowerCase()?'active':'')+'" style="background:'+col.value+'" data-color="'+col.value+'" title="'+col.name+'" onclick="setAccent(\\''+col.value+'\\',this)"></div>').join('')+'</div><div style="margin-top:12px;font-size:12px;color:#8e8e93">Выбрано: <span id="currentColorName" style="color:var(--accent);font-weight:600">'+getColorName(ca)+'</span></div></div><div class="settings-section"><div class="settings-title">Город</div><input type="text" class="note-input" id="cityInp" value="'+savedCity+'" placeholder="Введите город"><button class="timer-btn" onclick="changeCity()" style="width:100%">Сохранить</button></div>';
  }
}

window.addNote = function() { const i=document.getElementById('nInp'); if(i&&i.value.trim()){notes.unshift(i.value.trim());localStorage.setItem('island_notes',JSON.stringify(notes));renderContent();} };
window.delNote = function(idx) { notes.splice(idx,1);localStorage.setItem('island_notes',JSON.stringify(notes));renderContent(); };
window.toggleTimer = function() { if(timerRunning){clearInterval(timerInterval);timerRunning=false;}else{timerRunning=true;timerInterval=setInterval(()=>{if(timerTime>0){timerTime--;renderContent();}else{clearInterval(timerInterval);timerRunning=false;alert('Таймер завершён!');}},1000);} renderContent(); };
window.resetTimer = function() { clearInterval(timerInterval);timerRunning=false;timerTime=0;renderContent(); };
window.setTimer = function(min) { timerTime=min*60;renderContent(); };

window.setAccent = function(color, el) {
  document.documentElement.style.setProperty('--accent', color);
  localStorage.setItem('island_accent', color);
  document.querySelectorAll('.color-option').forEach(e=>e.classList.remove('active'));
  el.classList.add('active');
  const nameEl = document.getElementById('currentColorName');
  if(nameEl) nameEl.textContent = getColorName(color);
};

window.changeCity = async function() { const inp=document.getElementById('cityInp'); if(inp&&inp.value.trim()){ try{const r=await ipcRenderer.invoke('geocode-city',inp.value.trim());savedCity=r.name;savedCoords={lat:r.lat,lon:r.lon};localStorage.setItem('island_city',savedCity);localStorage.setItem('island_coords',JSON.stringify(savedCoords));weatherData=null;renderContent();}catch(e){alert('Город не найден');} } };

function getColorName(hex) {
  const col = colors.find(c => c.value.toLowerCase() === hex.toLowerCase());
  return col ? col.name : hex;
}

function getWDesc(c) { const d={0:'Ясно',1:'Преим. ясно',2:'Облачно',3:'Пасмурно',45:'Туман',51:'Морось',61:'Дождь',71:'Снег',80:'Ливень',95:'Гроза'}; return d[c]||'Неизвестно'; }

async function loadWeather() { try{weatherData=await ipcRenderer.invoke('get-weather',savedCoords.lat,savedCoords.lon);const cur=weatherData.current_weather;document.getElementById('wIcon').textContent=cur.weathercode===0?'☀️':'☁️';document.getElementById('wTemp').textContent=Math.round(cur.temperature)+'°';renderContent();}catch(e){console.error(e);} }

loadWeather();
setInterval(loadWeather, 10*60*1000);

const sa = localStorage.getItem('island_accent');
if(sa) {
  document.documentElement.style.setProperty('--accent', sa);
} else {
  document.documentElement.style.setProperty('--accent', '#ffffff');
}

renderContent();
</script>
</body>
</html>`;

fs.writeFileSync('index.html', htmlCode);
console.log('✅ Добавлено 12 цветов включая белый!');
console.log('Теперь выполни: npm start');