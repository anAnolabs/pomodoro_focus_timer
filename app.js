/**
 * Pomodoro Focus Timer - Application Logic
 */

/* ─── Initial State & Default Settings ────────────── */
const DEFAULT_SETTINGS = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakInterval: 4,
  soundEnabled: true
};

let settings = { ...DEFAULT_SETTINGS };
let state = {
  mode: 'work', // 'work', 'shortBreak', 'longBreak'
  timeLeft: 0,
  totalTime: 0,
  isRunning: false,
  intervalId: null,
  
  focusSessionsCompleted: 0, // In current cycle
  totalPomodoros: 0,         // All time
  totalFocusTime: 0,         // In minutes
  
  tasks: [],
  activeTaskId: null,
  
  garden: [], // { date, status: 'grown'|'dead', taskName }
  streak: 0,
  
  lastTickTime: null,
  ambientAudio: null,
  treeStatus: null // null | 'growing' | 'dead'
};

/* ─── Storage Operations ──────────────────────────── */
const Storage = {
  save() {
    localStorage.setItem('pomoSettings', JSON.stringify(settings));
    
    // Save minimal state
    const appState = {
      totalPomodoros: state.totalPomodoros,
      totalFocusTime: state.totalFocusTime,
      tasks: state.tasks,
      garden: state.garden
    };
    localStorage.setItem('pomoState', JSON.stringify(appState));
  },
  load() {
    const s = localStorage.getItem('pomoSettings');
    if (s) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
    
    const a = localStorage.getItem('pomoState');
    if (a) {
      const parsed = JSON.parse(a);
      state.totalPomodoros = parsed.totalPomodoros || 0;
      state.totalFocusTime = parsed.totalFocusTime || 0;
      state.tasks = parsed.tasks || [];
      state.garden = parsed.garden || [];
    }
  }
};

/* ─── DOM Elements ────────────────────────────────── */
const els = {
  // Timer Elements
  timerDisplay: document.getElementById('timerDisplay'),
  sessionLabel: document.getElementById('sessionLabel'),
  ringProgress: document.getElementById('ringProgress'),
  activeTaskLabel: document.getElementById('activeTaskLabel'),
  plantEmoji: document.getElementById('plantEmoji'),
  
  // Controls
  btnStart: document.getElementById('startBtn'),
  btnReset: document.getElementById('resetBtn'),
  btnSkip: document.getElementById('skipBtn'),
  
  // Tabs
  tabWork: document.getElementById('tabWork'),
  tabShortBreak: document.getElementById('tabShortBreak'),
  tabLongBreak: document.getElementById('tabLongBreak'),
  
  // Modals & Header
  btnSettings: document.getElementById('btnSettings'),
  btnStats: document.getElementById('btnStats'),
  btnGarden: document.getElementById('btnGarden'),
  btnTheme: document.getElementById('btnTheme'),
  
  modals: {
    settings: document.getElementById('settingsModal'),
    stats: document.getElementById('statsModal'),
    garden: document.getElementById('gardenModal')
  },
  
  // Tasks
  taskList: document.getElementById('taskList'),
  taskInput: document.getElementById('newTaskInput'),
  taskEst: document.getElementById('newTaskEst'),
  btnAddTask: document.getElementById('addTaskBtn'),
  taskCountText: document.getElementById('tasksPomoCount'),
  
  // Ambient
  ambientSelect: document.getElementById('ambientSelect'),
  
  // Toast
  toast: document.getElementById('toast'),
  toastIcon: document.getElementById('toastIcon'),
  toastMsg: document.getElementById('toastMsg')
};

const CIRCUMFERENCE = 2 * Math.PI * 108; // ≈ 678.58

/* ─── Audio Helpers ───────────────────────────────── */
function playBeep() {
  if (!settings.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Smooth chime
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 1.2);
    
    setTimeout(() => {
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.connect(g2); g2.connect(ctx.destination);
      o2.type = 'sine';
      o2.frequency.setValueAtTime(1100, ctx.currentTime);
      g2.gain.setValueAtTime(0.3, ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      o2.start(ctx.currentTime);
      o2.stop(ctx.currentTime + 0.8);
    }, 400);
  } catch(e) {}
}

/* ─── Offline Ambient Sound Synthesizer ─────────────── */
const AmbientAudio = {
  ctx: null,
  activeNodes: [],
  
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },

  stop() {
    this.activeNodes.forEach(node => {
      try { node.stop(); } catch(e){}
      try { node.disconnect(); } catch(e){}
    });
    this.activeNodes = [];
  },
  
  createNoise(type) {
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds loop
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'brown') {
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // Compensate gain
      } else {
        output[i] = white; // white/pink approx
      }
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    return noise;
  },

  play(type) {
    this.stop();
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    if (type === 'none') return;
    
    const noise = this.createNoise(type === 'ocean' ? 'brown' : 'white');
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    if (type === 'rain') {
      filter.type = 'lowpass';
      filter.frequency.value = 1000;
      gain.gain.value = 0.5;
    } else if (type === 'ocean') {
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      
      // LFO for slow ocean waves effect
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.15; // 6.6s per wave
      
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.5;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      
      gain.gain.value = 0.2; 
      lfo.start();
      this.activeNodes.push(lfo);
    } else if (type === 'cafe') {
      filter.type = 'bandpass';
      filter.frequency.value = 800;
      // create a murmur-like modulation
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 2; // fast chatter wobble
      
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.1;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      
      gain.gain.value = 0.2;
      lfo.start();
      this.activeNodes.push(lfo);
    }
    
    noise.start();
    this.activeNodes.push(noise, filter, gain);
  }
};

function toggleAmbientSound() {
  const choice = els.ambientSelect.value;
  AmbientAudio.play(choice);
}
els.ambientSelect.addEventListener('change', toggleAmbientSound);

/* ─── UI Rendering & Updates ──────────────────────── */
function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function showToast(icon, msg) {
  els.toastIcon.textContent = icon;
  els.toastMsg.textContent = msg;
  els.toast.classList.add('show');
  setTimeout(() => els.toast.classList.remove('show'), 3500);
}

function updateRing() {
  const fraction = state.timeLeft / Math.max(state.totalTime, 1);
  els.ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - fraction);
}

function updateThemeColors() {
  let accent = 'var(--work-from)';
  let ringColor = 'rgba(249,115,22,0.35)';
  let gradUrl = 'url(#workGrad)';
  
  if (state.mode === 'shortBreak') {
    accent = 'var(--short-from)';
    ringColor = 'rgba(99,102,241,0.35)';
    gradUrl = 'url(#shortBreakGrad)';
  } else if (state.mode === 'longBreak') {
    accent = 'var(--long-from)';
    ringColor = 'rgba(16,185,129,0.35)';
    gradUrl = 'url(#longBreakGrad)';
  }

  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--ring', ringColor);
  els.ringProgress.setAttribute('stroke', gradUrl);
  
  els.timerDisplay.className = 'timer-display';
  els.btnStart.className = 'btn btn-primary ' + (state.isRunning ? 'pulsing' : '');
  
  if (state.mode === 'shortBreak') {
    els.timerDisplay.classList.add('break-short');
    els.btnStart.classList.add('break-short');
  } else if (state.mode === 'longBreak') {
    els.timerDisplay.classList.add('break-long');
    els.btnStart.classList.add('break-long');
  }
}

function updateTimerDisplay() {
  els.timerDisplay.textContent = formatTime(state.timeLeft);
  document.title = `${formatTime(state.timeLeft)} — ${state.mode === 'work' ? 'Focus' : 'Break'} | FocusFlow`;
  updateRing();
}

/* ─── Gamification (Garden) ───────────────────────── */
function updateGardenPlantUI() {
  if (state.mode !== 'work') {
    els.plantEmoji.classList.remove('show');
    return;
  }
  
  if (state.treeStatus === 'growing') {
    els.plantEmoji.textContent = '🌱';
    els.plantEmoji.classList.add('show');
    
    // Grow slightly over time based on progress
    const progress = 1 - (state.timeLeft / state.totalTime);
    if (progress > 0.8) els.plantEmoji.textContent = '🌳';
    else if (progress > 0.4) els.plantEmoji.textContent = '🌿';
  } else if (state.treeStatus === 'dead') {
    els.plantEmoji.textContent = '🥀';
    els.plantEmoji.classList.add('show');
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.isRunning && state.mode === 'work' && state.treeStatus !== 'dead') {
    // Left tab during focus
    state.treeStatus = 'dead';
    updateGardenPlantUI();
    showToast('🥀', 'You left the timer! Your tree withered.');
  }
});

function plantTree(status, taskName) {
  state.garden.push({
    date: new Date().toISOString(),
    status: status, // 'grown' or 'dead'
    taskName: taskName || 'Unassigned Focus'
  });
  Storage.save();
}

function renderGarden() {
  const grid = document.getElementById('gardenGrid');
  document.getElementById('gardenTreeCount').textContent = state.garden.filter(g => g.status === 'grown').length;
  grid.innerHTML = '';
  
  const last20 = state.garden.slice(-20).reverse(); // Show latest 20
  last20.forEach(g => {
    const el = document.createElement('div');
    el.className = `garden-cell ${g.status === 'dead' ? 'dead' : ''}`;
    el.textContent = g.status === 'dead' ? '🥀' : '🌳';
    
    const tip = document.createElement('div');
    tip.className = 'tooltip';
    const d = new Date(g.date);
    tip.textContent = `${d.toLocaleDateString()} - ${g.taskName}`;
    el.appendChild(tip);
    
    grid.appendChild(el);
  });
}

/* ─── Task Management ─────────────────────────────── */
function renderTasks() {
  els.taskList.innerHTML = '';
  let activeCompleted = false;
  
  // Calculate completed pomodoros today (approx logic from garden)
  
  state.tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''} ${task.id === state.activeTaskId ? 'active' : ''}`;
    
    const check = document.createElement('div');
    check.className = 'task-check';
    check.onclick = (e) => { e.stopPropagation(); toggleTaskCompletion(task.id); };
    
    const content = document.createElement('div');
    content.className = 'task-content';
    content.onclick = () => selectTask(task.id);
    
    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = task.title;
    
    const pomos = document.createElement('div');
    pomos.className = 'task-pomos';
    for (let i = 0; i < task.est; i++) {
        const dot = document.createElement('div');
        dot.className = `pomo-dot ${i < task.act ? 'done' : ''}`;
        pomos.appendChild(dot);
    }
    
    content.appendChild(title);
    content.appendChild(pomos);
    
    const delBtn = document.createElement('button');
    delBtn.className = 'task-delete';
    delBtn.innerHTML = '✖';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteTask(task.id); };
    
    li.appendChild(check);
    li.appendChild(content);
    li.appendChild(delBtn);
    els.taskList.appendChild(li);
    
    if (task.id === state.activeTaskId && task.completed) {
        activeCompleted = true;
    }
  });
  
  if (activeCompleted) state.activeTaskId = null;
  updateActiveTaskLabel();
  
  // Update task stats
  const totalAct = state.tasks.reduce((sum, t) => sum + t.act, 0);
  els.taskCountText.textContent = totalAct;
}

function addTask() {
  const title = els.taskInput.value.trim();
  const est = parseInt(els.taskEst.value) || 1;
  if (!title) return;
  
  state.tasks.push({
    id: Date.now().toString(),
    title,
    est,
    act: 0,
    completed: false
  });
  
  els.taskInput.value = '';
  els.taskEst.value = '1';
  Storage.save();
  renderTasks();
}

function selectTask(id) {
  state.activeTaskId = id;
  renderTasks();
}

function toggleTaskCompletion(id) {
  const t = state.tasks.find(t => t.id === id);
  if (t) t.completed = !t.completed;
  Storage.save();
  renderTasks();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  if (state.activeTaskId === id) state.activeTaskId = null;
  Storage.save();
  renderTasks();
}

function incrementActiveTask() {
  if (!state.activeTaskId) return;
  const t = state.tasks.find(t => t.id === state.activeTaskId);
  if (t && !t.completed) {
      t.act += 1;
  }
}

function updateActiveTaskLabel() {
  if (state.activeTaskId) {
    const t = state.tasks.find(t => t.id === state.activeTaskId);
    els.activeTaskLabel.textContent = `Focusing on: ${t ? t.title : 'Ready to focus'}`;
  } else {
    els.activeTaskLabel.textContent = 'Select a task below';
  }
}

els.btnAddTask.addEventListener('click', addTask);
els.taskInput.addEventListener('keypress', e => e.key === 'Enter' && addTask());


/* ─── Mode Switching & Timer Logic ────────────────── */
function setMode(newMode) {
  // Clear any existing timer
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  
  state.mode = newMode;
  state.isRunning = false;
  state.treeStatus = null;
  
  // Get time from settings
  let m = settings.focus;
  if (newMode === 'shortBreak') m = settings.shortBreak;
  if (newMode === 'longBreak') m = settings.longBreak;
  
  state.totalTime = m * 60;
  state.timeLeft = state.totalTime;
  
  // UI Sync
  els.tabWork.classList.toggle('active', newMode === 'work');
  els.tabShortBreak.classList.toggle('active', newMode === 'shortBreak');
  els.tabLongBreak.classList.toggle('active', newMode === 'longBreak');
  
  if (newMode === 'work') els.sessionLabel.textContent = 'Focus Session';
  else if (newMode === 'shortBreak') els.sessionLabel.textContent = 'Short Break';
  else els.sessionLabel.textContent = 'Long Break';
  
  els.btnStart.innerHTML = '▶&nbsp; Start';
  updateThemeColors();
  updateTimerDisplay();
  updateGardenPlantUI();
}

function tick() {
  if (state.timeLeft <= 0) {
    // Session Complete
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.isRunning = false;
    
    playBeep();
    
    if (state.mode === 'work') {
      // Focus done
      state.focusSessionsCompleted++;
      state.totalPomodoros++;
      state.totalFocusTime += settings.focus;
      
      incrementActiveTask();
      
      // Garden logic
      const actTask = state.tasks.find(t => t.id === state.activeTaskId);
      const tName = actTask ? actTask.title : 'Unassigned';
      if (state.treeStatus !== 'dead') {
          plantTree('grown', tName);
      } else {
          plantTree('dead', tName);
      }
      
      Storage.save();
      renderTasks();
      
      if (state.focusSessionsCompleted % settings.longBreakInterval === 0) {
        showToast('🎯', '4 sessions done! Take a long break.');
        setMode('longBreak');
      } else {
        showToast('🎯', 'Focus complete! Take a short break.');
        setMode('shortBreak');
      }
    } else {
      // Break done
      showToast('🍅', 'Break over! Ready to focus?');
      setMode('work');
    }
    return;
  }
  
  state.timeLeft--;
  updateTimerDisplay();
  updateGardenPlantUI();
}

function toggleTimer() {
  if (state.isRunning) {
    // Pause
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.isRunning = false;
    els.btnStart.innerHTML = '▶&nbsp; Resume';
    els.btnStart.classList.remove('pulsing');
  } else {
    // Start
    state.isRunning = true;
    if (state.mode === 'work' && state.treeStatus === null) {
      state.treeStatus = 'growing';
    }
    state.intervalId = setInterval(tick, 1000);
    els.btnStart.innerHTML = '⏸&nbsp; Pause';
    updateThemeColors(); // trigger pulsing
  }
}

function resetTimer() {
  setMode(state.mode); // restarts current mode
}

function skipTimer() {
  state.timeLeft = 0;
  tick(); // artificially trigger completion
}

els.btnStart.addEventListener('click', toggleTimer);
els.btnReset.addEventListener('click', resetTimer);
els.btnSkip.addEventListener('click', skipTimer);

els.tabWork.addEventListener('click', () => { if (state.mode !== 'work') setMode('work'); });
els.tabShortBreak.addEventListener('click', () => { if (state.mode !== 'shortBreak') setMode('shortBreak'); });
els.tabLongBreak.addEventListener('click', () => { if (state.mode !== 'longBreak') setMode('longBreak'); });


/* ─── Modals logic ────────────────────────────────── */
function openModal(id) {
  document.getElementById(id).classList.add('active');
  if (id === 'statsModal') renderChart();
  if (id === 'gardenModal') renderGarden();
}
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

els.btnSettings.addEventListener('click', () => {
  // populate current settings
  document.getElementById('settingFocus').value = settings.focus;
  document.getElementById('settingShortBreak').value = settings.shortBreak;
  document.getElementById('settingLongBreak').value = settings.longBreak;
  document.getElementById('settingLongBreakInterval').value = settings.longBreakInterval;
  document.getElementById('settingSoundEnabled').checked = settings.soundEnabled;
  openModal('settingsModal');
});

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  settings.focus = parseInt(document.getElementById('settingFocus').value) || 25;
  settings.shortBreak = parseInt(document.getElementById('settingShortBreak').value) || 5;
  settings.longBreak = parseInt(document.getElementById('settingLongBreak').value) || 15;
  settings.longBreakInterval = parseInt(document.getElementById('settingLongBreakInterval').value) || 4;
  settings.soundEnabled = document.getElementById('settingSoundEnabled').checked;
  Storage.save();
  closeModal('settingsModal');
  setMode(state.mode); // refresh timer with new settings if needed
});

els.btnStats.addEventListener('click', () => openModal('statsModal'));
els.btnGarden.addEventListener('click', () => openModal('gardenModal'));

document.querySelectorAll('.close-modal').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.target.closest('.modal-overlay').classList.remove('active');
  });
});

/* ─── Stats & Chart ───────────────────────────────── */
function renderChart() {
  document.getElementById('statTotalFocus').textContent = `${Math.floor(state.totalFocusTime / 60)}h ${state.totalFocusTime % 60}m`;
  document.getElementById('statTotalPomodoros').textContent = state.totalPomodoros;
  
  const chartBox = document.getElementById('activityChart');
  chartBox.innerHTML = '';
  
  // Mock data for visual appeal (in a real app, generate from local log)
  // We'll generate a 7 day array, mostly mocked + today from total
  const todayVal = Math.min(state.totalPomodoros, 12); 
  const mockData = [2, 5, 3, 0, 7, 4, todayVal];
  const max = Math.max(...mockData, 5);
  
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const todayObj = new Date();
  
  for(let i=0; i<7; i++) {
    const d = new Date(todayObj);
    d.setDate(todayObj.getDate() - (6 - i));
    
    const h = (mockData[i] / max) * 100;
    
    const div = document.createElement('div');
    div.className = 'chart-bar-group';
    div.innerHTML = `
      <div class="chart-bar" style="height: ${h}%" title="${mockData[i]} pomodoros"></div>
      <div class="chart-label">${days[d.getDay()]}</div>
    `;
    chartBox.appendChild(div);
  }
}

/* ─── Theme toggle ────────────────────────────────── */
els.btnTheme.addEventListener('click', () => {
  const isDark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'light' : 'dark';
  els.btnTheme.textContent = isDark ? '☀️' : '🌙';
});


/* ─── Initialization ──────────────────────────────── */
function init() {
  Storage.load();
  renderTasks();
  setMode('work');
  
  // Theme check
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (!isDark) {
    document.documentElement.dataset.theme = 'light';
    els.btnTheme.textContent = '☀️';
  }
}

init();
