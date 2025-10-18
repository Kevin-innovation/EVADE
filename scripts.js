// EVADE - Minimal MVP per rules.md
(() => {
  'use strict';

  // DOM
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const elMenu = document.getElementById('main-menu');
  const elHud = document.getElementById('hud');
  const elLevelUp = document.getElementById('levelup-overlay');
  const elGameOver = document.getElementById('gameover-overlay');
  const elPause = document.getElementById('pause-overlay');
  const elChar = document.getElementById('char-select');

  const hpFill = document.getElementById('hp-fill');
  const xpFill = document.getElementById('xp-fill');
  const levelLabel = document.getElementById('level-label');
  const timeLabel = document.getElementById('time-label');
  const killLabel = document.getElementById('kill-count');
  const goldLabel = document.getElementById('gold-count');
  const waveLabel = document.getElementById('wave-label');
  const bossBar = document.getElementById('bossbar');
  const bossName = document.getElementById('boss-name');
  const bossFill = document.getElementById('boss-fill');
  const skillEls = {
    Q: document.getElementById('skill-Q'),
    W: document.getElementById('skill-W'),
    E: document.getElementById('skill-E'),
    R: document.getElementById('skill-R'),
  };

  const btnStart = document.getElementById('btn-start');
  const btnRetry = document.getElementById('btn-retry');
  const btnExit = document.getElementById('btn-exit');
  const btnResume = document.getElementById('btn-resume');
  const btnExit2 = document.getElementById('btn-exit2');
  const btnChar = document.getElementById('btn-characters');
  const btnCharBack = document.getElementById('btn-char-back');
  const btnCharPlay = document.getElementById('btn-char-play');
  const charCards = elChar ? [...elChar.querySelectorAll('.char-card')] : [];
  const elUpg = document.getElementById('upgrades-menu');
  const btnUpg = document.getElementById('btn-upgrades');
  const btnUpgBack = document.getElementById('btn-upg-back');
  const walletGold = document.getElementById('wallet-gold');
  const upgCards = elUpg ? [...elUpg.querySelectorAll('.upgrade-card')] : [];
  const elSettings = document.getElementById('settings-menu');
  const btnSettings = document.getElementById('btn-settings');
  const btnSettingsBack = document.getElementById('btn-settings-back');
  const volMaster = document.getElementById('vol-master');
  const volLabel = document.getElementById('vol-label');
  const muteToggle = document.getElementById('mute-toggle');

  // Character image mapping (1..8)
  const CHAR_IMAGES = {
    Aegis: 'img/1.png',
    Lumina: 'img/2.png',
    Sylva: 'img/3.png',
    Pyra: 'img/4.png',
    Umbra: 'img/5.png',
    Terra: 'img/6.png',
    Zephyr: 'img/7.png',
    Noctis: 'img/8.png',
  };
  const imageCache = {};
  function getCharImage(id) {
    const src = CHAR_IMAGES[id];
    if (!src) return null;
    if (!imageCache[src]) {
      const img = new Image(); img.src = src; imageCache[src] = img;
    }
    return imageCache[src];
  }

  const levelupButtons = [
    ...elLevelUp.querySelectorAll('.card')
  ];

  const resultTime = document.getElementById('result-time');
  const resultWave = document.getElementById('result-wave');
  const resultKills = document.getElementById('result-kills');
  const resultGold = document.getElementById('result-gold');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // Utils
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by; return dx*dx + dy*dy;
  };
  const randRange = (a, b) => a + Math.random() * (b - a);
  const pickN = (arr, n) => {
    const copy = arr.slice();
    const out = [];
    n = Math.min(n, copy.length);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  };

  // Input
  const keys = new Set();
  const K = {
    LEFT: ['ArrowLeft', 'a', 'A'],
    RIGHT: ['ArrowRight', 'd', 'D'],
    UP: ['ArrowUp', 'w', 'W'],
    DOWN: ['ArrowDown', 's', 'S'],
    SLASH: [' ', 'Spacebar'],
    Q: ['q', 'Q'], W: ['w', 'W'], E: ['e', 'E'], R: ['r', 'R'],
    ESC: ['Escape'],
    MUTE: ['m', 'M'],
    DEBUG: ['F3']
  };
  window.addEventListener('keydown', (e) => {
    keys.add(e.key);
    if (state === 'RUNNING') {
      if (K.SLASH.includes(e.key)) { trySlash(); }
      if (K.Q.includes(e.key)) { tryCast('Q'); }
      if (K.W.includes(e.key)) { tryCast('W'); }
      if (K.E.includes(e.key)) { tryCast('E'); }
      if (K.R.includes(e.key)) { tryCast('R'); }
      if (K.ESC.includes(e.key)) { doPause(); }
      if (K.MUTE.includes(e.key)) { toggleMute(); }
      if (K.DEBUG.includes(e.key)) { debug.show = !debug.show; }
    }
    if (state === 'PAUSED') {
      if (K.ESC.includes(e.key)) { resumeGame(); }
    }
    if (state === 'LEVELUP') {
      // prevent scrolling space etc
      if ([' ', 'Spacebar', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key));

  // Game state
  /** @type {'MENU'|'RUNNING'|'LEVELUP'|'GAMEOVER'|'PAUSED'} */
  let state = 'MENU';
  let timeAlive = 0; // seconds
  let kills = 0;
  let gold = 0;
  let stage = 1, waveInStage = 1; // display only

  const player = {
    x: canvas.width * 0.5,
    y: canvas.height * 0.5,
    r: 14,
    maxHp: 100,
    hp: 100,
    speed: 180,
    power: 10,
    crit: 0.1,
    cdr: 0.0,
    pickupRange: 120,
    slashRange: 70,
    slashCooldown: 0.45,
    slashReadyIn: 0,
    invuln: 0,
    dmgReduce: 0,
  };

  const enemies = [];
  const gems = [];
  const heals = [];
  const chests = [];
  const effects = [];
  const projectiles = [];
  const shake = { t: 0, max: 0, mag: 0 };
  const debug = { show: false };
  const popups = [];

  function xpForLevel(lv) {
    return Math.floor(20 * Math.pow(1.35, lv - 1));
  }
  const levelState = { level: 1, xp: 0, next: xpForLevel(1) };

  // Skills (Q/W/E/R)
  let skills = {
    Q: { cd: 6.0, t: 0, cast: () => dashSkill() },
    W: { cd: 12.0, t: 0, cast: () => shieldSkill() },
    E: { cd: 8.0, t: 0, cast: () => novaSkill() },
    R: { cd: 20.0, t: 0, cast: () => quakeSkill() },
  };

  function tryCast(key) {
    const s = skills[key];
    if (!s || s.t > 0 || state !== 'RUNNING') return;
    s.t = s.cd * (1 - player.cdr);
    s.lastCd = s.t;
    s.cast();
    // flash UI
    const el = skillEls[key];
    if (el) { el.classList.add('cast'); setTimeout(() => el.classList.remove('cast'), 180); }
  }

  function dashSkill() {
    // short directional dash based on input
    let mx = 0, my = 0;
    if (K.LEFT.some(k => keys.has(k))) mx -= 1;
    if (K.RIGHT.some(k => keys.has(k))) mx += 1;
    if (K.UP.some(k => keys.has(k))) my -= 1;
    if (K.DOWN.some(k => keys.has(k))) my += 1;
    const len = Math.hypot(mx, my) || 1; mx /= len; my /= len;
    const dist = 160;
    player.x = clamp(player.x + mx * dist, 0, canvas.width);
    player.y = clamp(player.y + my * dist, 0, canvas.height);
    player.invuln = Math.max(player.invuln, 0.15);
    effects.push({ kind: 'dash', t: 0.15, max: 0.15, mx, my });
  }

  function shieldSkill() {
    // temporary damage reduction
    effects.push({ kind: 'shield', t: 3.0, max: 3.0 });
  }

  function novaSkill() {
    // radial damage
    effects.push({ kind: 'nova', t: 0.2, max: 0.2 });
    const radius2 = (140) * (140);
    const base = player.power * 2.0;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (dist2(player.x, player.y, e.x, e.y) <= radius2) {
        let dmg = base;
        if (Math.random() < player.crit) dmg *= 2;
        e.hp -= dmg;
        e.hitTime = 0.1;
        if (e.hp <= 0) {
          enemies.splice(i, 1);
          kills++;
          if (e.type === 'elite') {
            chests.push({ x: e.x, y: e.y, r: 8, gold: 10 });
          } else if (e.type === 'boss') {
            chests.push({ x: e.x, y: e.y, r: 10, gold: 50 });
          } else {
            gems.push({ x: e.x, y: e.y, r: 5, value: 8 });
            if (Math.random() < 0.08) heals.push({ x: e.x, y: e.y, r: 6 });
            const upgMeta = getUpgrades();
            if (Math.random() < 0.25 * (1 + ((upgMeta.gold || 0) * 0.10))) gold += 1;
          }
        }
      }
    }
  }

  function quakeSkill() {
    // large AOE damage
    effects.push({ kind: 'quake', t: 0.6, max: 0.6 });
    const radius2 = (220) * (220);
    const base = player.power * 4.0;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (dist2(player.x, player.y, e.x, e.y) <= radius2) {
        let dmg = base;
        if (Math.random() < player.crit) dmg *= 2;
        e.hp -= dmg;
        e.hitTime = 0.1;
        if (e.hp <= 0) {
          enemies.splice(i, 1);
          kills++;
          gems.push({ x: e.x, y: e.y, r: 5, value: 8 });
          if (Math.random() < 0.08) heals.push({ x: e.x, y: e.y, r: 6 });
          const upgMeta = getUpgrades();
          if (Math.random() < 0.25 * (1 + ((upgMeta.gold || 0) * 0.10))) gold += 1;
        }
      }
    }
  }

  // Character-specific skill sets
  function nearestEnemy() {
    let best = null, bestD2 = Infinity;
    for (const e of enemies) {
      const d2 = dist2(player.x, player.y, e.x, e.y);
      if (d2 < bestD2) { bestD2 = d2; best = e; }
    }
    return best;
  }

  function boltSkill() {
    const target = nearestEnemy();
    if (!target) return;
    const dx = target.x - player.x, dy = target.y - player.y;
    const d = Math.hypot(dx, dy) || 1; const nx = dx/d, ny = dy/d;
    const spd = 420;
    projectiles.push({ x: player.x, y: player.y, vx: nx*spd, vy: ny*spd, r: 4, dmg: player.power * 2.2, t: 1.8, friendly: true });
    effects.push({ kind: 'boltcast', t: 0.12, max: 0.12 });
  }

  function chainLightningSkill() {
    // hit up to 3 nearest enemies within radius
    const radius2 = 320*320;
    const candidates = enemies
      .map(e => ({ e, d2: dist2(player.x, player.y, e.x, e.y) }))
      .filter(o => o.d2 <= radius2)
      .sort((a,b)=>a.d2-b.d2)
      .slice(0,3)
      .map(o=>o.e);
    const segments = [];
    let prevX = player.x, prevY = player.y;
    const base = player.power * 1.8;
    for (const e of candidates) {
      e.hp -= base;
      e.hitTime = 0.1;
      segments.push([prevX, prevY, e.x, e.y]);
      prevX = e.x; prevY = e.y;
      if (e.hp <= 0) {
        const idx = enemies.indexOf(e); if (idx>=0) enemies.splice(idx,1);
        kills++; gems.push({ x: e.x, y: e.y, r: 5, value: 8 }); if (Math.random()<0.08) heals.push({x:e.x,y:e.y,r:6}); if (Math.random()<0.25) gold += 1;
      }
    }
    if (segments.length) effects.push({ kind: 'zap', t: 0.14, max: 0.14, segs: segments });
  }

  function applySkillsForCharacter(name) {
    if (name === 'Lumina') {
      skills = {
        Q: { cd: 3.5, t: 0, cast: () => boltSkill() },
        W: { cd: 6.0, t: 0, cast: () => chainLightningSkill() },
        E: { cd: 8.0, t: 0, cast: () => novaSkill() },
        R: { cd: 16.0, t: 0, cast: () => quakeSkill() },
      };
    } else { // Aegis
      skills = {
        Q: { cd: 6.0, t: 0, cast: () => dashSkill() },
        W: { cd: 10.0, t: 0, cast: () => shieldSkill() },
        E: { cd: 8.0, t: 0, cast: () => novaSkill() },
        R: { cd: 20.0, t: 0, cast: () => quakeSkill() },
      };
    }
  }

  // Upgrades
  const UPGRADES = [
    {
      id: 'pwr1', name: '힘 +30%', desc: '기본 공격력 30% 증가',
      apply: () => player.power *= 1.3
    },
    {
      id: 'spd1', name: '이동 속도 +10%', desc: '이동 속도 10% 증가',
      apply: () => player.speed *= 1.10
    },
    {
      id: 'hp1', name: '체력 +20', desc: '최대 체력 +20, 즉시 회복',
      apply: () => { player.maxHp += 20; player.hp = Math.min(player.maxHp, player.hp + 20); }
    },
    {
      id: 'cd1', name: '쿨타임 -15%', desc: '슬래시 쿨타임 15% 감소',
      apply: () => player.slashCooldown = Math.max(0.15, player.slashCooldown * 0.85)
    },
    {
      id: 'rng1', name: '줍기 범위 +30%', desc: '경험치 보석 흡수 범위 증가',
      apply: () => player.pickupRange *= 1.30
    },
    {
      id: 'sr1', name: '슬래시 범위 +20%', desc: '슬래시 반경 20% 증가',
      apply: () => player.slashRange *= 1.20
    },
    {
      id: 'sd1', name: '슬래시 피해 +40%', desc: '슬래시 피해 40% 증가',
      apply: () => player.power *= 1.40
    },
    {
      id: 'crit1', name: '치명타 +5%', desc: '치명타 확률 +5%',
      apply: () => player.crit = Math.min(0.75, player.crit + 0.05)
    }
  ];
  let pendingChoices = [];

  // Buttons
  btnStart?.addEventListener('click', () => gotoChar());
  btnRetry?.addEventListener('click', () => startGame());
  btnExit?.addEventListener('click', () => gotoMenu());
  btnChar?.addEventListener('click', () => gotoChar());
  btnCharBack?.addEventListener('click', () => { elChar.classList.add('hidden'); elMenu.classList.add('visible'); });
  btnCharPlay?.addEventListener('click', () => startGame());
  btnUpg?.addEventListener('click', () => gotoUpgrades());
  btnUpgBack?.addEventListener('click', () => { elUpg.classList.add('hidden'); elMenu.classList.add('visible'); refreshWallet(); });
  upgCards.forEach(card => card.addEventListener('click', () => purchaseUpgrade(card.dataset.upg)));
  btnSettings?.addEventListener('click', () => gotoSettings());
  btnSettingsBack?.addEventListener('click', () => { elSettings.classList.add('hidden'); elMenu.classList.add('visible'); });
  volMaster?.addEventListener('input', () => setVolumeFromUI());
  muteToggle?.addEventListener('change', () => setMuteFromUI());
  btnResume?.addEventListener('click', () => resumeGame());
  btnExit2?.addEventListener('click', () => { resumeGame(); gotoMenu(); });
  charCards.forEach(card => {
    card.addEventListener('click', () => {
      selectedCharacter = card.dataset.char;
      charCards.forEach(c => c.classList.toggle('selected', c === card));
      btnCharPlay.disabled = false;
    });
  });
  levelupButtons.forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const choice = pendingChoices[idx];
      if (!choice) return;
      choice.apply();
      hideLevelUp();
    });
  });

  function fmtTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function gotoMenu() {
    state = 'MENU';
    elMenu.classList.add('visible');
    elHud.classList.add('hidden');
    elLevelUp.classList.add('hidden');
    elGameOver.classList.add('hidden');
    elChar.classList.add('hidden');
    elPause.classList.add('hidden');
    elUpg.classList.add('hidden');
  }

  function gotoChar() {
    elMenu.classList.remove('visible');
    elChar.classList.remove('hidden');
    elChar.classList.add('visible');
  }

  function gotoUpgrades() {
    elMenu.classList.remove('visible');
    elUpg.classList.remove('hidden');
    refreshWallet();
  }

  function gotoSettings() {
    elMenu.classList.remove('visible');
    elSettings.classList.remove('hidden');
    syncSettingsUI();
  }

  let selectedCharacter = 'Aegis';
  function applyCharacterPreset(name) {
    if (name === 'Lumina') {
      player.maxHp = 90; player.hp = 90; player.speed = 185; player.power = 14; player.crit = 0.15;
    } else if (name === 'Aegis') { // Aegis default tanky
      player.maxHp = 120; player.hp = 120; player.speed = 170; player.power = 10; player.crit = 0.08;
    } else {
      // generic defaults for yet-unimplemented characters
      player.maxHp = 100; player.hp = 100; player.speed = 180; player.power = 12; player.crit = 0.1;
    }
    // apply meta upgrades
    const upg = getUpgrades();
    player.maxHp += (upg.hp||0) * 10; player.hp = player.maxHp;
    player.power *= 1 + (upg.power||0) * 0.05;
  }

  function startGame() {
    // Reset
    enemies.length = 0; gems.length = 0; effects.length = 0;
    player.x = canvas.width * 0.5; player.y = canvas.height * 0.5;
    player.cdr = 0; player.pickupRange = 120; player.slashRange = 70; player.slashCooldown = 0.45; player.slashReadyIn = 0;
    applyCharacterPreset(selectedCharacter);
    applySkillsForCharacter(selectedCharacter);
    player.dmgReduce = 0;
    timeAlive = 0; kills = 0; gold = 0; stage = 1; waveInStage = 1;
    levelState.level = 1; levelState.xp = 0; levelState.next = xpForLevel(1);
    spawn.timer = 0; spawn.rate = 1.0; spawn.accel = 0.0; // reset spawn pacing
    for (const k of Object.keys(skills)) skills[k].t = 0;

    elMenu.classList.remove('visible');
    elChar.classList.add('hidden');
    elHud.classList.remove('hidden');
    elLevelUp.classList.add('hidden');
    elGameOver.classList.add('hidden');
    elPause.classList.add('hidden');
    state = 'RUNNING';
  }

  function doPause() {
    if (state !== 'RUNNING') return;
    state = 'PAUSED';
    elPause.classList.remove('hidden');
  }

  function resumeGame() {
    if (state !== 'PAUSED') return;
    elPause.classList.add('hidden');
    state = 'RUNNING';
  }

  function showLevelUp() {
    state = 'LEVELUP';
    // pick 3 unique upgrades
    pendingChoices = pickN(UPGRADES, 3);
    levelupButtons.forEach((btn, i) => {
      const ch = pendingChoices[i];
      if (ch) btn.innerHTML = `<div class="title">${ch.name}</div><div class="desc">${ch.desc}</div>`;
    });
    elLevelUp.classList.remove('hidden');
    sfx('level');
  }

  function hideLevelUp() {
    elLevelUp.classList.add('hidden');
    state = 'RUNNING';
  }

  function gameOver() {
    state = 'GAMEOVER';
    resultTime.textContent = fmtTime(timeAlive);
    resultWave.textContent = `${stage}-${waveInStage}`;
    resultKills.textContent = String(kills);
    resultGold.textContent = String(gold);
    addWallet(Math.floor(gold));
    elGameOver.classList.remove('hidden');
  }

  // Meta progression: wallet and upgrades
  function loadMeta() {
    try { return JSON.parse(localStorage.getItem('evade_meta')||'{}'); } catch { return {}; }
  }
  function saveMeta(meta) {
    localStorage.setItem('evade_meta', JSON.stringify(meta));
  }
  function getWallet() {
    const m = loadMeta(); return m.wallet||0;
  }
  function setWallet(v) {
    const m = loadMeta(); m.wallet = Math.max(0, Math.floor(v)); saveMeta(m); refreshWallet();
  }
  function addWallet(v) { setWallet(getWallet() + Math.max(0, Math.floor(v))); }
  function refreshWallet() { if (walletGold) walletGold.textContent = String(getWallet()); }
  function getUpgrades() { const m = loadMeta(); m.upg = m.upg||{hp:0,power:0,gold:0,xp:0}; return m.upg; }
  function setUpgrades(upg) { const m = loadMeta(); m.upg = upg; saveMeta(m); }
  function purchaseUpgrade(key) {
    const costs = { hp:20, power:30, gold:25, xp:25 };
    const w = getWallet(); const cost = costs[key]||9999; if (w < cost) return;
    const upg = getUpgrades(); upg[key] = (upg[key]||0) + 1; setUpgrades(upg); setWallet(w - cost);
  }

  // Spawning & waves
  const spawn = {
    timer: 0,
    rate: 1.0, // base spawns per second
    accel: 0.0,
  };
  // Scheduled special waves
  let nextEliteAt = 120; // every 120s
  let nextBossAt = 300;  // every 300s

  function hasBoss() {
    return enemies.some(e => e.type === 'boss');
  }

  function currentWaveFromTime(t) {
    const waveDuration = 30; // seconds
    const waveIndex = Math.floor(t / waveDuration); // 0-based
    const stageNum = Math.floor(waveIndex / 10) + 1;
    const waveInStageNum = (waveIndex % 10) + 1;
    return { stageNum, waveInStageNum, waveIndex };
  }

  function spawnEnemy() {
    // edge spawn
    const margin = 40;
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = -margin; y = randRange(0, canvas.height); }
    else if (side === 1) { x = canvas.width + margin; y = randRange(0, canvas.height); }
    else if (side === 2) { x = randRange(0, canvas.width); y = -margin; }
    else { x = randRange(0, canvas.width); y = canvas.height + margin; }

    const waveScale = 1 + Math.min(2.0, timeAlive / 120); // up to 3x by 2 minutes
    const isArcher = Math.random() < Math.min(0.35, 0.1 + timeAlive * 0.005); // grows over time
    if (isArcher) {
      const e = {
        type: 'archer',
        x, y,
        r: 11,
        speed: randRange(50, 80) * waveScale,
        hp: 18 * waveScale,
        touchDps: 5 * waveScale,
        hitTime: 0,
        fireCd: randRange(1.4, 2.0),
        fireT: randRange(0.2, 1.0),
        prefer: 260,
      };
      enemies.push(e);
    } else {
      const e = {
        type: 'melee',
        x, y,
        r: 12,
        speed: randRange(60, 100) * waveScale,
        hp: 20 * waveScale,
        touchDps: 6 * waveScale,
        hitTime: 0,
      };
      enemies.push(e);
    }
  }

  function spawnElite() {
    // spawn an elite near screen edge
    const margin = 50;
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = -margin; y = randRange(0, canvas.height); }
    else if (side === 1) { x = canvas.width + margin; y = randRange(0, canvas.height); }
    else if (side === 2) { x = randRange(0, canvas.width); y = -margin; }
    else { x = randRange(0, canvas.width); y = canvas.height + margin; }
    const waveScale = 1 + Math.min(3.0, timeAlive / 90);
    enemies.push({ type:'elite', x, y, r: 16, speed: 90*waveScale, hp: 200*waveScale, touchDps: 12*waveScale, hitTime: 0, aura: 1 });
    effects.push({ kind:'banner', t:1.6, max:1.6, text:'엘리트 등장!' });
    sfx('elite');
  }

  function spawnBoss() {
    const x = canvas.width*0.1 + Math.random()*canvas.width*0.8;
    const y = canvas.height*0.1 + Math.random()*canvas.height*0.8;
    const waveScale = 1 + Math.min(4.0, timeAlive / 60);
    const hp = 2000*waveScale;
    enemies.push({ type:'boss', name:'Void Titan', x, y, r: 28, speed: 70*waveScale, hp, maxHp: hp, touchDps: 25*waveScale, hitTime: 0, fireT: 1.5, fireCd: 2.5, fireMode: 'ring' });
    effects.push({ kind:'banner', t:2.0, max:2.0, text:'보스 등장!' });
    sfx('boss');
  }

  function getBoss() {
    return enemies.find(e => e.type === 'boss') || null;
  }

  function trySlash() {
    if (player.slashReadyIn > 0 || state !== 'RUNNING') return;
    player.slashReadyIn = player.slashCooldown;
    const range2 = (player.slashRange) * (player.slashRange);
    const dmgBase = player.power * 3.5; // slash damage multiplier
    let hit = 0;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (dist2(player.x, player.y, e.x, e.y) <= range2) {
        let dmg = dmgBase;
        if (Math.random() < player.crit) dmg *= 2;
        e.hp -= dmg;
        e.hitTime = 0.1;
        effects.push({ kind:'hitspark', x: e.x, y: e.y, t: 0.1, max: 0.1 });
        popups.push({ x: e.x, y: e.y-10, v: -30, t: 0.6, txt: Math.round(dmg)+'', col: '#ffdca8' });
        if (e.hp <= 0) {
          enemies.splice(i, 1);
          kills++;
          // drop gem
          gems.push({ x: e.x, y: e.y, r: 5, value: 8 });
          if (Math.random() < 0.08) heals.push({ x: e.x, y: e.y, r: 6 });
          // gold chance
          if (Math.random() < 0.25) gold += 1;
        }
        hit++;
      }
    }
    // effect
    effects.push({ kind: 'slash', t: 0.18, max: 0.18 });
    sfx('slash');
    if (hit > 0) { shake.t = shake.max = 0.12; shake.mag = 8; sfx('hit'); }
  }

  function addXp(v) {
    const upgMeta = getUpgrades();
    levelState.xp += v * (1 + ((upgMeta.xp || 0) * 0.05));
    while (levelState.xp >= levelState.next) {
      levelState.xp -= levelState.next;
      levelState.level++;
      levelState.next = xpForLevel(levelState.level);
      showLevelUp();
      break; // show only one level prompt at a time
    }
  }

  function update(dt) {
    if (state !== 'RUNNING') return;

    timeAlive += dt;
    player.slashReadyIn = Math.max(0, player.slashReadyIn - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    if (shake.t > 0) shake.t = Math.max(0, shake.t - dt);
    // skills cooldown and effects
    for (const k in skills) { skills[k].t = Math.max(0, skills[k].t - dt); }
    const shield = effects.find(e => e.kind === 'shield');
    player.dmgReduce = shield ? 0.5 : 0;

    // wave tracking
    const { stageNum, waveInStageNum } = currentWaveFromTime(timeAlive);
    stage = stageNum; waveInStage = waveInStageNum;

    // movement
    let mx = 0, my = 0;
    if (K.LEFT.some(k => keys.has(k))) mx -= 1;
    if (K.RIGHT.some(k => keys.has(k))) mx += 1;
    if (K.UP.some(k => keys.has(k))) my -= 1;
    if (K.DOWN.some(k => keys.has(k))) my += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my) || 1;
      mx /= len; my /= len;
      player.x += mx * player.speed * dt;
      player.y += my * player.speed * dt;
    }
    player.x = clamp(player.x, 0, canvas.width);
    player.y = clamp(player.y, 0, canvas.height);

    // spawn pacing: base rate grows over time
    spawn.timer += dt;
    const spawnsPerSec = 0.9 + Math.min(3.0, timeAlive * 0.02); // 0.9 -> 3.0 over time
    const interval = 1 / spawnsPerSec;
    while (spawn.timer >= interval) {
      spawn.timer -= interval;
      spawnEnemy();
    }

    // schedule elites and bosses
    if (timeAlive >= nextEliteAt) { nextEliteAt += 120; spawnElite(); }
    if (timeAlive >= nextBossAt && !hasBoss()) { nextBossAt += 300; spawnBoss(); }

    // enemies update
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const dx = player.x - e.x, dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      if (e.type === 'boss') {
        // move
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;

        // phase scaling by HP
        const ratio = (e.maxHp ? e.hp / e.maxHp : 1);
        if (ratio < 0.3) { e.fireCd = 1.1; }
        else if (ratio < 0.6) { e.fireCd = 1.6; }
        else { e.fireCd = 2.2; }

        // alternate between ring and cone shots
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT += e.fireCd;
          if (e.fireMode === 'ring') {
            const bullets = ratio < 0.6 ? 14 : 10;
            const speed = 190 + (ratio < 0.3 ? 60 : 0);
            for (let k = 0; k < bullets; k++) {
              const ang = (Math.PI * 2 * k) / bullets;
              projectiles.push({ x: e.x, y: e.y, vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed, r: 5, dmg: 16, t: 4.0 });
            }
            e.fireMode = 'cone';
          } else {
            // cone aimed at player
            const baseAng = Math.atan2(player.y - e.y, player.x - e.x);
            const count = ratio < 0.3 ? 9 : 6;
            const spread = Math.PI / 6;
            const speed = 260 + (ratio < 0.3 ? 40 : 0);
            for (let i2 = 0; i2 < count; i2++) {
              const t = count === 1 ? 0 : (i2/(count-1))-0.5;
              const ang = baseAng + t * spread;
              projectiles.push({ x: e.x, y: e.y, vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed, r: 5, dmg: 18, t: 4.0 });
            }
            e.fireMode = 'ring';
          }
        }
      } else if (e.type === 'elite') {
        // tougher melee that occasionally dashes
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
        // small aura effect (visual only); damage handled on touch
      } else if (e.type === 'archer') {
        // keep distance; move towards if too far, away if too close
        const prefer = e.prefer;
        if (d > prefer + 20) { e.x += nx * e.speed * dt; e.y += ny * e.speed * dt; }
        else if (d < prefer - 20) { e.x -= nx * e.speed * dt; e.y -= ny * e.speed * dt; }
        // fire projectiles
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT += e.fireCd;
          const spd = 220 + Math.min(80, timeAlive * 2);
          projectiles.push({ x: e.x, y: e.y, vx: nx * spd, vy: ny * spd, r: 4, dmg: 10, t: 3.0 });
        }
      } else {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
      }
      e.hitTime = Math.max(0, e.hitTime - dt);

      // touching damages player
      const rr = (player.r + e.r);
      if (dist2(player.x, player.y, e.x, e.y) <= rr * rr) {
        const dmg = e.touchDps * dt;
        if (applyPlayerDamage(dmg)) return; // game over
      }
    }

    // projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt;
      // out of bounds or life over
      if (p.t <= 0 || p.x < -20 || p.x > canvas.width + 20 || p.y < -20 || p.y > canvas.height + 20) {
        projectiles.splice(i, 1); continue;
      }
      if (p.friendly) {
        // collide with enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          const rr = (e.r + p.r);
          if (dist2(e.x, e.y, p.x, p.y) <= rr * rr) {
            e.hp -= p.dmg;
            e.hitTime = 0.1;
            effects.push({ kind:'hitspark', x: e.x, y: e.y, t: 0.1, max: 0.1 });
            popups.push({ x: e.x, y: e.y-10, v: -30, t: 0.6, txt: Math.round(p.dmg)+'', col: '#ffdca8' });
            if (e.hp <= 0) { enemies.splice(j,1); kills++; gems.push({x:e.x,y:e.y,r:5,value:8}); if (Math.random()<0.08) heals.push({x:e.x,y:e.y,r:6}); const upgMeta3 = getUpgrades(); if (Math.random()<0.25*(1+((upgMeta3.gold||0)*0.10))) gold += 1; }
            projectiles.splice(i,1);
            break;
          }
        }
      } else {
        // collide with player
        const rr = (player.r + p.r);
        if (dist2(player.x, player.y, p.x, p.y) <= rr * rr) {
          if (applyPlayerDamage(p.dmg)) return; // game over
          projectiles.splice(i, 1);
        }
      }
    }

    // gems update (vacuum)
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      const d2 = dist2(player.x, player.y, g.x, g.y);
      const pr2 = player.pickupRange * player.pickupRange;
      if (d2 <= pr2) {
        const d = Math.sqrt(d2) || 1;
        const nx = (player.x - g.x) / d;
        const ny = (player.y - g.y) / d;
        const speed = 600;
        g.x += nx * speed * dt;
        g.y += ny * speed * dt;
      }
      // collect
      const rr = (player.r + g.r);
      if (dist2(player.x, player.y, g.x, g.y) <= rr * rr) {
        addXp(g.value);
        gems.splice(i, 1);
      }
    }

    // health orbs update (vacuum similar to gems)
    for (let i = heals.length - 1; i >= 0; i--) {
      const h = heals[i];
      const d2 = dist2(player.x, player.y, h.x, h.y);
      const pr2 = player.pickupRange * player.pickupRange;
      if (d2 <= pr2) {
        const d = Math.sqrt(d2) || 1;
        const nx = (player.x - h.x) / d;
        const ny = (player.y - h.y) / d;
        const speed = 550;
        h.x += nx * speed * dt;
        h.y += ny * speed * dt;
      }
      const rr = (player.r + h.r);
      if (dist2(player.x, player.y, h.x, h.y) <= rr * rr) {
        const heal = player.maxHp * 0.2;
        player.hp = Math.min(player.maxHp, player.hp + heal);
        heals.splice(i, 1);
      }
    }

    // chests update
    for (let i = chests.length - 1; i >= 0; i--) {
      const c = chests[i];
      // gentle attract
      const d2 = dist2(player.x, player.y, c.x, c.y);
      if (d2 < 400*400) {
        const d = Math.sqrt(d2)||1; const nx2=(player.x-c.x)/d, ny2=(player.y-c.y)/d;
        c.x += nx2 * 120 * dt; c.y += ny2 * 120 * dt;
      }
      const rr2 = (player.r + c.r);
      if (dist2(player.x, player.y, c.x, c.y) <= rr2 * rr2) {
        gold += c.gold;
        sfx('chest');
        chests.splice(i,1);
      }
    }

    // HUD
    hpFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
    xpFill.style.width = `${(levelState.xp / levelState.next) * 100}%`;
    levelLabel.textContent = `Lv ${levelState.level}`;
    timeLabel.textContent = fmtTime(timeAlive);
    killLabel.textContent = String(kills);
    goldLabel.textContent = String(gold);
    waveLabel.textContent = `${stage}-${waveInStage}`;

    // Skill cooldown UI
    for (const k of ['Q','W','E','R']) {
      const s = skills[k]; const el = skillEls[k]; if (!s || !el) continue;
      const denom = s.lastCd || (s.cd * (1 - player.cdr)) || 0.0001;
      const ratio = Math.max(0, Math.min(1, s.t / denom));
      const mask = el.querySelector('.mask'); const cd = el.querySelector('.cd');
      if (mask) mask.style.height = `${ratio*100}%`;
      if (cd) cd.textContent = s.t > 0 ? (s.t >= 1 ? Math.ceil(s.t).toString() : s.t.toFixed(1)) : '';
      el.classList.toggle('ready', s.t <= 0);
    }

    // Boss HUD
    const b = getBoss();
    if (b) {
      bossBar?.classList.remove('hidden');
      bossName.textContent = b.name || 'Boss';
      const pct = Math.max(0, Math.min(1, b.hp / (b.maxHp || b.hp)));
      bossFill.style.width = `${pct*100}%`;
    } else {
      bossBar?.classList.add('hidden');
    }
  }

  function applyPlayerDamage(raw) {
    if (player.invuln > 0) return false;
    const dmg = raw * (1 - player.dmgReduce);
    if (dmg <= 0) return false;
    player.hp -= dmg;
    effects.push({ kind:'hurt', t: 0.15, max: 0.15 });
    shake.t = shake.max = 0.18; shake.mag = 12;
    sfx('hurt');
    popups.push({ x: player.x, y: player.y-14, v: -22, t: 0.6, txt: '-'+Math.round(dmg), col: '#ff9aa2' });
    if (player.hp <= 0) { player.hp = 0; gameOver(); return true; }
    return false;
  }

  function render() {
    // clear + camera shake
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (shake.t > 0) {
      const p = shake.t / shake.max;
      const dx = (Math.random()*2-1) * shake.mag * p;
      const dy = (Math.random()*2-1) * shake.mag * p;
      ctx.translate(dx, dy);
    }

    // background grid
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#202436';
    ctx.lineWidth = 1;
    const grid = 40;
    for (let x = 0; x <= canvas.width; x += grid) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += grid) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(canvas.width, y + 0.5); ctx.stroke();
    }
    ctx.restore();

    // gems
    for (const g of gems) {
      ctx.beginPath();
      ctx.fillStyle = '#62d3a4';
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // enemies
    for (const e of enemies) {
      ctx.beginPath();
      if (e.type === 'boss') ctx.fillStyle = e.hitTime > 0 ? '#ff6b6b' : '#b84747';
      else if (e.type === 'elite') ctx.fillStyle = e.hitTime > 0 ? '#c7f36b' : '#84a63a';
      else if (e.type === 'archer') ctx.fillStyle = e.hitTime > 0 ? '#ffd28a' : '#d1a354';
      else ctx.fillStyle = e.hitTime > 0 ? '#ff9aa2' : '#c85a54';
      const scale = 1 + 2.0 * Math.max(0, e.hitTime); // brief pop on hit
      ctx.arc(e.x, e.y, e.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // projectiles
    for (const p of projectiles) {
      ctx.beginPath();
      ctx.fillStyle = p.friendly ? '#7aa2ff' : '#ffd28a';
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // health orbs
    for (const h of heals) {
      ctx.beginPath();
      ctx.fillStyle = '#ff4d6d';
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // player (image if available)
    const pImg = getCharImage(selectedCharacter);
    if (pImg && pImg.complete) {
      const size = player.r * 3;
      ctx.drawImage(pImg, player.x - size/2, player.y - size/2, size, size);
    } else {
      ctx.beginPath();
      ctx.fillStyle = '#7aa2ff';
      ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // chests
    for (const c of chests) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(Math.PI/4);
      ctx.fillStyle = '#f3cc4b';
      ctx.fillRect(-c.r, -c.r, c.r*2, c.r*2);
      ctx.restore();
    }

    // damage popups
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.t -= dtRender; p.y += p.v * dtRender;
      if (p.t <= 0) { popups.splice(i,1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.t / 0.6);
      ctx.fillStyle = p.col || '#fff';
      ctx.font = 'bold 14px Segoe UI, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(p.txt, p.x, p.y);
      ctx.restore();
    }

    // slash and other effects
    for (let i = effects.length - 1; i >= 0; i--) {
      const ef = effects[i];
      ef.t -= dtRender;
      if (ef.t <= 0) { effects.splice(i, 1); continue; }
      if (ef.kind === 'slash') {
        const p = ef.t / ef.max;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(180,200,255,${0.35 + 0.4 * p})`;
        ctx.lineWidth = 14 * p;
        ctx.arc(player.x, player.y, player.slashRange * (1.0 + 0.25 * (1-p)), 0, Math.PI * 2);
        ctx.stroke();
      } else if (ef.kind === 'hitspark') {
        const p = ef.t / ef.max;
        ctx.save();
        ctx.translate(ef.x, ef.y);
        ctx.strokeStyle = `rgba(255,245,200,${p})`;
        ctx.lineWidth = 2;
        for (let a=0; a<8; a++) {
          const ang = (Math.PI*2*a)/8;
          const len = 6 + 18*(1-p);
          ctx.beginPath();
          ctx.moveTo(0,0);
          ctx.lineTo(Math.cos(ang)*len, Math.sin(ang)*len);
          ctx.stroke();
        }
        ctx.restore();
      } else if (ef.kind === 'dash') {
        ctx.save();
        ctx.globalAlpha = ef.t / ef.max;
        ctx.fillStyle = '#7aa2ff55';
        ctx.beginPath();
        ctx.arc(player.x - ef.mx * 22, player.y - ef.my * 22, player.r * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (ef.kind === 'shield') {
        ctx.save();
        const p = ef.t / ef.max;
        ctx.strokeStyle = `rgba(98,211,164,${0.3 + 0.4 * p})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.r + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (ef.kind === 'nova') {
        const p = 1 - (ef.t / ef.max);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,200,80,${0.5 * (1-p)})`;
        ctx.lineWidth = 8 * (1-p);
        ctx.arc(player.x, player.y, 140 * p, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ef.kind === 'quake') {
        const p = 1 - (ef.t / ef.max);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(200,90,84,${0.5 * (1-p)})`;
        ctx.lineWidth = 12 * (1-p);
        ctx.arc(player.x, player.y, 220 * p, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ef.kind === 'boltcast') {
        ctx.save(); ctx.globalAlpha = ef.t/ef.max; ctx.fillStyle = '#7aa2ff88';
        ctx.beginPath(); ctx.arc(player.x, player.y, 10, 0, Math.PI*2); ctx.fill(); ctx.restore();
      } else if (ef.kind === 'zap') {
        ctx.save();
        ctx.strokeStyle = '#dff1ff'; ctx.lineWidth = 2; ctx.globalAlpha = ef.t/ef.max;
        for (const [x1,y1,x2,y2] of (ef.segs||[])) {
          ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        }
        ctx.restore();
      } else if (ef.kind === 'banner') {
        const p = 1 - (ef.t / ef.max);
        ctx.save();
        ctx.globalAlpha = 0.9 * (ef.t / ef.max);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Segoe UI, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(ef.text || '', canvas.width/2, 60 + 10*p);
        ctx.restore();
      } else if (ef.kind === 'hurt') {
        const p = ef.t / ef.max;
        ctx.save();
        ctx.globalAlpha = 0.25 * p;
        ctx.fillStyle = '#ff2a43';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    }
    ctx.restore();

    // debug overlay
    if (debug.show) {
      const text = `FPS ${fps}\nEN ${enemies.length}  PR ${projectiles.length}\nGM ${gems.length}  HL ${heals.length}\nCH ${chests.length}  FX ${effects.length}  DP ${popups.length}`;
      let el = document.getElementById('debug');
      if (!el) {
        el = document.createElement('div'); el.id = 'debug'; el.className = 'debug'; document.body.appendChild(el);
      }
      el.textContent = text;
    } else {
      const el = document.getElementById('debug'); if (el) el.remove();
    }
  }

  // Main loop
  let last = performance.now();
  let accumulator = 0;
  const fixedDt = 1/60;
  let dtRender = 0;
  let fps = 60; let fpsAcc = 0; let fpsFrames = 0; let fpsTimer = 0;
  // Simple SFX using WebAudio
  let audio; let audioMaster; let audioMuted = false;
  function lazyAudio() {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        audio = new Ctx();
        audioMaster = audio.createGain();
        audioMaster.gain.value = 0.7;
        audioMaster.connect(audio.destination);
        try { const m = JSON.parse(localStorage.getItem('evade_audio')||'{}'); if (m) { if (typeof m.muted === 'boolean') audioMuted = m.muted; if (typeof m.volume === 'number') audioMaster.gain.value = m.volume; else audioMaster.gain.value = audioMuted ? 0 : 0.7; } } catch {}
      }
    }
    if (audio && audio.state === 'suspended') audio.resume();
    return audio;
  }
  function saveAudioState() { try { localStorage.setItem('evade_audio', JSON.stringify({ muted: audioMuted, volume: audioMaster ? audioMaster.gain.value : 0.7 })); } catch {} }
  function toggleMute() { lazyAudio(); audioMuted = !audioMuted; if (audioMaster) audioMaster.gain.value = audioMuted ? 0 : (getSavedVolume() ?? 0.7); saveAudioState(); syncSettingsUI(); }
  function getSavedVolume() { try { const m = JSON.parse(localStorage.getItem('evade_audio')||'{}'); if (m && typeof m.volume === 'number') return m.volume; } catch {} return null; }
  function setVolumeFromUI() { lazyAudio(); const v = Math.max(0, Math.min(1, (parseInt(volMaster.value||'70',10) || 0)/100)); if (audioMaster) audioMaster.gain.value = v * (audioMuted ? 0 : 1); volLabel.textContent = String(Math.round(v*100)); saveAudioState(); }
  function setMuteFromUI() { lazyAudio(); audioMuted = !!muteToggle.checked; if (audioMaster) { const v = Math.max(0, Math.min(1, (parseInt(volMaster.value||'70',10) || 0)/100)); audioMaster.gain.value = audioMuted ? 0 : v; } saveAudioState(); }
  function syncSettingsUI() { const savedVol = getSavedVolume(); if (savedVol != null) { volMaster.value = String(Math.round(savedVol*100)); volLabel.textContent = String(Math.round(savedVol*100)); } else { volMaster.value = '70'; volLabel.textContent = '70'; } muteToggle.checked = audioMuted; }
  function beep(freq=440, dur=0.08, gain=0.02, type='sine') {
    const ac = lazyAudio(); if (!ac) return;
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    const now = ac.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(audioMaster || ac.destination);
    o.start(now); o.stop(now + dur + 0.02);
  }
  function sfx(name) {
    switch (name) {
      case 'slash': beep(700, 0.05, 0.03, 'triangle'); break;
      case 'hit': beep(220, 0.04, 0.03, 'square'); beep(440, 0.06, 0.02, 'triangle'); break;
      case 'hurt': beep(160, 0.08, 0.05, 'sawtooth'); break;
      case 'level': beep(880, 0.12, 0.04, 'sine'); beep(1320, 0.12, 0.03, 'sine'); break;
      case 'elite': beep(500, 0.10, 0.035, 'sawtooth'); break;
      case 'boss': beep(200, 0.20, 0.05, 'square'); break;
      case 'chest': beep(600, 0.08, 0.03, 'sine'); beep(900, 0.08, 0.02, 'sine'); break;
      default: break;
    }
  }
  function loop(now) {
    const raw = (now - last) / 1000; last = now;
    const frameDt = Math.min(0.1, raw);
    // fps smoothing
    fpsTimer += frameDt; fpsAcc += 1/frameDt; fpsFrames++;
    if (fpsTimer >= 0.5) { fps = Math.round(fpsAcc / fpsFrames); fpsAcc = 0; fpsFrames = 0; fpsTimer = 0; }
    accumulator += frameDt;
    while (accumulator >= fixedDt) {
      update(fixedDt);
      accumulator -= fixedDt;
      dtRender = fixedDt;
    }
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Start at menu
  gotoMenu();
})();
