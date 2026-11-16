const fs = require('fs');

// package.json
fs.writeFileSync('package.json', JSON.stringify({
  name: "ynater",
  version: "2.0.0",
  description: "Dynamic Island для Windows",
  main: "main.js",
  scripts: { start: "electron ." },
  devDependencies: { electron: "^28.0.0" }
}, null, 2));

// main.js с расширенным функционалом
const mainCode = `const { app, BrowserWindow, screen, ipcMain, globalShortcut, desktopCapturer } = require('electron');
const https = require('https');
const { execSync } = require('child_process');
const path = require('path');
const { clipboard } = require('electron');

let win;
let isVisible = true;
let clipboardHistory = [];

app.whenReady().then(() => {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: 900,
    height: 500,
    x: Math.round((width - 900) / 2),
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  win.loadFile('index.html');

  // Горячие клавиши
  globalShortcut.register('CommandOrControl+Space', () => {
    isVisible = !isVisible;
    isVisible ? win.show() : win.hide();
  });

  // Отслеживание буфера обмена
  setInterval(() => {
    const text = clipboard.readText();
    if (text && text !== clipboardHistory[0]?.text) {
      clipboardHistory.unshift({ text, time: new Date().toLocaleTimeString() });
      if (clipboardHistory.length > 10) clipboardHistory.pop();
      if (win && !win.isDestroyed()) {
        win.webContents.send('clipboard-update', clipboardHistory);
      }
    }
  }, 1000);

  ipcMain.handle('get-clipboard', () => clipboardHistory);
  
  ipcMain.handle('get-weather', async (e, lat, lon) => {
    return new Promise((resolve, reject) => {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current_weather=true&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,pressure_msl&daily=uv_index_max,sunrise,sunset';
      https.get(url, { rejectUnauthorized: false }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const j = JSON.parse(d);
            resolve(j);
          } catch (err) { reject(err); }
        });
      }).on('error', reject);
    });
  });

  ipcMain.handle('geocode-city', async (e, city) => {
    return new Promise((resolve, reject) => {
      const url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1&language=ru';
      https.get(url, { rejectUnauthorized: false }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const j = JSON.parse(d);
            if (!j.results || !j.results.length) reject(new Error('Город не найден'));
            else resolve({ lat: j.results[0].latitude, lon: j.results[0].longitude, name: j.results[0].name });
          } catch (err) { reject(err); }
        });
      }).on('error', reject);
    });
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });`;

fs.writeFileSync('main.js', mainCode);

// index.html с полным функционалом Island
const htmlCode = \`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --bg: #000000;
    --surface: #1c1c1e;
    --surface-light: #2c2c2e;
    --text: #ffffff;
    --text-secondary: #8e8e93;
    --accent: #0a84ff;
    --border: rgba(255,255,255,0.1);
  }
  
  body {
    background: transparent;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex;
    justify-content: center;
    padding-top: 10px;
    user-select: none;
    overflow: hidden;
  }

  .island {
    width: 180px;
    height: 36px;
    background: var(--bg);
    border-radius: 18px;
    position: relative;
    cursor: pointer;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  }

  .island:hover {
    width: 850px;
    height: 480px;
    border-radius: 24px;
  }

  .compact-view {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--text);
    font-size: 14px;
    font-weight: 500;
    transition: opacity 0.3s;
  }

  .island:hover .compact-view {
    opacity: 0;
    pointer-events: none;
  }

  .compact-view .time {
    font-variant-numeric: tabular-nums;
  }

  .compact-view .weather {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
  }

  .expanded-view {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }

  .island:hover .expanded-view {
    opacity: 1;
    pointer-events: auto;
  }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .tab {
    padding: 8px 16px;
    background: var(--surface);
    border-radius: 12px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    outline: none;
  }

  .tab:hover {
    background: var(--surface-light);
    color: var(--text);
  }

  .tab.active {
    background: var(--accent);
    color: white;
  }

  .content {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    color: var(--text);
  }

  .content::-webkit-scrollbar {
    width: 6px;
  }

  .content::-webkit-scrollbar-thumb {
    background: var(--surface-light);
    border-radius: 3px;
  }

  /* Главная - Музыкальный плеер */
  .player {
    display: flex;
    gap: 20px;
    align-items: center;
    padding: 20px;
    background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
    border-radius: 20px;
    margin-bottom: 20px;
  }

  .player-cover {
    width: 120px;
    height: 120px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    flex-shrink: 0;
  }

  .player-info {
    flex: 1;
  }

  .player-title {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .player-artist {
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 16px;
  }

  .player-progress {
    width: 100%;
    height: 4px;
    background: var(--surface);
    border-radius: 2px;
    margin-bottom: 12px;
    overflow: hidden;
  }

  .player-progress-bar {
    height: 100%;
    background: var(--accent);
    width: 35%;
    border-radius: 2px;
  }

  .player-controls {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .player-btn {
    background: none;
    border: none;
    color: var(--text);
    font-size: 20px;
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    transition: background 0.2s;
  }

  .player-btn:hover {
    background: var(--surface);
  }

  .player-btn.play {
    font-size: 28px;
  }

  /* Буфер обмена */
  .clipboard-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .clipboard-item {
    padding: 12px;
    background: var(--surface);
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .clipboard-item:hover {
    background: var(--surface-light);
  }

  .clipboard-text {
    font-size: 14px;
    margin-bottom: 4px;
    word-break: break-word;
  }

  .clipboard-time {
    font-size: 11px;
    color: var(--text-secondary);
  }

  /* Погода */
  .weather-main {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
    padding: 20px;
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    border-radius: 20px;
  }

  .weather-temp {
    font-size: 64px;
    font-weight: 300;
    line-height: 1;
  }

  .weather-desc {
    font-size: 18px;
    margin-top: 8px;
  }

  .weather-details {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .weather-detail-card {
    padding: 16px;
    background: var(--surface);
    border-radius: 16px;
    text-align: center;
  }

  .weather-detail-label {
    font-size: 11px;
    color: var(--text-secondary);
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .weather-detail-value {
    font-size: 20px;
    font-weight: 600;
  }

  /* Заметки */
  .notes-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .note-input {
    padding: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    color: var(--text);
    font-size: 14px;
    outline: none;
    resize: none;
    font-family: inherit;
  }

  .note-input:focus {
    border-color: var(--accent);
  }

  .note-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .note-item {
    padding: 12px;
    background: var(--surface);
    border-radius: 12px;
    display: flex;
    justify-content: space-between;
    align-items: start;
  }

  .note-text {
    flex: 1;
    font-size: 14px;
    word-break: break-word;
  }

  .note-delete {
    background: none;
    border: none;
    color: #ff453a;
    cursor: pointer;
    font-size: 18px;
    padding: 4px 8px;
  }

  /* Таймер */
  .timer-display {
    font-size: 72px;
    font-weight: 200;
    text-align: center;
    margin: 40px 0;
    font-variant-numeric: tabular-nums;
  }

  .timer-controls {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .timer-btn {
    padding: 12px 32px;
    background: var(--accent);
    border: none;
    border-radius: 12px;
    color: white;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .timer-btn:hover {
    opacity: 0.8;
  }

  .timer-btn.secondary {
    background: var(--surface);
    color: var(--text);
  }

  /* Настройки */
  .settings-section {
    margin-bottom: 24px;
  }

  .settings-title {
    font-size: 13px;
    color: var(--text-secondary);
    text-transform: uppercase;
    margin-bottom: 12px;
    font-weight: 600;
  }

  .color-picker {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .color-option {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    border: 3px solid transparent;
    transition: transform 0.2s;
  }

  .color-option:hover {
    transform: scale(1.1);
  }

  .color-option.active {
    border-color: white;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
  }

  .empty-state-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
</style>
</head>
<body>
<div class="island">
  <div class="compact-view">
    <div class="time" id="compactTime">00:00</div>
    <div class="weather" id="compactWeather">
      <span id="weatherIcon">☀️</span>
      <span id="weatherTemp">--°</span>
    </div>
  </div>
  
  <div class="expanded-view">
    <div class="tabs">
      <button class="tab active" data-tab="home">🏠 Главная</button>
      <button class="tab" data-tab="clipboard">📋 Буфер</button>
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
let clipboardHistory = [];
let notes = JSON.parse(localStorage.getItem('island_notes') || '[]');
let timerTime = 0;
let timerInterval = null;
let timerRunning = false;
let weatherData = null;
let savedCity = localStorage.getItem('island_city') || 'Москва';
let savedCoords = JSON.parse(localStorage.getItem('island_coords') || '{"lat":55.7558,"lon":37.6173}');

// Часы
function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('compactTime').textContent = time;
}
updateClock();
setInterval(updateClock, 1000);

// Переключение вкладок
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    renderContent();
  });
});

// Рендер контента
function renderContent() {
  const content = document.getElementById('content');
  
  if (currentTab === 'home') {
    content.innerHTML = \`
      <div class="player">
        <div class="player-cover">🎵</div>
        <div class="player-info">
          <div class="player-title">On & On</div>
          <div class="player-artist">Cartoon feat. Daniel Levi</div>
          <div class="player-progress">
            <div class="player-progress-bar"></div>
          </div>
          <div class="player-controls">
            <button class="player-btn">⏮</button>
            <button class="player-btn play">▶</button>
            <button class="player-btn">⏭</button>
          </div>
        </div>
      </div>
      <div class="empty-state">
        <div class="empty-state-icon">🎧</div>
        <div>Музыкальный плеер</div>
        <div style="font-size: 13px; margin-top: 8px;">Интеграция с музыкальными приложениями</div>
      </div>
    \`;
  }
  
  else if (currentTab === 'clipboard') {
    if (clipboardHistory.length === 0) {
      content.innerHTML = \`
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div>Буфер обмена пуст</div>
          <div style="font-size: 13px; margin-top: 8px;">Скопируйте что-нибудь</div>
        </div>
      \`;
    } else {
      content.innerHTML = \`
        <div class="clipboard-list">
          \${clipboardHistory.map((item, i) => \`
            <div class="clipboard-item" onclick="copyToClipboard('\${item.text.replace(/'/g, "\\'")}')">
              <div class="clipboard-text">\${item.text}</div>
              <div class="clipboard-time">\${item.time}</div>
            </div>
          \`).join('')}
        </div>
      \`;
    }
  }
  
  else if (currentTab === 'weather') {
    if (!weatherData) {
      content.innerHTML = \`
        <div class="empty-state">
          <div class="empty-state-icon">🌤️</div>
          <div>Загрузка погоды...</div>
        </div>
      \`;
      loadWeather();
    } else {
      const current = weatherData.current_weather;
      const hourly = weatherData.hourly;
      const daily = weatherData.daily;
      const now = new Date().getHours();
      
      content.innerHTML = \`
        <div class="weather-main">
          <div>
            <div class="weather-temp">\${Math.round(current.temperature)}°</div>
            <div class="weather-desc">\${getWeatherDesc(current.weathercode)}</div>
            <div style="margin-top: 8px; font-size: 14px;">\${savedCity}</div>
          </div>
        </div>
        <div class="weather-details">
          <div class="weather-detail-card">
            <div class="weather-detail-label">Ветер</div>
            <div class="weather-detail-value">\${current.windspeed} м/с</div>
          </div>
          <div class="weather-detail-card">
            <div class="weather-detail-label">Влажность</div>
            <div class="weather-detail-value">\${hourly.relative_humidity_2m[now]}%</div>
          </div>
          <div class="weather-detail-card">
            <div class="weather-detail-label">Давление</div>
            <div class="weather-detail-value">\${Math.round(hourly.pressure_msl[now])} гПа</div>
          </div>
          <div class="weather-detail-card">
            <div class="weather-detail-label">UV индекс</div>
            <div class="weather-detail-value">\${daily.uv_index_max[0]}</div>
          </div>
          <div class="weather-detail-card">
            <div class="weather-detail-label">Восход</div>
            <div class="weather-detail-value">\${daily.sunrise[0].split('T')[1]}</div>
          </div>
          <div class="weather-detail-card">
            <div class="weather-detail-label">Закат</div>
            <div class="weather-detail-value">\${daily.sunset[0].split('T')[1]}</div>
          </div>
        </div>
      \`;
    }
  }
  
  else if (currentTab === 'notes') {
    content.innerHTML = \`
      <div class="notes-container">
        <textarea class="note-input" id="noteInput" placeholder="Новая заметка..." rows="3"></textarea>
        <button class="timer-btn" onclick="addNote()">Добавить</button>
        <div class="note-list">
          \${notes.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">📝</div><div>Нет заметок</div></div>' : 
            notes.map((note, i) => \`
              <div class="note-item">
                <div class="note-text">\${note}</div>
                <button class="note-delete" onclick="deleteNote(\${i})">✕</button>
              </div>
            \`).join('')}
        </div>
      </div>
    \`;
  }
  
  else if (currentTab === 'timer') {
    const mins = Math.floor(timerTime / 60);
    const secs = timerTime % 60;
    const timeStr = \`\${String(mins).padStart(2, '0')}:\${String(secs).padStart(2, '0')}\`;
    
    content.innerHTML = \`
      <div class="timer-display">\${timeStr}</div>
      <div class="timer-controls">
        <button class="timer-btn" onclick="toggleTimer()">\${timerRunning ? 'Пауза' : 'Старт'}</button>
        <button class="timer-btn secondary" onclick="resetTimer()">Сброс</button>
      </div>
      <div style="display: flex; gap: 8px; justify-content: center; margin-top: 24px;">
        <button class="timer-btn secondary" onclick="setTimer(5)">5 мин</button>
        <button class="timer-btn secondary" onclick="setTimer(15)">15 мин</button>
        <button class="timer-btn secondary" onclick="setTimer(25)">25 мин</button>
      </div>
    \`;
  }
  
  else if (currentTab === 'settings') {
    content.innerHTML = \`
      <div class="settings-section">
        <div class="settings-title">Цвет акцента</div>
        <div class="color-picker">
          <div class="color-option" style="background: #0a84ff" onclick="setAccent('#0a84ff')"></div>
          <div class="color-option" style="background: #30d158" onclick="setAccent('#30d158')"></div>
          <div class="color-option" style="background: #ff9f0a" onclick="setAccent('#ff9f0a')"></div>
          <div class="color-option" style="background: #ff453a" onclick="setAccent('#ff453a')"></div>
          <div class="color-option" style="background: #bf5af2" onclick="setAccent('#bf5af2')"></div>
          <div class="color-option" style="background: #ffffff" onclick="setAccent('#ffffff')"></div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-title">Город для погоды</div>
        <input type="text" class="note-input" id="cityInput" value="\${savedCity}" placeholder="Введите город">
        <button class="timer-btn" style="margin-top: 12px;" onclick="changeCity()">Сохранить</button>
      </div>
    \`;
  }
}

// Функции
window.copyToClipboard = function(text) {
  const { clipboard } = require('electron');
  clipboard.writeText(text);
};

window.addNote = function() {
  const input = document.getElementById('noteInput');
  const text = input.value.trim();
  if (text) {
    notes.unshift(text);
    localStorage.setItem('island_notes', JSON.stringify(notes));
    renderContent();
  }
};

window.deleteNote = function(index) {
  notes.splice(index, 1);
  localStorage.setItem('island_notes', JSON.stringify(notes));
  renderContent();
};

window.toggleTimer = function() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
  } else {
    timerRunning = true;
    timerInterval = setInterval(() => {
      if (timerTime > 0) {
        timerTime--;
        renderContent();
      } else {
        clearInterval(timerInterval);
        timerRunning = false;
        alert('Таймер завершён!');
      }
    }, 1000);
  }
  renderContent();
};

window.resetTimer = function() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerTime = 0;
  renderContent();
};

window.setTimer = function(minutes) {
  timerTime = minutes * 60;
  renderContent();
};

window.setAccent = function(color) {
  document.documentElement.style.setProperty('--accent', color);
  localStorage.setItem('island_accent', color);
  document.querySelectorAll('.color-option').forEach(el => el.classList.remove('active'));
  event.target.classList.add('active');
};

window.changeCity = async function() {
  const input = document.getElementById('cityInput');
  const city = input.value.trim();
  if (city) {
    try {
      const result = await ipcRenderer.invoke('geocode-city', city);
      savedCity = result.name;
      savedCoords = { lat: result.lat, lon: result.lon };
      localStorage.setItem('island_city', savedCity);
      localStorage.setItem('island_coords', JSON.stringify(savedCoords));
      weatherData = null;
      renderContent();
    } catch (e) {
      alert('Город не найден');
    }
  }
};

function getWeatherDesc(code) {
  const descs = {
    0: 'Ясно', 1: 'Преим. ясно', 2: 'Переменная облачность', 3: 'Пасмурно',
    45: 'Туман', 48: 'Изморозь', 51: 'Лёгкая морось', 53: 'Морось', 55: 'Сильная морось',
    61: 'Небольшой дождь', 63: 'Дождь', 65: 'Сильный дождь',
    71: 'Небольшой снег', 73: 'Снег', 75: 'Сильный снег', 77: 'Снежные зёрна',
    80: 'Ливень', 81: 'Сильный ливень', 82: 'Очень сильный ливень',
    85: 'Снегопад', 86: 'Сильный снегопад', 95: 'Гроза', 96: 'Гроза с градом', 99: 'Сильная гроза с градом'
  };
  return descs[code] || 'Неизвестно';
}

async function loadWeather() {
  try {
    weatherData = await ipcRenderer.invoke('get-weather', savedCoords.lat, savedCoords.lon);
    const current = weatherData.current_weather;
    document.getElementById('weatherIcon').textContent = getWeatherIcon(current.weathercode);
    document.getElementById('weatherTemp').textContent = Math.round(current.temperature) + '°';
    renderContent();
  } catch (e) {
    console.error('Ошибка загрузки погоды:', e);
  }
}

function getWeatherIcon(code) {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code >= 95) return '⛈️';
  return '🌥️';
}

// Загрузка буфера обмена
ipcRenderer.invoke('get-clipboard').then(history => {
  clipboardHistory = history;
  if (currentTab === 'clipboard') renderContent();
});

ipcRenderer.on('clipboard-update', (event, history) => {
  clipboardHistory = history;
  if (currentTab === 'clipboard') renderContent();
});

// Загрузка погоды при старте
loadWeather();
setInterval(loadWeather, 10 * 60 * 1000);

// Восстановление цвета
const savedAccent = localStorage.getItem('island_accent');
if (savedAccent) {
  document.documentElement.style.setProperty('--accent', savedAccent);
}

// Начальный рендер
renderContent();
</script>
</body>
</html>\`;

fs.writeFileSync('index.html', htmlCode);

console.log('✅ Island создан! Запускай: npm start');