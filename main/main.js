const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const ModelManager = require('./services/model-manager');
const AudioExtractor = require('./services/ffmpeg');
const CobaltService = require('./services/cobalt');

// Enable WebGPU before app ready
app.commandLine.appendSwitch('enable-unsafe-webgpu');

// Only enable Vulkan if not running on Wayland (Wayland + Vulkan causes issues)
if (process.env.XDG_SESSION_TYPE !== 'wayland' && !process.env.WAYLAND_DISPLAY) {
  app.commandLine.appendSwitch('enable-features', 'Vulkan');
} else {
  // On Wayland, use ANGLE/EGL instead of Vulkan
  app.commandLine.appendSwitch('use-angle', 'egl');
}

const modelManager = new ModelManager();
const audioExtractor = new AudioExtractor();
const cobalt = new CobaltService();

let mainWindow;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webgpu: true // Enable WebGPU in renderer
    }
  });
  
  win.loadFile('renderer/index.html');
}

// IPC Handlers
ipcMain.handle('download-model', async (event, modelName) => {
  return await modelManager.downloadModel(modelName, (progress) => {
    // Send progress updates to renderer
    mainWindow.webContents.send('download-progress', progress);
  });
});

ipcMain.handle('list-models', async () => {
  return await modelManager.listModels();
});

ipcMain.handle('cobalt-fetch', async (event, youtubeUrl) => {
  return await cobalt.fetchAudio(youtubeUrl);
});

ipcMain.handle('save-file', async (event, content, filename, type) => {
  const { dialog } = require('electron');
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename,
    filters: [{ name: type, extensions: [type.replace('.', '')] }]
  });
  
  if (!result.canceled && result.filePath) {
    const fs = require('fs').promises;
    await fs.writeFile(result.filePath, content);
    return { success: true, path: result.filePath };
  }
  return { success: false, canceled: true };
});

ipcMain.handle('clipboard-write', async (event, text) => {
  const { clipboard } = require('electron');
  clipboard.writeText(text);
  return { success: true };
});

ipcMain.handle('check-webgpu', async () => {
  // This will be handled in renderer via navigator.gpu
  return { supported: true };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
