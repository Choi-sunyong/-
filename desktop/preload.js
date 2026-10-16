// 웹 페이지(싯다르타)에 'window.sdt'로 한글 조종 기능을 열어 줌
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sdt', {
  desktop: true,
  hwp: (cmd, args) => ipcRenderer.invoke('hwp', cmd, args || {})
});
