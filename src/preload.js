const { contextBridge, ipcRenderer, webUtils } = require('electron');
const allowed = new Set(['auth:changed', 'state:changed', 'agent:chunk', 'agent:permission', 'provider:health', 'app:error', 'notification:sound', 'speech:result']);
contextBridge.exposeInMainWorld('kairo', {
  request: async (operation, payload) => {
    const response = await ipcRenderer.invoke('kairo:request', { operation, payload });
    if (!response.ok) throw new Error(response.error);
    return response.value;
  },
  attachDroppedFiles: async files => {
    const paths = Array.from(files, file => webUtils.getPathForFile(file)).filter(Boolean);
    const response = await ipcRenderer.invoke('kairo:drop', paths);
    if (!response.ok) throw new Error(response.error);
    return response.value;
  },
  on: (channel, callback) => {
    if (!allowed.has(channel)) throw new Error('Unsupported event.');
    const listener = (_event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
