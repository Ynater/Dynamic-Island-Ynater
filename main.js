const { app, BrowserWindow, screen, ipcMain, globalShortcut, clipboard } = require('electron');
const https = require('https');
let win, isVisible = true, clipHist = [], lastClip = '';
app.whenReady().then(() => {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({ width: 850, height: 500, x: Math.round((width-850)/2), y: 0, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, webPreferences: { nodeIntegration: true, contextIsolation: false } });
  win.loadFile('index.html');
  globalShortcut.register('CommandOrControl+Space', () => { isVisible = !isVisible; isVisible ? win.show() : win.hide(); });
  setInterval(() => {
    try { const t = clipboard.readText();
      if (t && t !== lastClip && t.length > 0 && t.length < 500) {
        lastClip = t; clipHist.unshift({ text: t, time: new Date().toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'}) });
        if (clipHist.length > 20) clipHist.pop();
        if (win && !win.isDestroyed()) win.webContents.send('clip-update', clipHist);
      }
    } catch(e) {}
  }, 800);
  ipcMain.handle('get-clip', () => clipHist);
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
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
