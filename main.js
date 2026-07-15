const { app, BrowserWindow, Tray, Menu, ipcMain, screen } = require('electron');
const path = require('path');

// 保持全局引用，避免被 GC 回收
let mainWindow;
let tray;

const WINDOW_SIZE = 320;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    x: width - WINDOW_SIZE - 30,
    y: height - WINDOW_SIZE - 30,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    hasShadow: false,
    // 仅 macOS 需要，Windows/Linux 可忽略
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer.html'));

  // 测试截图：设置环境变量 COCKATIEL_SCREENSHOT=1 时启用
  if (process.env.COCKATIEL_SCREENSHOT) {
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        // 触发状态面板展示
        mainWindow.webContents.send('action', 'status');
        setTimeout(() => {
          mainWindow.capturePage().then((image) => {
            const fs = require('fs');
            fs.writeFileSync(
              path.join(__dirname, 'test-screenshot.png'),
              image.toPNG()
            );
            console.log('Screenshot saved to test-screenshot.png');
            // 截图后自动退出，方便 CI 测试
            setTimeout(() => app.quit(), 500);
          }).catch((err) => {
            console.error('Screenshot failed:', err);
            app.quit();
          });
        }, 800);
      }, 1500);
    });
  }

  // 开发调试：打开开发者工具
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // 使用一个内置图标作为托盘占位符
  const iconPath = path.join(__dirname, 'assets', 'idle.png');
  tray = new Tray(iconPath);
  tray.setToolTip('玄凤桌面宠物 小玄');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '隐藏',
      click: () => {
        if (mainWindow) mainWindow.hide();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 通信：右键菜单触发
ipcMain.on('context-menu', (event) => {
  const template = [
    {
      label: '🍚 喂食',
      click: () => {
        mainWindow.webContents.send('action', 'feed');
      },
    },
    {
      label: '💧 喂水',
      click: () => {
        mainWindow.webContents.send('action', 'water');
      },
    },
    {
      label: '🏠 去休息',
      click: () => {
        mainWindow.webContents.send('action', 'sleep');
      },
    },
    {
      label: '📊 查看状态',
      click: () => {
        mainWindow.webContents.send('action', 'status');
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  menu.popup();
});

// 窗口移动（拖拽）
ipcMain.on('move-window', (event, { dx, dy }) => {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  mainWindow.setBounds({
    x: bounds.x + dx,
    y: bounds.y + dy,
  });
});
