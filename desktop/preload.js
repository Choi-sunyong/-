// 웹 페이지(싯다르타)에 'window.sdt'로 PC 기능을 열어 줌 (기본 통로만 — 실제 동작은 웹과 hwp.ps1에서 정함)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sdt', {
  desktop: true,
  api: 3,
  hwp: (cmd, args) => ipcRenderer.invoke('hwp', cmd, args || {}),
  win: (cmd, args) => ipcRenderer.invoke('win', cmd, args || {}),
  helper: () => ipcRenderer.invoke('helper'),
  ai: (cmd, args) => ipcRenderer.invoke('ai', cmd, args || {})
});
