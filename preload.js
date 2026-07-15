const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 发送右键菜单请求
  showContextMenu: () => ipcRenderer.send('context-menu'),

  // 移动窗口
  moveWindow: (dx, dy) => ipcRenderer.send('move-window', { dx, dy }),

  // 同步当前状态（如睡眠）给主进程，用于更新菜单
  sendStateChanged: (sleeping) => ipcRenderer.send('state-changed', sleeping),

  // 监听主进程发送的动作
  onAction: (callback) => {
    const listener = (event, action) => callback(action);
    ipcRenderer.on('action', listener);
    return () => ipcRenderer.removeListener('action', listener);
  },
});
