const fs = require('fs');

// Читаем текущий index.html чтобы не сломать другие вкладки
let currentHtml = '';
try { currentHtml = fs.readFileSync('index.html', 'utf8'); } catch(e) {}

// Если файл битый (нет HTML-тегов), создаем полный
if (!currentHtml.includes('<!DOCTYPE html>') || !currentHtml.includes('<div class="island">')) {
  console.log('⚠️ index.html сломан, создаем полный с нуля...');
  
  const fullHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --bg: #000000; --surface: #1c1c1e; --surface2: #2c2c2e; --text: #ffffff; --text2: #8e8e93; --accent: #ffffff; --border: rgba(255,255,255,0.1); }
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
  .tab.active { background: var(--accent); color: #000; }
  .content { flex: 1; padding: 16px; overflow-y: auto; color: var(--text); }
  .content::-webkit-scrollbar { width: 6px; }
  .content::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 3px; }
  
  /* Главная - Dashboard */
  .dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .dash-card { background: var(--surface); border-radius: 16px; padding: 16px; }
  .dash-card.full { grid-column: 1 / -1; }
  .dash-title { font-size: 11px; color: var(--text2); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: 600; }
  
  .greeting { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
  .greeting-sub { font-size: 13px; color: var(--text2); }
  
  .quick-timers { display: flex; gap: 8px; flex-wrap: wrap; }
  .quick-timer-btn { flex: 1; min-width: 80px; padding: 12px; background: var(--surface2); border: none; border-radius: 12px; color: var(--text); cursor: pointer; transition: all 0.2s; font-size: 13px; font-weight: 600; }
  .quick-timer-btn:hover { background: var(--accent); color: #000; transform: scale(1.05); }
  .quick-timer-btn .time { font-size: 18px; display: block; margin-bottom: 2px; }
  .quick-timer-btn .label { font-size: 10px; color: var(--text2); }
  .quick-timer-btn:hover .label { color: #000; }
  
  .recent-notes { display: flex; flex-direction: column; gap: 6px; }
  .recent-note { padding: 10px; background: var(--surface2); border-radius: 10px; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .recent-note.empty { color: var(--text2); font-style: italic; text-align: center; padding: 20px; }
  
  .weather-forecast { display: flex; justify-content: space-between; gap: 8px; }
  .forecast-item { flex: 1; text-align: center; padding: 8px; background: var(--surface2); border-radius: 10px; }
  .forecast-time { font-size: 11px; color: var(--text2); margin-bottom: 4px; }
  .forecast-icon { font-size: 20px; margin-bottom: 4px; }
  .forecast-temp { font-size: 13px; font-weight: 600; }
  
  .quote-box { font-size: 14px; font-style: italic; color: var(--text2); text-align: center; padding: 12px; line-height: 1.5; }
  .quote-author { font-size: 11px; margin-top: 8px; font-style: normal; font-weight: 600; color: var(--accent); }
  
  /* Остальные стили вкладок */
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
  .timer-btn { padding: 12px 32px; background: var(--accent); border: none; border-radius: 12px; color: #000; font-size: 16px; font-weight: 600; cursor: pointer; }
  .timer-btn.secondary { background: var(--surface); color: white; }
  .settings-section { margin-bottom: 24px; }
  .settings-title { font-size: 13px; color: var(--text2); text-transform: uppercase; margin-bottom: 12px; font-weight: 600; }
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
  <div class="compact-view"><div id="compactTime">00:00</div><div id="compactWeather"><span id="wIcon">☀️</span> <span id="wTemp">--°</span></div></div>
  <div class="expanded-view">
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
let currentTab = 'home', notes = JSON.parse(localStorage.getItem('island_notes') || '[]'), clipboardHistory = [];
let timerTime = 0, timerInterval = null, timerRunning = false;
let weatherData = null, savedCity = localStorage.getItem('island_city') || 'Москва';
let savedCoords = JSON.parse(localStorage.getItem('island_coords') || '{"lat":55.7558,"lon":37.6173}');

const colors = [
  {name:'Белый',value:'#ffffff'},{name:'Синий',value:'#0a84ff'},{name:'Зеленый',value:'#30d158'},
  {name:'Оранжевый',value:'#ff9f0a'},{name:'Красный',value:'#ff453a'},{name:'Фиолетовый',value:'#bf5af2'},
  {name:'Розовый',value:'#ff375f'},{name:'Бирюзовый',value:'#64d2ff'},{name:'Желтый',value:'#ffd60a'},
  {name:'Индиго',value:'#5e5ce6'},{name:'Мятный',value:'#32d74b'},{name:'Коралловый',value:'#ff6961'}
];

const quotes = [
  {text:'Каждый день — новый шанс стать лучше.', author:'Неизвестно'},
  {text:'Успех — это сумма маленьких усилий, повторяющихся изо дня в день.', author:'Роберт Кольер'},
  {text:'Не бойся медлить, бойся остановиться.', author:'Китайская пословица'},
  {text:'Ты сильнее, чем думаешь.', author:'Неизвестно'},
  {text:'Дисциплина — мост между целями и достижениями.', author:'Джим Рон'},
  {text:'Сегодняшний день — твой лучший инструмент.', author:'Неизвестно'},
  {text:'Маленькие шаги ведут к большим результатам.', author:'Неизвестно'},
  {text:'Верь в себя, и всё получится.', author:'Неизвестно'}
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return {text:'Доброе утро', icon:'☀️'};
  if (hour >= 12 && hour < 18) return {text:'Добрый день', icon:'🌤️'};
  if (hour >= 18 && hour < 23) return {text:'Добрый вечер', icon:'🌙'};
  return {text:'Доброй ночи', icon:'✨'};
}

function getTodayQuote() {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return quotes[dayOfYear % quotes.length];
}

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
    const greeting = getGreeting();
    const quote = getTodayQuote();
    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'});
    const recentNotes = notes.slice(0, 3);
    
    let forecastHtml = '';
    if (weatherData && weatherData.hourly) {
      const currentHour = now.getHours();
      const hours = [currentHour, currentHour+3, currentHour+6, currentHour+9, currentHour+12].filter(h => h < 24);
      forecastHtml = hours.map(h => {
        const temp = Math.round(weatherData.hourly.temperature_2m[h]);
        const code = weatherData.hourly.weather_code ? weatherData.hourly.weather_code[h] : 0;
        const icon = getWIcon(code);
        return '<div class="forecast-item"><div class="forecast-time">'+h+':00</div><div class="forecast-icon">'+icon+'</div><div class="forecast-temp">'+temp+'°</div></div>';
      }).join('');
    } else {
      forecastHtml = '<div style="text-align:center;color:var(--text2);padding:20px;grid-column:1/-1">Загрузка прогноза...</div>';
    }
    
    c.innerHTML = '<div class="dashboard">'+
      '<div class="dash-card full"><div class="greeting">'+greeting.icon+' '+greeting.text+'</div><div class="greeting-sub">'+dateStr.charAt(0).toUpperCase()+dateStr.slice(1)+'</div></div>'+
      '<div class="dash-card"><div class="dash-title">⚡ Быстрые таймеры</div><div class="quick-timers"><button class="quick-timer-btn" onclick="quickTimer(5)"><span class="time">5</span><span class="label">минут</span></button><button class="quick-timer-btn" onclick="quickTimer(15)"><span class="time">15</span><span class="label">минут</span></button><button class="quick-timer-btn" onclick="quickTimer(25)"><span class="time">25</span><span class="label">минут</span></button></div></div>'+
      '<div class="dash-card"><div class="dash-title">📝 Последние заметки</div><div class="recent-notes">'+(recentNotes.length===0?'<div class="recent-note empty">Нет заметок</div>':recentNotes.map(n=>'<div class="recent-note">'+n+'</div>').join(''))+'</div></div>'+
      '<div class="dash-card full"><div class="dash-title">🌤️ Прогноз на день</div><div class="weather-forecast">'+forecastHtml+'</div></div>'+
      '<div class="dash-card full"><div class="quote-box">"'+quote.text+'"<div class="quote-author">— '+quote.author+'</div></div></div>'+
    '</div>';
  }
  else if (currentTab === 'music') {
    c.innerHTML = '<div class="upload-area" onclick="document.getElementById(\\'fileInput\\').click()"><input type="file" id="fileInput" accept="audio/*" onchange="playMusic(this)"><div style="font-size:40px;margin-bottom:12px">📁</div><div style="font-size:16px;font-weight:600">Нажмите, чтобы выбрать MP3</div><div style="font-size:13px;color:var(--text2);margin-top:8px">Локальное воспроизведение</div></div><div id="musicPlayer"></div>';
  }
  else if (currentTab === 'weather') {
    if (!weatherData) { c.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text2)">Загрузка погоды...</div>'; loadWeather(); return; }
    const cur = weatherData.current_weather, hourly = weatherData.hourly, daily = weatherData.daily, nowH = new Date().getHours();
    c.innerHTML = '<div class="weather-main"><div><div class="weather-temp">'+Math.round(cur.temperature)+'°</div><div class="weather-desc">'+getWDesc(cur.weathercode)+'</div><div style="margin-top:8px;font-size:14px">'+savedCity+'</div></div></div><div class="weather-details"><div class="weather-detail-card"><div class="weather-detail-label">Ветер</div><div class="weather-detail-value">'+cur.windspeed+' м/с</div></div><div class="weather-detail-card"><div class="weather-detail-label">Влажность</div><div class="weather-detail-value">'+hourly.relative_humidity_2m[nowH]+'%</div></div><div class="weather-detail-card"><div class="weather-detail-label">Давление</div><div class="weather-detail-value">'+Math.round(hourly.pressure_msl[nowH])+' гПа</div></div><div class="weather-detail-card"><div class="weather-detail-label">UV индекс</div><div class="weather-detail-value">'+daily.uv_index_max[0]+'</div></div><div class="weather-detail-card"><div class="weather-detail-label">Восход</div><div class="weather-detail-value">'+daily.sunrise[0].split("T")[1]+'</div></div><div class="weather-detail-card"><div class="weather-detail-label">Закат</div><div class="weather-detail-value">'+daily.sunset[0].split("T")[1]+'</div></div></div>';
  }
  else if (currentTab === 'clipboard') {
    if (clipboardHistory.length === 0) { c.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text2)">Буфер обмена пуст</div>'; }
    else { c.innerHTML = '<div>'+clipboardHistory.map((item, i) => '<div class="clip-item" onclick="copyBack(\\''+item.text.replace(/'/g, "\\'")+'\\')"><div class="clip-text">'+item.text+'</div><div class="clip-time">'+item.time+'</div></div>').join('')+'</div>'; }
  }
  else if (currentTab === 'notes') {
    c.innerHTML = '<textarea class="note-input" id="nInp" placeholder="Новая заметка..." rows="3"></textarea><button class="timer-btn" onclick="addNote()" style="width:100%;margin-bottom:12px">Добавить</button><div class="note-list">'+(notes.length===0?'<div style="text-align:center;padding:40px;color:var(--text2)">Нет заметок</div>':notes.map((n,i)=>'<div class="note-item"><div>'+n+'</div><button class="note-delete" onclick="delNote('+i+')">✕</button></div>').join(''))+'</div>';
  }
  else if (currentTab === 'timer') {
    const m=Math.floor(timerTime/60), s=timerTime%60;
    const ts=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    c.innerHTML = '<div class="timer-display">'+ts+'</div><div class="timer-controls"><button class="timer-btn" onclick="toggleTimer()">'+(timerRunning?'Пауза':'Старт')+'</button><button class="timer-btn secondary" onclick="resetTimer()">Сброс</button></div><div style="display:flex;gap:8px;justify-content:center;margin-top:24px"><button class="timer-btn secondary" onclick="setTimer(5)">5 мин</button><button class="timer-btn secondary" onclick="setTimer(15)">15 мин</button><button class="timer-btn secondary" onclick="setTimer(25)">25 мин</button></div>';
  }
  else if (currentTab === 'settings') {
    const ca = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    c.innerHTML = '<div class="settings-section"><div class="settings-title">🎨 Цвет акцента (12 цветов)</div><div class="color-picker">'+colors.map(col=>'<div class="color-option '+(col.value.toLowerCase()===ca.toLowerCase()?'active':'')+'" style="background:'+col.value+'" data-color="'+col.value+'" title="'+col.name+'" onclick="setAccent(\\''+col.value+'\\',this)"></div>').join('')+'</div><div style="margin-top:12px;font-size:12px;color:var(--text2)">Выбрано: <span id="currentColorName" style="color:var(--accent);font-weight:600">'+getColorName(ca)+'</span></div></div><div class="settings-section"><div class="settings-title">🌍 Город для погоды</div><input type="text" class="note-input" id="cityInp" value="'+savedCity+'" placeholder="Введите город"><button class="timer-btn" onclick="changeCity()" style="width:100%;margin-top:8px">Сохранить</button></div>';
  }
}

window.quickTimer = function(min) {
  timerTime = min * 60;
  timerRunning = false;
  clearInterval(timerInterval);
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.tab[data-tab="timer"]').classList.add('active');
  currentTab = 'timer';
  renderContent();
};

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
window.setAccent = function(color, el) {
  document.documentElement.style.setProperty('--accent', color);
  localStorage.setItem('island_accent', color);
  document.querySelectorAll('.color-option').forEach(e=>e.classList.remove('active'));
  el.classList.add('active');
  const n=document.getElementById('currentColorName'); if(n) n.textContent=getColorName(color);
};
window.changeCity = async function() {
  const inp=document.getElementById('cityInp'); if(inp&&inp.value.trim()){
    try{const r=await ipcRenderer.invoke('geocode-city',inp.value.trim());savedCity=r.name;savedCoords={lat:r.lat,lon:r.lon};localStorage.setItem('island_city',savedCity);localStorage.setItem('island_coords',JSON.stringify(savedCoords));weatherData=null;renderContent();}catch(e){alert('Город не найден');}
  }
};
function getColorName(h){const c=colors.find(p=>p.value.toLowerCase()===h.toLowerCase());return c?c.name:h;}
function getWDesc(c) { const d={0:'Ясно',1:'Преим. ясно',2:'Облачно',3:'Пасмурно',45:'Туман',51:'Морось',61:'Дождь',71:'Снег',80:'Ливень',95:'Гроза'}; return d[c]||'Неизвестно'; }
function getWIcon(c) { if(c===0)return '☀️'; if(c<=3)return '⛅'; if(c<=48)return '🌫️'; if(c<=67)return '🌧️'; if(c<=77)return '🌨️'; if(c>=95)return '⛈️'; return '🌥️'; }
async function loadWeather() {
  try { weatherData = await ipcRenderer.invoke('get-weather', savedCoords.lat, savedCoords.lon);
    const cur = weatherData.current_weather;
    document.getElementById('wIcon').textContent = getWIcon(cur.weathercode);
    document.getElementById('wTemp').textContent = Math.round(cur.temperature)+'°';
    if(currentTab==='home') renderContent();
  } catch(e) { console.error(e); }
}
ipcRenderer.invoke('get-clipboard').then(history => { clipboardHistory = history; if(currentTab==='clipboard') renderContent(); });
ipcRenderer.on('clipboard-update', (event, history) => { clipboardHistory = history; if(currentTab==='clipboard') renderContent(); });
loadWeather(); setInterval(loadWeather, 10*60*1000);
const sa = localStorage.getItem('island_accent'); if(sa) document.documentElement.style.setProperty('--accent', sa);
window.switchTab = function(name) { const t = document.querySelector('.tab[data-tab="'+name+'"]'); if(t) t.click(); };
renderContent();
</script>
</body>
</html>`;
  
  fs.writeFileSync('index.html', fullHtml);
  console.log('✅ Полный index.html создан с новой главной!');
} else {
  // Файл рабочий, просто обновляем функцию renderContent для главной
  console.log('⚠️ Файл рабочий, но нужно заменить только главную вкладку.');
  console.log('Лучше создай полный файл через PowerShell команду.');
}

console.log('\n🎉 ГОТОВО! Теперь выполни: npm start');