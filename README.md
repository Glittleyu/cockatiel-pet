# 🐦 玄凤桌面宠物（Cockatiel Pet）

一只可爱的玄凤鹦鹉“小玄”，像经典 QQ 宠物一样陪伴你的桌面。

![version](https://img.shields.io/badge/version-1.0.0-blue) ![Electron](https://img.shields.io/badge/Electron-28.x-47848F) ![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 功能特性

### 🎨 动画系统
- **6 种动画状态**：待机呼吸、扇翅、理毛、啄食、撒娇、睡觉
- **平滑切换**：有限状态机管理，用户交互立即打断当前动画
- **基于设计图**：使用你提供的参考图生成透明素材，并补充程序动画

### 🖱️ 交互功能
- **右键菜单**：喂食、喂水、去休息、查看状态
- **抚摸头部**：左键点击头部触发撒娇动画 + 爱心特效 + 提升好感度
- **点击身体**：宠物会轻轻回应
- **双击**：触发惊喜特效
- **拖拽移动**：按住窗口任意位置自由拖动
- **系统托盘**：最小化到托盘，不占用任务栏

### 📊 状态养成
- **五大属性**：饱腹度、口渴值、开心度、精力值、好感度
- **自动衰减**：每 30 秒按规则消耗属性
- **智能提示**：低属性时弹出气泡提醒
- **强制休息**：精力耗尽自动进入睡眠

## 🚀 快速开始

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装与运行

```bash
cd cockatiel-pet
npm install
npm start
```

在 Linux 无桌面环境或 CI 中，可用 xvfb 运行：

```bash
xvfb-run --auto-servernum --server-args="-screen 0 1024x768x24" npm start -- --no-sandbox
```

### 📦 下载可执行文件（Windows）

已发布 Windows 便携版，无需安装，解压后双击 `玄凤桌面宠物.exe` 即可运行：

> [玄凤桌面宠物 v1.0.0（Windows 便携版）](https://github.com/Glittleyu/cockatiel-pet/releases/download/v1.0.0/cockatiel-pet-1.0.0-win.zip)

### 🛠️ 自行打包

项目使用 electron-builder，已配置 NSIS 安装包与便携目录两种目标。

```bash
npm install
npm run dist:win        # 生成 Windows NSIS 安装包（需在本机 Windows 或装有 wine 的环境）
npm run dist:win:dir    # 仅生成未打包目录 dist/win-unpacked（跨平台可用）
```

> 注：在 Linux 上若未安装 wine，NSIS 安装包（`--win nsis`）无法生成签名与打包步骤；
> 但 `--win --dir` / `--win zip` 可正常产出可直接运行的 Windows 可执行程序。

## 📖 操作说明

| 操作 | 效果 |
|------|------|
| 右键点击宠物 | 打开交互菜单（睡眠时显示"唤醒"） |
| 左键点击头部 | 抚摸 → 撒娇动画 + 好感度 +5；若正在睡觉则立即唤醒 |
| 左键点击身体 | 轻微反馈 + 开心度 +2；若正在睡觉则立即唤醒 |
| 双击宠物 | 惊喜特效 + 开心度 +10；若正在睡觉则立即唤醒 |
| 喂食 / 喂水 | 若正在睡觉会先唤醒，再继续喂食/喂水 |
| 按住拖拽 | 移动窗口位置；拖动时暂停呼吸动画，显示抓握动画 |
| 托盘图标右键 | 显示 / 隐藏 / 退出 |

> 💡 **睡觉唤醒**：宠物休息时，点击身体/头部、双击、喂食、喂水都会让它立刻起床；右键菜单也会出现"唤醒"选项。只有"查看状态"不会打扰它休息。

## 🛠️ 项目结构

```
cockatiel-pet/
├── main.js              # Electron 主进程
├── preload.js           # 安全预加载脚本
├── package.json         # 项目配置
├── assets/              # 透明处理后的宠物素材
│   ├── idle.png         # 待机 / 撒娇 / 扇翅 / 理毛基础图
│   ├── eat.png          # 啄食 / 进食图
│   └── sleep.png        # 睡觉图
├── assets/raw/          # 原始参考图（你上传的图片）
├── src/
│   ├── renderer.html    # 渲染页面
│   ├── renderer.js      # 渲染逻辑、状态机、交互
│   └── styles.css       # 透明窗口与动画样式
├── scripts/
│   ├── remove_bg.py     # 去除参考图背景
│   └── test-run.sh      # 虚拟显示下启动测试
└── README.md
```

## 🧪 测试截图

项目包含一个自动截图脚本，用于在虚拟显示环境中验证界面：

```bash
scripts/test-run.sh
```

截图会保存在 `test-screenshot.png`，随后进程自动退出。

## 📝 属性规则

### 每 30 秒衰减
- **活跃状态**：饱腹度 -2、口渴值 -3、精力值 -1.5
- **睡眠状态**：精力值 +5（恢复），其他属性缓慢下降

### 特殊机制
- 饱腹度 < 25% → 饥饿提示，开心度下降
- 口渴值 < 25% → 口渴提示
- 精力值 < 20% → 强制进入睡眠

### 交互加成
- 喂食：饱腹度 +25，开心度 +5，好感度 +3
- 喂水：口渴值 +35，开心度 +3，好感度 +3
- 抚摸：开心度 +8，好感度 +5

## 📦 打包

如需打包为可执行文件，可安装 electron-builder：

```bash
npm install --save-dev electron-builder
npm run dist
```

（需在 package.json 中配置 build 字段）

## 🐣 享受与小玄的桌面时光

如有建议或想要添加新动画，欢迎继续完善~
