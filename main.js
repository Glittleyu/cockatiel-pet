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
        // 1. 进入睡眠状态
        mainWindow.webContents.send('action', 'sleep');
        setTimeout(() => {
          // 2. 打开状态面板
          mainWindow.webContents.send('action', 'status');
          setTimeout(() => {
            mainWindow.capturePage().then((image) => {
              const fs = require('fs');
              fs.writeFileSync(
                path.join(__dirname, 'test-sleep.png'),
                image.toPNG()
              );
              console.log('Saved test-sleep.png');

              // 3. 唤醒后继续截图
              mainWindow.webContents.send('action', 'wake');
              setTimeout(() => {
                mainWindow.capturePage().then((image2) => {
                  fs.writeFileSync(
                    path.join(__dirname, 'test-wakeup.png'),
                    image2.toPNG()
                  );
                  console.log('Saved test-wakeup.png');
                  setTimeout(() => app.quit(), 300);
                });
              }, 800);
            }).catch((err) => {
              console.error('Screenshot failed:', err);
              app.quit();
            });
          }, 800);
        }, 1200);
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
let currentSleeping = false;

ipcMain.on('state-changed', (event, sleeping) => {
  currentSleeping = sleeping;
});

ipcMain.on('context-menu', (event) => {
  const template = [];

  if (currentSleeping) {
    template.push({
      label: '☀️ 唤醒',
      click: () => {
        mainWindow.webContents.send('action', 'wake');
      },
    });
  } else {
    template.push(
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
      }
    );
  }

  template.push(
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
    }
  );

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
