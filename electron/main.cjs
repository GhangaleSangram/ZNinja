const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      // Point this to your preload script to safely bridge communication
      preload: path.join(__dirname, 'preload.cjs'), 
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load your app entry file (adjust path if using a build directory like 'dist/index.html')
  mainWindow.loadFile('index.html'); 
}

app.whenReady().then(() => {
  // Handle the frontend request to fetch system media sources
  ipcMain.handle('get-system-audio-sources', async () => {
    // We request 'screen' types because system-wide audio is tied to desktop screen loops
    return await desktopCapturer.getSources({ types: ['screen', 'window'] });
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
