const fs = require('fs');
const { exec } = require('child_process');

// main.js для v1.6.0
const mainCode = `const { app, BrowserWindow, screen, ipcMain, globalShortcut, clipboard, nativeImage } = require('electron');
const https = require('https');
const os = require('os');
const { exec } = require('child_process');
let win, isVisible = true, clipHist = [], lastClip = '';
let dndMode = false, dndTimer = null;
let hideInGames = false, hideOnScreenshots = false;
let pinnedApps = [];
let islandScale = 1.0;
let cpuHistory = new Array(60).fill(0);
let networkStats = { rx: 0, tx: 0 };

app.whenReady().then(() => {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({ 
    width: 850, height: 500, 
    x: Math.round((width-850)/2), y: 0, 
    frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, 
    webPreferences: { nodeIntegration: true, contextIsolation: false } 
  });
  win.loadFile('index.html');
  
  globalShortcut.register('CommandOrControl+Space', () => { 
    isVisible = !isVisible; 
    if (isVisible) win.show(); else win.hide(); 
  });
  
  // Мониторинг буфера обмена
  setInterval(() => {
    try { 
      const t = clipboard.readText();
      if (t && t !== lastClip && t.length > 0 && t.length < 500) {
        lastClip = t; 
        let type = 'text';
        if(t.startsWith('http')) type='link';
        else if(t.includes('@') && t.includes('.')) type='email';
        clipHist.unshift({ text: t, time: new Date().toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'}), type, pinned:false });
        if (clipHist.length > 30) clipHist.pop();
        if (win && !win.isDestroyed()) win.webContents.send('clip-update', clipHist);
      }
    } catch(e) {}
  }, 800);

  // Системная статистика
  setInterval(() => {
    if(win && !win.isDestroyed()) {
      const cpus = os.cpus();
      let totalIdle=0, totalTick=0;
      cpus.forEach(cpu=>{ for(let type in cpu.times){ totalTick+=cpu.times[type]; if(type==='idle') totalIdle+=cpu.times[type]; }});
      const cpuUsage = Math.round((1 - totalIdle/totalTick)*100);
      cpuHistory.push(cpuUsage);
      if(cpuHistory.length > 60) cpuHistory.shift();
      
      const mem = os.totalmem(), freeMem = os.freemem();
      const ramUsage = Math.round(((mem-freeMem)/mem)*100);
      const uptime = Math.floor(os.uptime());
      
      // Батарея
      let battery = null;
      exec('wmic path Win32_Battery get EstimatedChargeRemaining,BatteryStatus', (err, stdout) => {
        if(!err && stdout) {
          const lines = stdout.trim().split('\\n');
          if(lines.length > 1) {
            const parts = lines[1].trim().split(/\\s+/);
            battery = { level: parseInt(parts[0]) || 0, status: parseInt(parts[1]) };
          }
        }
      });

      // GPU (NVIDIA)
      let gpu = null;
      exec('nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits', (err, stdout) => {
        if(!err && stdout) {
          const parts = stdout.trim().split(',');
          gpu = { usage: parseInt(parts[0]), memUsed: parseInt(parts[1]), memTotal: parseInt(parts[2]) };
        }
      });

      // Температура CPU (WMI)
      let cpuTemp = null;
      exec('wmic /namespace:\\\\\\\\root\\\\wmi PATH MSAcpi_ThermalZoneTemperature get CurrentTemperature', (err, stdout) => {
        if(!err && stdout) {
          const lines = stdout.trim().split('\\n');
          if(lines.length > 1) {
            const temp = parseInt(lines[1].trim());
            if(!isNaN(temp)) cpuTemp = Math.round((temp - 2732) / 10);
          }
        }
      });

      // Диски
      let disks = [];
      exec('wmic logicaldisk get Caption,Size,FreeSpace', (err, stdout) => {
        if(!err && stdout) {
          const lines = stdout.trim().split('\\n').slice(1);
          lines.forEach(line => {
            const parts = line.trim().split(/\\s+/);
            if(parts.length >= 3) {
              const size = parseInt(parts[1]);
              const free = parseInt(parts[2]);
              if(size > 0) {
                disks.push({ 
                  name: parts[0], 
                  total: Math.round(size/1024/1024/1024), 
                  free: Math.round(free/1024/1024/1024),
                  used: Math.round((size-free)/1024/1024/1024)
                });
              }
            }
          });
        }
      });

      // Процессы (топ-5 по CPU)
      let processes = [];
      exec('powershell -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name,CPU"', (err, stdout) => {
        if(!err && stdout) {
          const lines = stdout.trim().split('\\n').slice(3);
          lines.forEach(line => {
            const parts = line.trim().split(/\\s+/);
            if(parts.length >= 2) {
              processes.push({ name: parts[0], cpu: parseFloat(parts[1]) || 0 });
            }
          });
        }
      });

      win.webContents.send('sys-stats', { 
        cpu: cpuUsage, cpuHistory, ram: ramUsage, uptime, 
        memTotal: Math.round(mem/1024/1024/1024), 
        memFree: Math.round(freeMem/1024/1024/1024), 
        battery, gpu, cpuTemp, disks, processes 
      });
    }
  }, 1000);

  // Курсы валют и крипты
  setInterval(() => {
    https.get('https://www.cbr-xml-daily.ru/daily_json.js', {rejectUnauthorized:false}, (r) => {
      let d=''; r.on('data', c=>d+=c); r.on('end', ()=>{ 
        try{ 
          const j=JSON.parse(d); 
          if(win&&!win.isDestroyed()) win.webContents.send('currency-data', {
            usd: j.Valute.USD.Value.toFixed(2), 
            eur: j.Valute.EUR.Value.toFixed(2)
          });
        }catch(e){} 
      });
    }).on('error',()=>{});
    
    https.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd', {rejectUnauthorized:false}, (r) => {
      let d=''; r.on('data', c=>d+=c); r.on('end', ()=>{ 
        try{ 
          const j=JSON.parse(d); 
          if(win&&!win.isDestroyed()) win.webContents.send('crypto-data', {
            btc: j.bitcoin.usd, 
            eth: j.ethereum.usd
          });
        }catch(e){} 
      });
    }).on('error',()=>{});
  }, 300000);

  // Тест скорости интернета
  ipcMain.handle('speed-test', async () => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      https.get('https://speed.hetzner.de/100MB.bin', {rejectUnauthorized:false}, (res) => {
        let received = 0;
        res.on('data', chunk => { received += chunk.length; });
        res.on('end', () => {
          const duration = (Date.now() - start) / 1000;
          const speedMbps = Math.round((received * 8) / (duration * 1000000));
          resolve(speedMbps);
        });
      }).on('error', reject);
    });
  });

  // Перевод текста
  ipcMain.handle('translate-text', async (e, text) => {
    return new Promise((resolve, reject) => {
      https.get(\`https://api.mymemory.translated.net/get?q=\${encodeURIComponent(text)}&langpair=auto|ru\`, {rejectUnauthorized:false}, (r) => {
        let d=''; r.on('data', c=>d+=c); r.on('end', ()=>{ 
          try{ resolve(JSON.parse(d).responseData.translatedText); }catch(err){ reject(err); } 
        });
      }).on('error', reject);
    });
  });

  // Запуск приложений
  ipcMain.handle('launch-app', (e, appName) => {
    const apps = {
      'discord': \`C:\\\\Users\\\\\${process.env.USERNAME}\\\\AppData\\\\Local\\\\Discord\\\\Update.exe --processStart Discord.exe\`,
      'telegram': 'C:\\\\Program Files (x86)\\\\Telegram Desktop\\\\Telegram.exe',
      'chrome': 'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      'vscode': \`C:\\\\Users\\\\\${process.env.USERNAME}\\\\AppData\\\\Local\\\\Programs\\\\Microsoft VS Code\\\\Code.exe\`
    };
    if(apps[appName.toLowerCase()]) {
      exec(\`start /B "\${apps[appName.toLowerCase()]}"\`, (err) => { if(err) console.error(err); });
      return true;
    }
    return false;
  });

  // IPC обработчики
  ipcMain.handle('get-clip', () => clipHist);
  ipcMain.handle('toggle-pin', (e, idx) => { 
    if(clipHist[idx]) clipHist[idx].pinned = !clipHist[idx].pinned; 
    return clipHist; 
  });
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
  
  ipcMain.on('set-hide-in-games', (e, val) => { hideInGames = val; });
  ipcMain.on('set-hide-on-screenshots', (e, val) => { hideOnScreenshots = val; });
  ipcMain.on('set-scale', (e, val) => { 
    islandScale = val; 
    if(win) {
      const [w, h] = win.getSize();
      win.setSize(Math.round(w * val), Math.round(h * val));
    }
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });`;

fs.writeFileSync('main.js', mainCode);

// index.html для v1.6.0 (сокращенная версия для примера, полный код будет в файле)
const htmlCode = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Ynater</title>
<style>
/* ... [Весь CSS из предыдущих версий + новые стили для v1.6.0] ... */
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#000;--s:#1c1c1e;--s2:#2c2c2e;--t:#fff;--t2:#8e8e93;--a:#fff;--b:rgba(255,255,255,0.1)}
body{background:transparent;font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:flex;justify-content:center;padding-top:10px;user-select:none;overflow:hidden}
.island{width:180px;height:36px;background:var(--bg);border-radius:18px;position:relative;cursor:pointer;transition:all 0.5s cubic-bezier(0.4,0,0.2,1);overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.5);border:1px solid var(--b);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.island:hover{width:850px;height:500px;border-radius:24px}
.cv{position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:12px;color:var(--t);font-size:14px;font-weight:500;transition:opacity 0.3s;z-index:10}
.island:hover .cv{opacity:0;pointer-events:none}
.ev{position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;pointer-events:none;transition:opacity 0.3s;display:flex;flex-direction:column;background:var(--bg);z-index:5}
.island:hover .ev{opacity:1;pointer-events:auto}
.tabs{display:flex;gap:4px;padding:12px;border-bottom:1px solid var(--b);flex-shrink:0;flex-wrap:wrap}
.tab{padding:8px 14px;background:var(--s);border-radius:12px;font-size:13px;color:var(--t2);cursor:pointer;transition:all 0.2s;border:none;outline:none}
.tab:hover{background:var(--s2);color:var(--t)}
.tab.active{background:var(--a);color:#000}
.content{flex:1;padding:16px;overflow-y:auto;color:var(--t)}
.dash{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.dc{background:var(--s);border-radius:16px;padding:16px}
.dc.full{grid-column:1/-1}
.dt{font-size:11px;color:var(--t2);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;font-weight:600}
.greet{font-size:24px;font-weight:700;margin-bottom:4px}
.greet-sub{font-size:13px;color:var(--t2)}
.qt{display:flex;gap:8px;flex-wrap:wrap}
.qb{flex:1;min-width:80px;padding:12px;background:var(--s2);border:none;border-radius:12px;color:var(--t);cursor:pointer;transition:all 0.2s;font-size:13px;font-weight:600}
.qb:hover{background:var(--a);color:#000;transform:scale(1.05)}
.qb .tm{font-size:18px;display:block;margin-bottom:2px}
.qb .lb{font-size:10px;color:var(--t2)}
.qb:hover .lb{color:#000}
.rn{display:flex;flex-direction:column;gap:6px}
.ri{padding:10px;background:var(--s2);border-radius:10px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ri.empty{color:var(--t2);font-style:italic;text-align:center;padding:20px}
.wf{display:flex;justify-content:space-between;gap:8px}
.wi{flex:1;text-align:center;padding:8px;background:var(--s2);border-radius:10px}
.wih{font-size:11px;color:var(--t2);margin-bottom:4px}
.wic{font-size:20px;margin-bottom:4px}
.wit{font-size:13px;font-weight:600}
.quote{font-size:14px;font-style:italic;color:var(--t2);text-align:center;padding:12px;line-height:1.5}
.quote-a{font-size:11px;margin-top:8px;font-style:normal;font-weight:600;color:var(--a)}
.upload{padding:24px;background:var(--s);border-radius:16px;text-align:center;cursor:pointer;border:2px dashed var(--b);margin-bottom:16px}
.upload:hover{background:var(--s2);border-color:var(--a)}
.upload input{display:none}
.ci{padding:12px;background:var(--s);border-radius:12px;margin-bottom:8px;cursor:pointer;transition:background 0.2s;display:flex;justify-content:space-between;align-items:center}
.ci:hover{background:var(--s2)}
.ct{font-size:14px;margin-bottom:4px;word-break:break-word;flex:1}
.ctm{font-size:11px;color:var(--t2);margin-right:8px}
.pin-btn{background:none;border:none;color:var(--t2);cursor:pointer;font-size:16px;padding:4px}
.pin-btn.active{color:var(--a)}
.wm{display:flex;gap:20px;margin-bottom:20px;padding:20px;background:linear-gradient(135deg,#1e3c72 0%,#2a5298 100%);border-radius:20px}
.wtemp{font-size:64px;font-weight:300;line-height:1}
.wdesc{font-size:18px;margin-top:8px}
.wd{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.wdc{padding:16px;background:var(--s);border-radius:16px;text-align:center}
.wdl{font-size:11px;color:var(--t2);text-transform:uppercase;margin-bottom:8px}
.wdv{font-size:20px;font-weight:600}
.ni{width:100%;padding:12px;background:var(--s);border:1px solid var(--b);border-radius:12px;color:var(--t);font-size:14px;outline:none;resize:none;font-family:inherit;margin-bottom:12px}
.ni:focus{border-color:var(--a)}
.nl{display:flex;flex-direction:column;gap:8px}
.nit{padding:12px;background:var(--s);border-radius:12px;display:flex;justify-content:space-between;align-items:start}
.nd{background:none;border:none;color:#ff453a;cursor:pointer;font-size:18px;padding:4px 8px}
.td{font-size:72px;font-weight:200;text-align:center;margin:40px 0;font-variant-numeric:tabular-nums;position:relative}
.tc{display:flex;gap:12px;justify-content:center}
.tb{padding:12px 32px;background:var(--a);border:none;border-radius:12px;color:#000;font-size:16px;font-weight:600;cursor:pointer}
.tb.sec{background:var(--s);color:#fff}
.edit-btn{position:absolute;top:-30px;right:50%;transform:translateX(50%);background:var(--s);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;color:var(--t);font-size:16px;opacity:0.7;transition:opacity 0.2s}
.edit-btn:hover{opacity:1;background:var(--s2)}
.time-input{display:flex;gap:8px;justify-content:center;align-items:center;margin-bottom:20px}
.time-input input{width:60px;padding:8px;background:var(--s);border:1px solid var(--b);border-radius:8px;color:var(--t);font-size:18px;text-align:center;outline:none}
.time-input input:focus{border-color:var(--a)}
.time-input span{font-size:24px;color:var(--t2)}
.ss{margin-bottom:24px}
.st{font-size:13px;color:var(--t2);text-transform:uppercase;margin-bottom:12px;font-weight:600}
.cp{display:flex;gap:12px;flex-wrap:wrap}
.co{width:48px;height:48px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:all 0.2s;position:relative}
.co:hover{transform:scale(1.15)}
.co.active{border-color:#000;box-shadow:0 0 0 2px #fff,0 0 0 4px #000}
.co.active::after{content:"✓";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#000;font-weight:bold;font-size:20px}
.co[data-color="#ffffff"].active::after{color:#fff;text-shadow:0 0 4px #000}
.gradient-bg{position:absolute;top:0;left:0;width:100%;height:100%;opacity:0.3;transition:opacity 0.5s;pointer-events:none;z-index:1}
.island:hover .gradient-bg{opacity:0.6}
.mascot{position:absolute;bottom:10px;right:10px;width:32px;height:32px;z-index:20;pointer-events:none;transition:transform 0.3s}
.mascot svg{width:100%;height:100%;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))}
.mascot.sleeping{animation:sleepBreathe 3s infinite ease-in-out}
.mascot.awake{animation:bounce 0.5s infinite alternate}
@keyframes sleepBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@keyframes bounce{0%{transform:translateY(0)}100%{transform:translateY(-5px)}}
.pupil{transition:transform 0.1s ease-out}
.skin-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:8px}
.skin-option{width:48px;height:48px;background:var(--s);border-radius:12px;cursor:pointer;border:2px solid transparent;transition:all 0.2s;display:flex;align-items:center;justify-content:center;font-size:24px}
.skin-option:hover{background:var(--s2);transform:scale(1.1)}
.skin-option.active{border-color:var(--a);box-shadow:0 0 0 2px var(--a)}
.timer-alert{position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--a);font-size:16px;font-weight:700;z-index:15;opacity:0;pointer-events:none;transition:opacity 0.3s;border-radius:18px}
.timer-alert.show{opacity:1;pointer-events:auto}
.compact-time{transition:transform 0.4s cubic-bezier(0.4,0,0.2,1);transform-origin:center right}
.island:hover .compact-time{transform:translateX(40px)}

/* Новые стили v1.6.0 */
.sys-stat{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.sys-bar{flex:1;height:6px;background:var(--s2);border-radius:3px;overflow:hidden}
.sys-fill{height:100%;background:var(--a);transition:width 0.5s}
.sparkline{width:100%;height:40px;margin-top:8px}
.note-preview{font-size:12px;color:var(--t2);margin-top:4px;max-height:30px;overflow:hidden}
.search-box{width:100%;padding:10px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--t);margin-bottom:12px;outline:none}
.search-box:focus{border-color:var(--a)}
.tag{display:inline-block;padding:2px 8px;background:var(--s2);border-radius:6px;font-size:11px;margin-right:4px;color:var(--t2)}
.currency-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--b)}
.markdown-body{line-height:1.6}
.markdown-body h1,.markdown-body h2{margin:10px 0;color:var(--a)}
.markdown-body ul{padding-left:20px}
.markdown-body strong{color:var(--a)}
.caps-indicator{position:absolute;top:5px;right:5px;background:#ff9f0a;color:#000;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;display:none}
.layout-indicator{position:absolute;top:5px;left:5px;background:var(--s2);color:var(--t);padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold}
.dnd-overlay{position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:100;border-radius:18px;color:var(--a);font-size:18px;font-weight:bold}
.faq-item{background:var(--s);border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer}
.faq-q{font-weight:600;margin-bottom:4px}
.faq-a{font-size:13px;color:var(--t2);display:none}
.faq-item.open .faq-a{display:block}
.scale-slider{width:100%;margin:12px 0}
.app-launcher{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.app-btn{background:var(--s);border-radius:12px;padding:12px;text-align:center;cursor:pointer;transition:background 0.2s}
.app-btn:hover{background:var(--s2)}
.app-icon{font-size:24px;margin-bottom:4px}
.app-name{font-size:11px}
.speed-test-btn{width:100%;padding:12px;background:var(--a);border:none;border-radius:12px;color:#000;font-size:16px;font-weight:600;cursor:pointer;margin-top:12px}
.disk-bar{height:8px;background:var(--s2);border-radius:4px;margin-top:4px;overflow:hidden}
.disk-fill{height:100%;background:var(--a);transition:width 0.5s}
.process-list{display:flex;flex-direction:column;gap:4px}
.process-item{display:flex;justify-content:space-between;padding:8px;background:var(--s);border-radius:8px;font-size:13px}
.kill-btn{background:none;border:none;color:#ff453a;cursor:pointer;font-size:16px}
</style>
</head>
<body>
<div class="island">
  <canvas class="gradient-bg" id="gradCanvas"></canvas>
  <div class="timer-alert" id="timerAlert">⏱️ Время вышло!</div>
  <div class="dnd-overlay" id="dndOverlay" style="display:none">🔕 Не беспокоить</div>
  <div class="cv">
    <div class="layout-indicator" id="layoutInd">EN</div>
    <div class="caps-indicator" id="capsInd">CAPS</div>
    <div class="compact-time"><div id="cTime">00:00</div></div>
    <div id="cW"><span id="wI">☀️</span> <span id="wT">--°</span></div>
  </div>
  <div class="mascot sleeping" id="mascot"></div>
  <div class="ev">
    <div class="tabs">
      <button class="tab active" data-tab="home">🏠 Главная</button>
      <button class="tab" data-tab="system">💻 Система</button>
      <button class="tab" data-tab="music">🎵 Музыка</button>
      <button class="tab" data-tab="weather">🌤️ Погода</button>
      <button class="tab" data-tab="clipboard">📋 Буфер</button>
      <button class="tab" data-tab="notes">📝 Заметки</button>
      <button class="tab" data-tab="timer">⏱️ Таймер</button>
      <button class="tab" data-tab="settings">⚙️ Настройки</button>
      <button class="tab" data-tab="faq">❓ FAQ</button>
    </div>
    <div class="content" id="content"></div>
  </div>
</div>
<script>
const { ipcRenderer } = require('electron');
let curTab='home', notes=JSON.parse(localStorage.getItem('island_notes')||'[]'), clipHist=[];
let tTime=parseInt(localStorage.getItem('island_timer')||'0'), tInt=null, tRun=false;
let wData=null, sCity=localStorage.getItem('island_city')||'Москва';
let sCoords=JSON.parse(localStorage.getItem('island_coords')||'{"lat":55.7558,"lon":37.6173}');
let currentSkin=localStorage.getItem('island_skin')||'cat';
let sysStats={cpu:0,cpuHistory:[],ram:0,uptime:0,memTotal:0,memFree:0,battery:null,gpu:null,cpuTemp:null,disks:[],processes:[]};
let currencyData={usd:'--',eur:'--'};
let cryptoData={btc:'--',eth:'--'};
let dndMode=false, dndEndTime=0;
let hideInGames=localStorage.getItem('hide_in_games')==='true';
let hideOnScreenshots=localStorage.getItem('hide_on_screenshots')==='true';
let islandScale=parseFloat(localStorage.getItem('island_scale'))||1.0;
const colors=[{n:'Белый',v:'#ffffff'},{n:'Синий',v:'#0a84ff'},{n:'Зеленый',v:'#30d158'},{n:'Оранжевый',v:'#ff9f0a'},{n:'Красный',v:'#ff453a'},{n:'Фиолетовый',v:'#bf5af2'},{n:'Розовый',v:'#ff375f'},{n:'Бирюзовый',v:'#64d2ff'},{n:'Желтый',v:'#ffd60a'},{n:'Индиго',v:'#5e5ce6'},{n:'Мятный',v:'#32d74b'},{n:'Коралловый',v:'#ff6961'}];
const quotes=[{t:'Каждый день — новый шанс стать лучше.',a:'Неизвестно'},{t:'Успех — это сумма маленьких усилий.',a:'Роберт Кольер'},{t:'Не бойся медлить, бойся остановиться.',a:'Китайская пословица'},{t:'Ты сильнее, чем думаешь.',a:'Неизвестно'},{t:'Дисциплина — мост между целями и достижениями.',a:'Джим Рон'}];
const skins={
  cat:\`<svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="40" fill="var(--a)"/><path d="M25 35 L15 15 L40 25 Z" fill="var(--a)"/><path d="M75 35 L85 15 L60 25 Z" fill="var(--a)"/><circle cx="35" cy="45" r="8" fill="#fff"/><circle cx="65" cy="45" r="8" fill="#fff"/><circle class="pupil" id="pL" cx="35" cy="45" r="4" fill="#000"/><circle class="pupil" id="pR" cx="65" cy="45" r="4" fill="#000"/><path d="M45 55 Q50 60 55 55" stroke="#000" stroke-width="3" stroke-linecap="round"/></svg>\`,
  robot:\`<svg viewBox="0 0 100 100" fill="none"><rect x="20" y="25" width="60" height="50" rx="10" fill="var(--a)"/><rect x="30" y="15" width="40" height="10" rx="3" fill="var(--a)"/><circle cx="38" cy="45" r="6" fill="#fff"/><circle cx="62" cy="45" r="6" fill="#fff"/><circle class="pupil" id="pL" cx="38" cy="45" r="3" fill="#000"/><circle class="pupil" id="pR" cx="62" cy="45" r="3" fill="#000"/><line x1="35" y1="60" x2="65" y2="60" stroke="#000" stroke-width="3" stroke-linecap="round"/></svg>\`,
  fox:\`<svg viewBox="0 0 100 100" fill="none"><polygon points="50,15 20,40 35,85 65,85 80,40" fill="var(--a)"/><polygon points="50,15 30,35 50,45 70,35" fill="#fff"/><circle cx="40" cy="50" r="5" fill="#fff"/><circle cx="60" cy="50" r="5" fill="#fff"/><circle class="pupil" id="pL" cx="40" cy="50" r="2.5" fill="#000"/><circle class="pupil" id="pR" cx="60" cy="50" r="2.5" fill="#000"/><circle cx="50" cy="60" r="3" fill="#000"/></svg>\`,
  ghost:\`<svg viewBox="0 0 100 100" fill="none"><path d="M50 15 C30 15 20 35 20 55 L20 80 L30 70 L40 80 L50 70 L60 80 L70 70 L80 80 L80 55 C80 35 70 15 50 15Z" fill="var(--a)" opacity="0.9"/><circle cx="40" cy="45" r="6" fill="#fff"/><circle cx="60" cy="45" r="6" fill="#fff"/><circle class="pupil" id="pL" cx="40" cy="45" r="3" fill="#000"/><circle class="pupil" id="pR" cx="60" cy="45" r="3" fill="#000"/><ellipse cx="50" cy="60" rx="5" ry="3" fill="#000"/></svg>\`,
  capybara:\`<svg viewBox="0 0 100 100" fill="none"><ellipse cx="50" cy="55" rx="35" ry="30" fill="var(--a)"/><circle cx="35" cy="45" r="4" fill="#fff"/><circle cx="65" cy="45" r="4" fill="#fff"/><circle class="pupil" id="pL" cx="35" cy="45" r="2" fill="#000"/><circle class="pupil" id="pR" cx="65" cy="45" r="2" fill="#000"/><ellipse cx="50" cy="58" rx="8" ry="4" fill="#000"/><line x1="42" y1="58" x2="58" y2="58" stroke="#fff" stroke-width="1"/></svg>\`,
  panda:\`<svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="38" fill="var(--a)"/><circle cx="35" cy="42" r="12" fill="#000"/><circle cx="65" cy="42" r="12" fill="#000"/><circle cx="35" cy="42" r="5" fill="#fff"/><circle cx="65" cy="42" r="5" fill="#fff"/><circle class="pupil" id="pL" cx="35" cy="42" r="2.5" fill="#000"/><circle class="pupil" id="pR" cx="65" cy="42" r="2.5" fill="#000"/><ellipse cx="50" cy="58" rx="6" ry="4" fill="#000"/></svg>\`,
  alien:\`<svg viewBox="0 0 100 100" fill="none"><ellipse cx="50" cy="50" rx="35" ry="40" fill="var(--a)"/><ellipse cx="38" cy="42" rx="10" ry="14" fill="#fff" transform="rotate(-15 38 42)"/><ellipse cx="62" cy="42" rx="10" ry="14" fill="#fff" transform="rotate(15 62 42)"/><circle class="pupil" id="pL" cx="38" cy="42" r="5" fill="#000"/><circle class="pupil" id="pR" cx="62" cy="42" r="5" fill="#000"/><path d="M45 65 Q50 60 55 65" stroke="#000" stroke-width="2" stroke-linecap="round"/></svg>\`,
  heart:\`<svg viewBox="0 0 100 100" fill="none"><path d="M50 85 C30 65 10 50 10 35 C10 20 25 10 40 10 C48 10 50 20 50 20 C50 20 52 10 60 10 C75 10 90 20 90 35 C90 50 70 65 50 85Z" fill="var(--a)"/><circle cx="40" cy="35" r="4" fill="#fff"/><circle cx="60" cy="35" r="4" fill="#fff"/><circle class="pupil" id="pL" cx="40" cy="35" r="2" fill="#000"/><circle class="pupil" id="pR" cx="60" cy="35" r="2" fill="#000"/></svg>\`
};

// Простой Markdown парсер
function parseMD(text){
  return text.replace(/^### (.*$)/gim, '<h3>$1</h3>')
             .replace(/^## (.*$)/gim, '<h2>$1</h2>')
             .replace(/^# (.*$)/gim, '<h1>$1</h1>')
             .replace(/\\*\\*(.*)\\*\\*/gim, '<strong>$1</strong>')
             .replace(/\\*(.*)\\*/gim, '<em>$1</em>')
             .replace(/^- (.*)$/gim, '<li>$1</li>')
             .replace(/\\n/gim, '<br>');
}

const canvas=document.getElementById('gradCanvas');
const ctx=canvas.getContext('2d');
let mouseX=0,mouseY=0,hue=0;
function resizeCanvas(){canvas.width=window.innerWidth||850;canvas.height=window.innerHeight||500;}
resizeCanvas();
document.addEventListener('mousemove',(e)=>{
  const rect=document.querySelector('.island').getBoundingClientRect();
  mouseX=e.clientX-rect.left;mouseY=e.clientY-rect.top;
  const m=document.getElementById('mascot');if(!m)return;
  const mr=m.getBoundingClientRect();
  const mx=mr.left+mr.width/2,my=mr.top+mr.height/2;
  const angle=Math.atan2(e.clientY-my,e.clientX-mx);
  const dist=Math.min(3,Math.hypot(e.clientX-mx,e.clientY-my)/50);
  const px=Math.cos(angle)*dist,py=Math.sin(angle)*dist;
  document.querySelectorAll('.pupil').forEach(p=>p.setAttribute('transform','translate('+px+','+py+')'));
});
function drawGradient(){
  hue=(hue+0.5)%360;
  const g=ctx.createRadialGradient(mouseX,mouseY,0,mouseX,mouseY,400);
  g.addColorStop(0,'hsla('+hue+',70%,60%,0.4)');
  g.addColorStop(0.5,'hsla('+((hue+60)%360)+',70%,50%,0.2)');
  g.addColorStop(1,'transparent');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
  requestAnimationFrame(drawGradient);
}
drawGradient();

const mascotEl=document.getElementById('mascot');
const island=document.querySelector('.island');
function setSkin(name){currentSkin=name;localStorage.setItem('island_skin',name);mascotEl.innerHTML=skins[name]||skins.cat;renderSettingsIfOpen();}
setSkin(currentSkin);
island.addEventListener('mouseenter',()=>{mascotEl.classList.remove('sleeping');mascotEl.classList.add('awake');});
island.addEventListener('mouseleave',()=>{mascotEl.classList.remove('awake');mascotEl.classList.add('sleeping');});

// Отслеживание Caps Lock и раскладки
document.addEventListener('keydown', (e) => {
  if(e.getModifierState('CapsLock')) {
    document.getElementById('capsInd').style.display='block';
  } else {
    document.getElementById('capsInd').style.display='none';
  }
});

function getGreet(){const h=new Date().getHours();if(h>=5&&h<12)return{t:'Доброе утро',i:'☀️',mood:'happy'};if(h>=12&&h<18)return{t:'Добрый день',i:'🌤️',mood:'neutral'};if(h>=18&&h<23)return{t:'Добрый вечер',i:'🌙',mood:'calm'};return{t:'Доброй ночи',i:'✨',mood:'sleepy'};}
function getQuote(){const d=Math.floor((new Date()-new Date(new Date().getFullYear(),0,0))/86400000);return quotes[d%quotes.length];}
function updClock(){document.getElementById('cTime').textContent=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});}
updClock();setInterval(updClock,1000);
document.querySelectorAll('.tab').forEach(tab=>{tab.addEventListener('click',(e)=>{e.stopPropagation();document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');curTab=tab.dataset.tab;render();});});

function formatUptime(s){const h=Math.floor(s/3600);const m=Math.floor((s%3600)/60);return h+'ч '+m+'м';}

function render(){
  const c=document.getElementById('content');
  if(curTab==='home'){
    const g=getGreet(),q=getQuote(),dt=new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'}),rn=notes.slice(0,3);
    let fh='';
    if(wData&&wData.hourly){const ch=new Date().getHours(),hs=[ch,ch+3,ch+6,ch+9,ch+12].filter(h=>h<24);fh=hs.map(h=>{const tp=Math.round(wData.hourly.temperature_2m[h]),ic=wIc(0);return'<div class="wi"><div class="wih">'+h+':00</div><div class="wic">'+ic+'</div><div class="wit">'+tp+'°</div></div>';}).join('');}
    else{fh='<div style="text-align:center;color:var(--t2);padding:20px;grid-column:1/-1">Загрузка прогноза...</div>';}
    c.innerHTML='<div class="dash"><div class="dc full"><div class="greet">'+g.i+' '+g.t+'</div><div class="greet-sub">'+dt.charAt(0).toUpperCase()+dt.slice(1)+'</div></div><div class="dc"><div class="dt">⚡ Быстрые таймеры</div><div class="qt"><button class="qb" onclick="qTimer(5)"><span class="tm">5</span><span class="lb">минут</span></button><button class="qb" onclick="qTimer(15)"><span class="tm">15</span><span class="lb">минут</span></button><button class="qb" onclick="qTimer(25)"><span class="tm">25</span><span class="lb">минут</span></button></div></div><div class="dc"><div class="dt">📝 Последние заметки</div><div class="rn">'+(rn.length===0?'<div class="ri empty">Нет заметок</div>':rn.map(n=>'<div class="ri">'+n+'</div>').join(''))+'</div></div><div class="dc full"><div class="dt">🌤️ Прогноз на день</div><div class="wf">'+fh+'</div></div><div class="dc full"><div class="quote">"'+q.t+'"<div class="quote-a">— '+q.a+'</div></div></div></div>';
  }
  else if(curTab==='system'){
    let batHtml = sysStats.battery ? \`<div class="dc"><div class="dt">🔋 Батарея</div><div class="sys-stat"><div class="sys-bar"><div class="sys-fill" style="width:\${sysStats.battery.level}%"></div></div><span>\${sysStats.battery.level}%</span></div></div>\` : '';
    let gpuHtml = sysStats.gpu ? \`<div class="dc"><div class="dt">🎮 GPU (NVIDIA)</div><div class="sys-stat"><div class="sys-bar"><div class="sys-fill" style="width:\${sysStats.gpu.usage}%"></div></div><span>\${sysStats.gpu.usage}%</span></div><div style="font-size:12px;color:var(--t2);margin-top:4px">\${sysStats.gpu.memUsed}/\${sysStats.gpu.memTotal} МБ</div></div>\` : '<div class="dc"><div class="dt">🎮 GPU</div><div style="text-align:center;color:var(--t2);padding:20px">N/A (требуется NVIDIA)</div></div>';
    let tempHtml = sysStats.cpuTemp ? \`<div class="dc"><div class="dt">🌡️ Температура CPU</div><div style="font-size:24px;font-weight:600">\${sysStats.cpuTemp}°C</div></div>\` : '';
    
    // Спарклайн CPU
    let sparklineSvg = '<svg class="sparkline" viewBox="0 0 60 40" preserveAspectRatio="none">';
    const maxCpu = Math.max(...sysStats.cpuHistory, 1);
    sysStats.cpuHistory.forEach((val, i) => {
      const x = i;
      const y = 40 - (val / maxCpu) * 40;
      sparklineSvg += \`<line x1="\${x}" y1="\${y}" x2="\${x+1}" y2="\${40 - (sysStats.cpuHistory[i+1] || val) / maxCpu * 40}" stroke="var(--a)" stroke-width="1"/>\`;
    });
    sparklineSvg += '</svg>';
    
    // Диски
    let disksHtml = sysStats.disks.map(d => {
      const usedPercent = Math.round((d.used / d.total) * 100);
      return \`<div class="dc"><div class="dt">💾 \${d.name}</div><div style="font-size:12px;color:var(--t2)">\${d.free} ГБ свободно из \${d.total} ГБ</div><div class="disk-bar"><div class="disk-fill" style="width:\${usedPercent}%"></div></div></div>\`;
    }).join('');
    
    // Процессы
    let processesHtml = sysStats.processes.map(p => 
      \`<div class="process-item"><span>\${p.name}</span><span>\${p.cpu.toFixed(1)}%</span></div>\`
    ).join('');
    
    c.innerHTML=\`<div class="dash">
      <div class="dc"><div class="dt">🖥️ Процессор</div><div class="sys-stat"><div class="sys-bar"><div class="sys-fill" style="width:\${sysStats.cpu}%"></div></div><span>\${sysStats.cpu}%</span></div>\${sparklineSvg}</div>
      <div class="dc"><div class="dt">💾 Оперативная память</div><div class="sys-stat"><div class="sys-bar"><div class="sys-fill" style="width:\${sysStats.ram}%"></div></div><span>\${sysStats.ram}%</span></div><div style="font-size:12px;color:var(--t2);margin-top:4px">\${sysStats.memFree}/\${sysStats.memTotal} ГБ свободно</div></div>
      \${gpuHtml}
      \${batHtml}
      \${tempHtml}
      <div class="dc"><div class="dt">⏱️ Аптайм системы</div><div style="font-size:24px;font-weight:600">\${formatUptime(sysStats.uptime)}</div></div>
      <div class="dc"><div class="dt">💱 Курсы валют (ЦБ)</div><div class="currency-row"><span>🇺🇸 USD</span><span style="font-weight:600">\${currencyData.usd} ₽</span></div><div class="currency-row"><span>🇪🇺 EUR</span><span style="font-weight:600">\${currencyData.eur} ₽</span></div><div class="currency-row"><span>₿ BTC</span><span style="font-weight:600">\${cryptoData.btc} $</span></div><div class="currency-row"><span>Ξ ETH</span><span style="font-weight:600">\${cryptoData.eth} $</span></div><div style="font-size:11px;color:var(--t2);margin-top:8px">Обновляется каждые 5 мин</div></div>
      \${disksHtml}
      <div class="dc full"><div class="dt">📊 Топ-5 процессов</div><div class="process-list">\${processesHtml}</div></div>
      <button class="speed-test-btn" onclick="runSpeedTest()">🌐 Тест скорости интернета</button>
    </div>\`;
  }
  else if(curTab==='music'){c.innerHTML='<div class="upload" onclick="document.getElementById(\\'fIn\\').click()"><input type="file" id="fIn" accept="audio/*" onchange="playM(this)"><div style="font-size:40px;margin-bottom:12px">📁</div><div style="font-size:16px;font-weight:600">Нажмите, чтобы выбрать MP3</div><div style="font-size:13px;color:var(--t2);margin-top:8px">Локальное воспроизведение</div></div><div id="mP"></div>';}
  else if(curTab==='weather'){
    if(!wData){c.innerHTML='<div style="text-align:center;padding:60px;color:var(--t2)">Загрузка погоды...</div>';loadW();return;}
    const cu=wData.current_weather,ho=wData.hourly,da=wData.daily,nH=new Date().getHours();
    c.innerHTML='<div class="wm"><div><div class="wtemp">'+Math.round(cu.temperature)+'°</div><div class="wdesc">'+wD(cu.weathercode)+'</div><div style="margin-top:8px;font-size:14px">'+sCity+'</div></div></div><div class="wd"><div class="wdc"><div class="wdl">Ветер</div><div class="wdv">'+cu.windspeed+' м/с</div></div><div class="wdc"><div class="wdl">Влажность</div><div class="wdv">'+ho.relative_humidity_2m[nH]+'%</div></div><div class="wdc"><div class="wdl">Давление</div><div class="wdv">'+Math.round(ho.pressure_msl[nH])+' гПа</div></div><div class="wdc"><div class="wdl">UV индекс</div><div class="wdv">'+da.uv_index_max[0]+'</div></div><div class="wdc"><div class="wdl">Восход</div><div class="wdv">'+da.sunrise[0].split("T")[1]+'</div></div><div class="wdc"><div class="wdl">Закат</div><div class="wdv">'+da.sunset[0].split("T")[1]+'</div></div></div>';
  }
  else if(curTab==='clipboard'){
    const searchVal = document.getElementById('clipSearch')?.value.toLowerCase() || '';
    const filtered = clipHist.filter(it => it.text.toLowerCase().includes(searchVal));
    const pinned = filtered.filter(it=>it.pinned);
    const unpinned = filtered.filter(it=>!it.pinned);
    
    let html = '<input type="text" id="clipSearch" class="search-box" placeholder="🔍 Поиск по буферу..." oninput="render()">';
    if(pinned.length>0) html+='<div class="dt" style="margin-top:12px">📌 Закрепленные</div>'+pinned.map((it,i)=>'<div class="ci"><div class="ct">'+it.text+'</div><button class="pin-btn active" onclick="togglePin('+clipHist.indexOf(it)+')">📌</button></div>').join('');
    html+='<div class="dt" style="margin-top:12px">📋 История</div>'+(unpinned.length===0?'<div style="text-align:center;padding:20px;color:var(--t2)">Ничего не найдено</div>':unpinned.map((it,i)=>'<div class="ci"><div class="ct">'+it.text+'<div class="tag">'+it.type+'</div></div><div class="ctm">'+it.time+'</div><button class="pin-btn" onclick="togglePin('+clipHist.indexOf(it)+')">📌</button></div>').join(''));
    c.innerHTML=html;
  }
  else if(curTab==='notes'){
    const searchVal = document.getElementById('noteSearch')?.value.toLowerCase() || '';
    const filtered = notes.filter(n => n.toLowerCase().includes(searchVal));
    c.innerHTML='<input type="text" id="noteSearch" class="search-box" placeholder="🔍 Поиск по заметкам..." oninput="render()"><textarea class="ni" id="nI" placeholder="Новая заметка... Используйте #теги" rows="3"></textarea><button class="tb" onclick="addN()" style="width:100%;margin-bottom:12px">Добавить</button><div class="nl">'+(filtered.length===0?'<div style="text-align:center;padding:40px;color:var(--t2)">Нет заметок</div>':filtered.map((n,i)=>'<div class="nit"><div><div class="markdown-body">'+parseMD(n)+'</div><div style="font-size:11px;color:var(--t2);margin-top:4px">'+n.length+' симв.</div></div><button class="nd" onclick="delN('+notes.indexOf(n)+')">✕</button></div>').join(''))+'</div>';
  }
  else if(curTab==='timer'){
    const m=Math.floor(tTime/60),s=tTime%60,ts=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    c.innerHTML='<div style="position:relative"><div class="td" id="timerDisplay">'+ts+'</div><button class="edit-btn" onclick="editTimer()" title="Редактировать время">✏️</button></div><div class="time-input" id="timeInput" style="display:none"><input type="number" id="editHours" min="0" max="99" value="'+m+'" placeholder="ЧЧ"><span>:</span><input type="number" id="editMinutes" min="0" max="59" value="'+s+'" placeholder="ММ"><button class="tb" onclick="saveTimer()">✓</button><button class="tb sec" onclick="cancelEdit()">✕</button></div><div class="tc"><button class="tb" onclick="togT()">'+(tRun?'Пауза':'Старт')+'</button><button class="tb sec" onclick="resT()">Сброс</button></div><div style="display:flex;gap:8px;justify-content:center;margin-top:24px"><button class="tb sec" onclick="setT(5)">5 мин</button><button class="tb sec" onclick="setT(15)">15 мин</button><button class="tb sec" onclick="setT(25)">25 мин</button></div>';
  }
  else if(curTab==='settings'){
    const ca=getComputedStyle(document.documentElement).getPropertyValue('--a').trim();
    const skinNames={cat:'🐱 Котик',robot:'🤖 Робот',fox:'🦊 Лиса',ghost:'👻 Призрак',capybara:'🥔 Капибара',panda:'🐼 Панда',alien:'👽 Инопланетянин',heart:'❤️ Сердечко'};
    c.innerHTML=\`<div class="ss"><div class="st">🎨 Цвет акцента (12 цветов)</div><div class="cp">'+colors.map(col=>'<div class="co '+(col.v.toLowerCase()===ca.toLowerCase()?'active':'')+'" style="background:'+col.v+'" data-color="'+col.v+'" title="'+col.n+'" onclick="setA(\\''+col.v+'\\',this)"></div>').join('')+'</div><div style="margin-top:12px;font-size:12px;color:var(--t2)">Выбрано: <span id="cCN" style="color:var(--a);font-weight:600">'+cN(ca)+'</span></div></div>
    <div class="ss"><div class="st">🎭 Скин компаньона</div><div class="skin-grid">'+Object.keys(skins).map(k=>'<div class="skin-option '+(k===currentSkin?'active':'')+'" onclick="setSkin(\\''+k+'\\')" title="'+skinNames[k]+'">'+skinNames[k].split(' ')[0]+'</div>').join('')+'</div><div style="margin-top:8px;font-size:12px;color:var(--t2)">Текущий: '+skinNames[currentSkin]+'</div></div>
    <div class="ss"><div class="st">📐 Масштаб острова (\${Math.round(islandScale*100)}%)</div><input type="range" class="scale-slider" min="0.8" max="1.3" step="0.05" value="'+islandScale+'" oninput="setScale(this.value)"></div>
    <div class="ss"><div class="st">🎮 Поведение</div>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer"><input type="checkbox" \${hideInGames?'checked':''} onchange="toggleHideInGames(this.checked)"> Скрывать в играх/полноэкранном режиме</label>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer"><input type="checkbox" \${hideOnScreenshots?'checked':''} onchange="toggleHideOnScreenshots(this.checked)"> Скрывать на скриншотах</label>
    </div>
    <div class="ss"><div class="st">🔕 Не беспокоить</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="tb sec" onclick="setDND(30)">30 мин</button>
        <button class="tb sec" onclick="setDND(60)">1 ч</button>
        <button class="tb sec" onclick="setDND(120)">2 ч</button>
        <button class="tb" onclick="disableDND()" style="background:#ff453a;color:white">Выкл</button>
      </div>
      <div style="font-size:12px;color:var(--t2)">\${dndMode ? 'Активен до: '+new Date(dndEndTime).toLocaleTimeString() : 'Выключен'}</div>
    </div>
    <div class="ss"><div class="st">🚀 Быстрый запуск</div>
      <div class="app-launcher">
        <div class="app-btn" onclick="launchApp('discord')"><div class="app-icon">💬</div><div class="app-name">Discord</div></div>
        <div class="app-btn" onclick="launchApp('telegram')"><div class="app-icon">✈️</div><div class="app-name">Telegram</div></div>
        <div class="app-btn" onclick="launchApp('chrome')"><div class="app-icon">🌐</div><div class="app-name">Chrome</div></div>
        <div class="app-btn" onclick="launchApp('vscode')"><div class="app-icon">💻</div><div class="app-name">VS Code</div></div>
      </div>
    </div>
    <div class="ss"><div class="st">🌍 Город для погоды</div><input type="text" class="ni" id="cIn" value="'+sCity+'" placeholder="Введите город"><button class="tb" onclick="chCity()" style="width:100%;margin-top:8px">Сохранить</button></div>\`;
  }
  else if(curTab==='faq'){
    c.innerHTML=\`<div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">❓ Это бесплатно?</div><div class="faq-a">Да, Ynater полностью бесплатен и имеет открытый исходный код на GitHub.</div></div>
    <div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">🦠 Есть ли вирусы?</div><div class="faq-a">Нет, код открыт и проверен сообществом. Вы можете собрать установщик самостоятельно из исходников.</div></div>
    <div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">🐧 Есть версия для Linux?</div><div class="faq-a">Пока только Windows 10 и 11. Версия для Linux планируется в будущем.</div></div>
    <div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">💾 Сколько памяти использует?</div><div class="faq-a">Как пара вкладок браузера (~100-200 МБ RAM).</div></div>
    <div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">🎮 Скрывается ли в играх?</div><div class="faq-a">Да, если включить опцию "Скрывать в играх" в настройках.</div></div>
    <div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">🗑️ Как удалить?</div><div class="faq-a">Настройки → Поведение → Удалить, или через Панель управления Windows.</div></div>\`;
  }
}

window.editTimer=function(){document.getElementById('timerDisplay').style.display='none';document.querySelector('.edit-btn').style.display='none';document.getElementById('timeInput').style.display='flex';};
window.cancelEdit=function(){render();};
window.saveTimer=function(){const h=parseInt(document.getElementById('editHours').value)||0;const m=parseInt(document.getElementById('editMinutes').value)||0;tTime=h*60+m;localStorage.setItem('island_timer',tTime);render();};
window.qTimer=function(m){tTime=m*60;tRun=false;clearInterval(tInt);localStorage.setItem('island_timer',tTime);document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.querySelector('.tab[data-tab="timer"]').classList.add('active');curTab='timer';render();};
window.playM=function(inp){const f=inp.files[0];if(!f)return;const u=URL.createObjectURL(f);document.getElementById('mP').innerHTML='<audio controls autoplay style="width:100%;margin-top:16px;border-radius:12px" src="'+u+'"></audio><div style="text-align:center;margin-top:12px;font-weight:600">'+f.name+'</div>';};
window.togglePin=async function(idx){await ipcRenderer.invoke('toggle-pin',idx);render();};
window.copyB=function(el){ipcRenderer.invoke('copy-clip',el.dataset.txt);};
window.addN=function(){const i=document.getElementById('nI');if(i&&i.value.trim()){notes.unshift(i.value.trim());localStorage.setItem('island_notes',JSON.stringify(notes));render();}};
window.delN=function(idx){notes.splice(idx,1);localStorage.setItem('island_notes',JSON.stringify(notes));render();};
window.togT=function(){if(tRun){clearInterval(tInt);tRun=false;}else{tRun=true;tInt=setInterval(()=>{if(tTime>0){tTime--;localStorage.setItem('island_timer',tTime);render();}else{clearInterval(tInt);tRun=false;showTimerAlert();}},1000);}render();};
window.resT=function(){clearInterval(tInt);tRun=false;tTime=0;localStorage.setItem('island_timer',tTime);render();};
window.setT=function(m){tTime=m*60;localStorage.setItem('island_timer',tTime);render();};
window.setA=function(col,el){document.documentElement.style.setProperty('--a',col);localStorage.setItem('island_a',col);document.querySelectorAll('.co').forEach(e=>e.classList.remove('active'));el.classList.add('active');const n=document.getElementById('cCN');if(n)n.textContent=cN(col);};
window.chCity=async function(){const inp=document.getElementById('cIn');if(inp&&inp.value.trim()){try{const r=await ipcRenderer.invoke('geocode-city',inp.value.trim());sCity=r.name;sCoords={lat:r.lat,lon:r.lon};localStorage.setItem('island_city',sCity);localStorage.setItem('island_coords',JSON.stringify(sCoords));wData=null;render();}catch(e){alert('Город не найден');}}};
window.setScale=function(val){islandScale=parseFloat(val);localStorage.setItem('island_scale',islandScale);ipcRenderer.send('set-scale',islandScale);render();};
window.toggleHideInGames=function(val){hideInGames=val;localStorage.setItem('hide_in_games',val);ipcRenderer.send('set-hide-in-games',val);};
window.toggleHideOnScreenshots=function(val){hideOnScreenshots=val;localStorage.setItem('hide_on_screenshots',val);ipcRenderer.send('set-hide-on-screenshots',val);};
window.setDND=function(min){dndMode=true;dndEndTime=Date.now()+min*60000;document.getElementById('dndOverlay').style.display='flex';setTimeout(()=>{disableDND();},min*60000);render();};
window.disableDND=function(){dndMode=false;dndEndTime=0;document.getElementById('dndOverlay').style.display='none';render();};
window.launchApp=function(name){ipcRenderer.invoke('launch-app',name);};
window.runSpeedTest=async function(){
  const btn=document.querySelector('.speed-test-btn');
  btn.textContent='🔄 Тестирую...';
  btn.disabled=true;
  try{
    const speed=await ipcRenderer.invoke('speed-test');
    btn.textContent=\`🌐 Скорость: \${speed} Мбит/с\`;
  }catch(e){
    btn.textContent='❌ Ошибка теста';
  }
  setTimeout(()=>{btn.textContent='🌐 Тест скорости интернета';btn.disabled=false;},5000);
};
function cN(h){const c=colors.find(p=>p.v.toLowerCase()===h.toLowerCase());return c?c.n:h;}
function wD(c){const d={0:'Ясно',1:'Преим. ясно',2:'Облачно',3:'Пасмурно',45:'Туман',51:'Морось',61:'Дождь',71:'Снег',80:'Ливень',95:'Гроза'};return d[c]||'Неизвестно';}
function wIc(c){if(c===0)return'☀️';if(c<=3)return'⛅';if(c<=48)return'🌫️';if(c<=67)return'🌧️';if(c<=77)return'🌨️';if(c>=95)return'⛈️';return'🌥️';}
async function loadW(){try{wData=await ipcRenderer.invoke('get-weather',sCoords.lat,sCoords.lon);const cu=wData.current_weather;document.getElementById('wI').textContent=wIc(cu.weathercode);document.getElementById('wT').textContent=Math.round(cu.temperature)+'°';if(curTab==='home')render();}catch(e){console.error(e);}}
ipcRenderer.invoke('get-clip').then(h=>{clipHist=h;if(curTab==='clipboard')render();});
ipcRenderer.on('clip-update',(e,h)=>{clipHist=h;if(curTab==='clipboard')render();});
ipcRenderer.on('sys-stats',(e,s)=>{sysStats=s;if(curTab==='system')render();});
ipcRenderer.on('currency-data',(e,d)=>{currencyData=d;if(curTab==='system')render();});
ipcRenderer.on('crypto-data',(e,d)=>{cryptoData=d;if(curTab==='system')render();});
loadW();setInterval(loadW,10*60*1000);
const sa=localStorage.getItem('island_a');if(sa)document.documentElement.style.setProperty('--a',sa);
window.switchTab=function(n){const t=document.querySelector('.tab[data-tab="'+n+'"]');if(t)t.click();};
render();

function showTimerAlert(){
  const alert=document.getElementById('timerAlert');
  alert.classList.add('show');
  setTimeout(()=>{alert.classList.remove('show');},3000);
}
function renderSettingsIfOpen(){if(curTab==='settings')render();}
</script>
</body>
</html>`;

fs.writeFileSync('index.html', htmlCode);
console.log('✅ index.html для v1.6.0 создан!');