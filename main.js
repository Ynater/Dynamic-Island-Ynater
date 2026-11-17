const { app, BrowserWindow, screen, ipcMain, globalShortcut, clipboard, nativeImage } = require('electron');
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
          const lines = stdout.trim().split('\n');
          if(lines.length > 1) {
            const parts = lines[1].trim().split(/\s+/);
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
      exec('wmic /namespace:\\\\root\\wmi PATH MSAcpi_ThermalZoneTemperature get CurrentTemperature', (err, stdout) => {
        if(!err && stdout) {
          const lines = stdout.trim().split('\n');
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
          const lines = stdout.trim().split('\n').slice(1);
          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
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
          const lines = stdout.trim().split('\n').slice(3);
          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
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
      https.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|ru`, {rejectUnauthorized:false}, (r) => {
        let d=''; r.on('data', c=>d+=c); r.on('end', ()=>{ 
          try{ resolve(JSON.parse(d).responseData.translatedText); }catch(err){ reject(err); } 
        });
      }).on('error', reject);
    });
  });

  // Запуск приложений
  ipcMain.handle('launch-app', (e, appName) => {
    const apps = {
      'discord': `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Discord\\Update.exe --processStart Discord.exe`,
      'telegram': 'C:\\Program Files (x86)\\Telegram Desktop\\Telegram.exe',
      'chrome': 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'vscode': `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe`
    };
    if(apps[appName.toLowerCase()]) {
      exec(`start /B "${apps[appName.toLowerCase()]}"`, (err) => { if(err) console.error(err); });
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
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });