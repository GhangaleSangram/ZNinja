const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Invokes the 'get-system-audio-sources' handler inside the main process
  getSystemAudioSources: () => ipcRenderer.invoke('get-system-audio-sources')
});
