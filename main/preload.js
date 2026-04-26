const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Model management
  downloadModel: (modelName) => ipcRenderer.invoke('download-model', modelName),
  listModels: () => ipcRenderer.invoke('list-models'),
  
  // Transcription
  transcribe: (audioBuffer, config) => ipcRenderer.invoke('transcribe', audioBuffer, config),
  
  // YouTube via cobalt
  fetchYouTubeAudio: (url) => ipcRenderer.invoke('cobalt-fetch', url),
  
  // File operations
  saveFile: (content, filename, type) => ipcRenderer.invoke('save-file', content, filename, type),
  
  // Clipboard
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard-write', text),
  
  // System
  getPlatform: () => process.platform,
  checkWebGPUSupport: () => ipcRenderer.invoke('check-webgpu')
});
