// 玄凤桌面宠物 渲染进程核心逻辑

const ASSETS = {
  idle: '../assets/idle.png',
  eat: '../assets/eat.png',
  sleep: '../assets/sleep.png',
};

const STATES = {
  IDLE: 'idle',
  FLAP: 'flap',
  PREEN: 'preen',
  EAT: 'eat',
  PAMPER: 'pamper',
  SLEEP: 'sleep',
};

const STATE_CONFIG = {
  [STATES.IDLE]: { img: 'idle', animClass: 'breathing', minDuration: 3000, maxDuration: 8000 },
  [STATES.FLAP]: { img: 'idle', animClass: 'flapping', minDuration: 1500, maxDuration: 3000, showWings: true },
  [STATES.PREEN]: { img: 'idle', animClass: 'preening', minDuration: 2000, maxDuration: 4000 },
  [STATES.EAT]: { img: 'eat', animClass: 'eating', minDuration: 2000, maxDuration: 4000 },
  [STATES.PAMPER]: { img: 'idle', animClass: 'pampering', minDuration: 2000, maxDuration: 2500 },
  [STATES.SLEEP]: { img: 'sleep', animClass: 'sleeping', minDuration: 5000, maxDuration: 30000 },
};

const BUBBLES = {
  hungry: ['好饿呀~', '想吃饭饭~', '肚子咕咕叫...', '给我点吃的嘛'],
  thirsty: ['口渴了~', '想喝水水~', '喉咙干干的...', '来点水好不好'],
  tired: ['有点累了...', '想睡觉觉~', '眼皮好重...', '休息一下吧'],
  pamper: ['好舒服~', '最喜欢你了！', '好开心呀~', '再摸一下嘛'],
  feed: ['好吃！', '谢谢你！', '吃饱啦~', ' yummy~'],
  water: ['好喝！', '清爽~', '不渴啦~', '咕噜咕噜~'],
  sleep: ['晚安~', 'zzz...', '做个好梦~', '呼...'],
};

class Pet {
  constructor() {
    this.elements = {
      container: document.getElementById('pet-container'),
      image: document.getElementById('pet-image'),
      wingCanvas: document.getElementById('wing-canvas'),
      effects: document.getElementById('effects'),
      bubble: document.getElementById('speech-bubble'),
      statusPanel: document.getElementById('status-panel'),
      headZone: document.getElementById('head-zone'),
      bodyZone: document.getElementById('body-zone'),
    };

    this.wingCtx = this.elements.wingCanvas.getContext('2d');

    this.stats = {
      fullness: 80,
      thirst: 80,
      happiness: 80,
      energy: 80,
      affection: 50,
    };

    this.state = STATES.IDLE;
    this.stateTimer = null;
    this.lastDecayTime = Date.now();
    this.statusVisible = false;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };

    this.init();
  }

  init() {
    this.bindEvents();
    this.startAutoBehavior();
    this.startDecayLoop();
    this.updateStatusUI();
    this.showBubble('小玄来啦~', 2000);
    this.animateWings();
  }

  bindEvents() {
    const { container, headZone, bodyZone, image } = this.elements;

    // 右键菜单
    container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (window.electronAPI) {
        window.electronAPI.showContextMenu();
      }
    });

    // 拖拽移动
    container.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;
      if (window.electronAPI && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        window.electronAPI.moveWindow(dx, dy);
        this.dragStart = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // 头部点击 - 抚摸
    headZone.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isDragging) return;
      if (this.state === STATES.SLEEP) {
        this.wakeUp();
        return;
      }
      this.pamper();
    });

    // 身体点击 - 反馈
    bodyZone.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isDragging) return;
      if (this.state === STATES.SLEEP) {
        this.wakeUp();
        return;
      }
      this.showBubble('啾~', 1200);
      this.addStat('happiness', 2);
      this.addStat('affection', 1);
    });

    // 双击
    image.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (this.state === STATES.SLEEP) {
        this.wakeUp();
        return;
      }
      this.showBubble('双倍开心！❤️', 1500);
      this.addStat('happiness', 10);
      this.addStat('affection', 3);
      this.spawnEffect('✨', 6);
    });

    // 关闭状态面板
    document.getElementById('close-status').addEventListener('click', () => {
      this.toggleStatus(false);
    });

    // 监听主进程菜单动作
    if (window.electronAPI) {
      window.electronAPI.onAction((action) => this.handleAction(action));
    }
  }

  handleAction(action) {
    // 睡觉时：非查看/非睡眠操作先唤醒，再执行原动作
    if (this.state === STATES.SLEEP && action !== 'sleep' && action !== 'status') {
      this.wakeUp();
      if (action === 'wake') {
        return;
      }
    }

    switch (action) {
      case 'feed':
        this.feed('food');
        break;
      case 'water':
        this.feed('water');
        break;
      case 'sleep':
        this.forceSleep();
        break;
      case 'status':
        this.toggleStatus(true);
        break;
    }
  }

  setState(newState, duration = null) {
    if (this.state === newState && newState !== STATES.PAMPER) return;

    const oldState = this.state;
    this.state = newState;
    const config = STATE_CONFIG[newState];

    // 更新图片
    this.elements.image.src = ASSETS[config.img];

    // 更新动画类
    this.elements.image.className = '';
    this.elements.image.classList.add(config.animClass);

    // 翅膀图层
    this.elements.wingCanvas.style.opacity = config.showWings ? '1' : '0';

    // 清除之前的定时器
    if (this.stateTimer) {
      clearTimeout(this.stateTimer);
    }

    // 如果是有持续时间的动作，结束后回到待机
    if (newState !== STATES.IDLE && newState !== STATES.SLEEP) {
      const actualDuration = duration || this.randomRange(config.minDuration, config.maxDuration);
      this.stateTimer = setTimeout(() => {
        this.setState(STATES.IDLE);
      }, actualDuration);
    }

    // 如果进入睡眠，停止自动行为
    if (newState === STATES.SLEEP) {
      this.spawnEffect('💤', 1, { x: 220, y: 60 });
    }

    // 同步主进程，更新右键菜单
    if (window.electronAPI && window.electronAPI.sendStateChanged) {
      window.electronAPI.sendStateChanged(newState === STATES.SLEEP);
    }
  }

  startAutoBehavior() {
    const scheduleNext = () => {
      // 如果正在睡觉或用户交互中，不要自动切换
      if (this.state === STATES.SLEEP || this.state === STATES.EAT || this.state === STATES.PAMPER) {
        setTimeout(scheduleNext, 2000);
        return;
      }

      const rand = Math.random();
      let nextState = STATES.IDLE;
      if (rand < 0.25) nextState = STATES.FLAP;
      else if (rand < 0.5) nextState = STATES.PREEN;
      else if (rand < 0.65) nextState = STATES.EAT; // 偶尔自己啄食
      else nextState = STATES.IDLE;

      this.setState(nextState);

      const delay = this.randomRange(3000, 8000);
      setTimeout(scheduleNext, delay + (STATE_CONFIG[nextState].maxDuration || 0));
    };

    setTimeout(scheduleNext, 4000);
  }

  startDecayLoop() {
    setInterval(() => {
      const now = Date.now();
      if (now - this.lastDecayTime < 30000) return;
      this.lastDecayTime = now;

      if (this.state === STATES.SLEEP) {
        this.addStat('energy', 5, true);
        this.addStat('fullness', -1, true);
        this.addStat('thirst', -1, true);
      } else {
        this.addStat('fullness', -2, true);
        this.addStat('thirst', -3, true);
        this.addStat('energy', -1.5, true);
      }

      // 低属性提示与强制休息
      if (this.stats.energy < 20) {
        this.showBubble('好累呀，要睡觉了...', 2000);
        this.forceSleep();
      } else if (this.stats.fullness < 25) {
        this.showBubble(this.randomPick(BUBBLES.hungry), 2000);
        this.addStat('happiness', -3, true);
      } else if (this.stats.thirst < 25) {
        this.showBubble(this.randomPick(BUBBLES.thirsty), 2000);
      }
    }, 1000);
  }

  feed(type) {
    if (type === 'food') {
      this.addStat('fullness', 25);
      this.addStat('happiness', 5);
      this.addStat('affection', 3);
      this.showBubble(this.randomPick(BUBBLES.feed), 2000);
      this.spawnEffect('🍚', 3);
    } else {
      this.addStat('thirst', 35);
      this.addStat('happiness', 3);
      this.addStat('affection', 3);
      this.showBubble(this.randomPick(BUBBLES.water), 2000);
      this.spawnEffect('💧', 3);
    }

    this.setState(STATES.EAT, 3000);
  }

  pamper() {
    this.addStat('happiness', 8);
    this.addStat('affection', 5);
    this.showBubble(this.randomPick(BUBBLES.pamper), 2000);
    this.spawnEffect('❤️', 5);
    this.setState(STATES.PAMPER, 2200);
  }

  forceSleep() {
    this.setState(STATES.SLEEP);
    this.showBubble(this.randomPick(BUBBLES.sleep), 2000);
  }

  wakeUp() {
    if (this.state !== STATES.SLEEP) return;
    this.showBubble('起床啦~', 1500);
    this.spawnEffect('☀️', 3);
    this.addStat('energy', 5);
    this.setState(STATES.IDLE);
  }

  addStat(key, value, isDecay = false) {
    if (!this.stats.hasOwnProperty(key)) return;
    this.stats[key] = Math.max(0, Math.min(100, this.stats[key] + value));
    this.updateStatusUI();
  }

  updateStatusUI() {
    const mapping = {
      fullness: 'fullness',
      thirst: 'thirst',
      happiness: 'happiness',
      energy: 'energy',
      affection: 'affection',
    };

    for (const [key, id] of Object.entries(mapping)) {
      const val = Math.round(this.stats[key]);
      const bar = document.getElementById(`bar-${id}`);
      const value = document.getElementById(`val-${id}`);
      if (bar) bar.style.width = `${val}%`;
      if (value) value.textContent = val;
    }
  }

  toggleStatus(show) {
    this.statusVisible = show;
    this.elements.statusPanel.classList.toggle('hidden', !show);
  }

  showBubble(text, duration = 2000) {
    const bubble = this.elements.bubble;
    bubble.textContent = text;
    bubble.classList.remove('hidden');

    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => {
      bubble.classList.add('hidden');
    }, duration);
  }

  spawnEffect(char, count = 1, startPos = null) {
    const container = this.elements.effects;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'effect';
        el.textContent = char;
        const x = startPos ? startPos.x + (Math.random() - 0.5) * 30 : 140 + (Math.random() - 0.5) * 120;
        const y = startPos ? startPos.y + (Math.random() - 0.5) * 20 : 120 + (Math.random() - 0.5) * 60;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        container.appendChild(el);
        setTimeout(() => el.remove(), 1600);
      }, i * 150);
    }
  }

  animateWings() {
    // 当状态为 flap 时，在 canvas 上绘制扇动的翅膀
    const draw = () => {
      const ctx = this.wingCtx;
      const canvas = this.elements.wingCanvas;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (this.state !== STATES.FLAP) {
        requestAnimationFrame(draw);
        return;
      }

      const time = Date.now() / 100;
      const flapAngle = Math.sin(time) * 0.5; // 扇动角度

      ctx.save();
      ctx.translate(width / 2, height / 2);

      // 绘制左侧翅膀（简化的扇形）
      ctx.save();
      ctx.rotate(-0.3 + flapAngle * 0.5);
      ctx.fillStyle = 'rgba(255, 250, 220, 0.85)';
      ctx.strokeStyle = 'rgba(139, 90, 0, 0.7)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(-80, 10, 50, 70, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 绘制右侧翅膀
      ctx.save();
      ctx.rotate(0.3 - flapAngle * 0.5);
      ctx.beginPath();
      ctx.ellipse(80, 10, 50, 70, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.restore();

      requestAnimationFrame(draw);
    };

    draw();
  }

  randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

// 启动宠物
window.addEventListener('DOMContentLoaded', () => {
  window.pet = new Pet();
});
