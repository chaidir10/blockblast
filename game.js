/* ================================================
   Block Blast Premium — Game Engine
   Versi: 1.0.0
   ================================================ */

'use strict';

/* ══════════════════════════════════════════════
   KONSTANTA & KONFIGURASI
══════════════════════════════════════════════ */
const GRID_SIZE = 9;
const TRAY_SIZE = 3;

/* Warna blok — index 0–7 sesuai CSS .color-N */
const COLORS = [0, 1, 2, 3, 4, 5, 6, 7];

/* Definisi semua bentuk blok */
const SHAPES = [
  /* 1×1 */ [[1]],
  /* 1×2 */ [[1,1]],
  /* 2×1 */ [[1],[1]],
  /* 1×3 */ [[1,1,1]],
  /* 3×1 */ [[1],[1],[1]],
  /* 1×4 */ [[1,1,1,1]],
  /* 4×1 */ [[1],[1],[1],[1]],
  /* 1×5 */ [[1,1,1,1,1]],
  /* 5×1 */ [[1],[1],[1],[1],[1]],
  /* 2×2 */ [[1,1],[1,1]],
  /* 3×3 */ [[1,1,1],[1,1,1],[1,1,1]],
  /* 2×3 */ [[1,1],[1,1],[1,1]],
  /* 3×2 */ [[1,1,1],[1,1,1]],
  /* L kanan */ [[1,0],[1,0],[1,1]],
  /* L kiri  */ [[0,1],[0,1],[1,1]],
  /* L atas  */ [[1,1,1],[1,0,0]],
  /* L bawah */ [[1,0,0],[1,1,1]],
  /* J kanan */ [[1,1],[1,0],[1,0]],
  /* J kiri  */ [[1,1],[0,1],[0,1]],
  /* T atas  */ [[1,1,1],[0,1,0]],
  /* T bawah */ [[0,1,0],[1,1,1]],
  /* S */       [[0,1,1],[1,1,0]],
  /* Z */       [[1,1,0],[0,1,1]],
  /* Corner BL */ [[1,1],[1,0]],
  /* Corner BR */ [[1,1],[0,1]],
  /* Corner TL */ [[1,0],[1,1]],
  /* Corner TR */ [[0,1],[1,1]],
  /* Plus */ [[0,1,0],[1,1,1],[0,1,0]],
  /* Diagonal */ [[1,0,0],[0,1,0],[0,0,1]],
];

/* Skor per cell yang ditempatkan */
const POINTS_PER_CELL = 10;
/* Skor bonus per baris/kolom yang dihancurkan */
const POINTS_PER_LINE = 100;
/* Multiplier combo */
const COMBO_MULTIPLIER = [1, 1.5, 2, 2.5, 3, 4, 5];

/* ══════════════════════════════════════════════
   STATE GAME
══════════════════════════════════════════════ */
let grid = [];           // 9×9 array: null atau {color}
let tray = [];           // 3 slot: {shape, color} atau null
let score = 0;
let highScore = 0;
let combo = 0;
let lastPlaceCount = 0;  // jumlah baris/kolom dihancurkan di turn sebelumnya
let history = [];        // untuk Undo
let isGameOver = false;

/* Power-up mode aktif */
let activePowerup = null; // null | 'bomb' | 'hammer' | 'clearline'

/* Drag state */
let dragging = null; /* {
  slotIndex, shape, color,
  startX, startY,
  currentX, currentY,
  cellSize, gridGap
} */

/* ══════════════════════════════════════════════
   DOM REFERENCES
══════════════════════════════════════════════ */
const $grid        = document.getElementById('grid');
const $tray        = document.getElementById('tray');
const $ghost       = document.getElementById('drag-ghost');
const $score       = document.getElementById('score-val');
const $highScore   = document.getElementById('highscore-val');
const $comboDisp   = document.getElementById('combo-display');
const $gameOverlay = document.getElementById('game-over-overlay');
const $finalScore  = document.getElementById('final-score');
const $finalBest   = document.getElementById('final-best');
const $finalCombo  = document.getElementById('final-combo');
const $powerBanner = document.getElementById('powerup-mode-banner');
const $splash      = document.getElementById('splash');

/* ══════════════════════════════════════════════
   ANIMATED BACKGROUND (Canvas)
══════════════════════════════════════════════ */
(function initBackground() {
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function mkParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.4 + 0.05,
    };
  }

  function initParticles() {
    particles = Array.from({length: 90}, mkParticle);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    /* Radial gradient background */
    const grd = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W, H)*0.7);
    grd.addColorStop(0, 'rgba(30,10,60,1)');
    grd.addColorStop(1, 'rgba(8,8,20,1)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    /* Stars */
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,180,255,${p.alpha})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
    }
    requestAnimationFrame(draw);
  }

  resize();
  initParticles();
  draw();
  window.addEventListener('resize', () => { resize(); initParticles(); });
})();

/* ══════════════════════════════════════════════
   INISIALISASI GAME
══════════════════════════════════════════════ */
function init() {
  highScore = parseInt(localStorage.getItem('bb_highscore') || '0', 10);
  score     = 0;
  combo     = 0;
  history   = [];
  isGameOver = false;
  activePowerup = null;

  /* Bangun grid kosong */
  grid = Array.from({length: GRID_SIZE}, () => Array(GRID_SIZE).fill(null));

  renderGrid();
  generateTray();
  updateScoreUI();
  updateComboUI();

  $gameOverlay.classList.add('hidden');
}

/* ══════════════════════════════════════════════
   RENDER GRID
══════════════════════════════════════════════ */
function renderGrid() {
  $grid.innerHTML = '';
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      if (grid[r][c] !== null) {
        cell.classList.add('filled', `color-${grid[r][c]}`);
      }
      $grid.appendChild(cell);
    }
  }
  attachGridPointerEvents();
}

function getCell(r, c) {
  return $grid.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

/* ══════════════════════════════════════════════
   GENERATE TRAY
══════════════════════════════════════════════ */
function generateTray() {
  tray = Array.from({length: TRAY_SIZE}, () => randomPiece());
  renderTray();
}

function randomPiece() {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  return { shape, color };
}

function renderTray() {
  const slots = $tray.querySelectorAll('.tray-slot');
  slots.forEach((slot, i) => {
    slot.innerHTML = '';
    if (!tray[i]) return;
    const el = buildPieceElement(tray[i], false, i);
    el.classList.add('incoming');
    slot.appendChild(el);
  });
}

/* Bangun elemen blok untuk tray atau ghost */
function buildPieceElement(piece, isGhost, slotIndex) {
  const { shape, color } = piece;
  const rows = shape.length;
  const cols = shape[0].length;

  const wrapper = document.createElement('div');
  wrapper.className = 'block-piece';

  const grid_ = document.createElement('div');
  grid_.className = 'piece-grid';
  grid_.style.gridTemplateColumns = `repeat(${cols}, ${isGhost ? 42 : 28}px)`;
  grid_.style.gridTemplateRows    = `repeat(${rows}, ${isGhost ? 42 : 28}px)`;
  grid_.style.gap = isGhost ? '3px' : '2px';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = shape[r][c] ? `piece-cell color-${color}` : 'piece-cell empty';
      grid_.appendChild(cell);
    }
  }

  wrapper.appendChild(grid_);

  if (!isGhost && slotIndex !== undefined) {
    /* Touch events (prioritas utama) */
    wrapper.addEventListener('touchstart', (e) => onDragStart(e, slotIndex), {passive: false});
    wrapper.addEventListener('mousedown', (e) => onDragStart(e, slotIndex));
  }

  return wrapper;
}

/* ══════════════════════════════════════════════
   DRAG & DROP ENGINE
══════════════════════════════════════════════ */
function getCellSize() {
  const firstCell = $grid.querySelector('.cell');
  if (!firstCell) return 42;
  const rect = firstCell.getBoundingClientRect();
  return rect.width;
}

function getGridGap() {
  const cs = getComputedStyle($grid);
  return parseFloat(cs.gap) || 3;
}

function onDragStart(e, slotIndex) {
  if (isGameOver || activePowerup) return;
  if (!tray[slotIndex]) return;

  e.preventDefault();

  const piece = tray[slotIndex];
  const touch = e.touches ? e.touches[0] : e;

  const cellSize = getCellSize();
  const gridGap  = getGridGap();

  /* Hitung ukuran fisik blok */
  const pieceW = piece.shape[0].length * cellSize + (piece.shape[0].length - 1) * gridGap;
  const pieceH = piece.shape.length    * cellSize + (piece.shape.length    - 1) * gridGap;

  dragging = {
    slotIndex,
    shape: piece.shape,
    color: piece.color,
    cellSize,
    gridGap,
    pieceW,
    pieceH,
    currentX: touch.clientX,
    currentY: touch.clientY,
  };

  /* Tandai slot sebagai "diambil" */
  const slot = $tray.querySelectorAll('.tray-slot')[slotIndex];
  const orig = slot.querySelector('.block-piece');
  if (orig) orig.style.opacity = '0.3';

  /* Tampilkan ghost */
  $ghost.innerHTML = '';
  const ghostPiece = buildPieceElement(piece, true, undefined);
  $ghost.appendChild(ghostPiece);
  $ghost.style.display = 'block';
  positionGhost(touch.clientX, touch.clientY);

  /* Pasang event global */
  if (e.touches) {
    document.addEventListener('touchmove',  onDragMove,  {passive: false});
    document.addEventListener('touchend',   onDragEnd,   {passive: false});
    document.addEventListener('touchcancel',onDragCancel,{passive: false});
  } else {
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup',   onDragEnd);
  }
}

/* Offset vertikal ke atas agar blok tidak tertutup jari */
function getVerticalOffset(pieceH, cellSize) {
  /* Blok berada di atas jari: semakin besar blok, semakin tinggi offset */
  return pieceH + cellSize * 0.6;
}

function positionGhost(cx, cy) {
  if (!dragging) return;
  const { pieceW, pieceH, cellSize } = dragging;
  const offsetY = getVerticalOffset(pieceH, cellSize);
  const x = cx - pieceW / 2;
  const y = cy - offsetY;
  $ghost.style.left = x + 'px';
  $ghost.style.top  = y + 'px';
}

function onDragMove(e) {
  if (!dragging) return;
  e.preventDefault();

  const touch = e.touches ? e.touches[0] : e;
  dragging.currentX = touch.clientX;
  dragging.currentY = touch.clientY;

  positionGhost(touch.clientX, touch.clientY);
  updatePreview(touch.clientX, touch.clientY);
}

function onDragEnd(e) {
  if (!dragging) return;
  e.preventDefault();

  const touch = e.changedTouches ? e.changedTouches[0] : e;
  const dropResult = tryDrop(touch.clientX, touch.clientY);

  /* Kembalikan opacity slot */
  const slot = $tray.querySelectorAll('.tray-slot')[dragging.slotIndex];
  const orig = slot ? slot.querySelector('.block-piece') : null;

  if (!dropResult) {
    /* Gagal — kembalikan */
    if (orig) orig.style.opacity = '1';
  }

  clearPreview();
  $ghost.style.display = 'none';
  removeGlobalDragListeners();
  dragging = null;
}

function onDragCancel() {
  if (!dragging) return;
  const slot = $tray.querySelectorAll('.tray-slot')[dragging.slotIndex];
  const orig = slot ? slot.querySelector('.block-piece') : null;
  if (orig) orig.style.opacity = '1';

  clearPreview();
  $ghost.style.display = 'none';
  removeGlobalDragListeners();
  dragging = null;
}

function removeGlobalDragListeners() {
  document.removeEventListener('touchmove',   onDragMove);
  document.removeEventListener('touchend',    onDragEnd);
  document.removeEventListener('touchcancel', onDragCancel);
  document.removeEventListener('mousemove',   onDragMove);
  document.removeEventListener('mouseup',     onDragEnd);
}

/* ══════════════════════════════════════════════
   SNAPPING & PREVIEW
══════════════════════════════════════════════ */

/* Dapatkan posisi grid (row, col) dari koordinat layar */
function screenToGrid(cx, cy) {
  if (!dragging) return null;
  const { pieceH, cellSize, gridGap } = dragging;
  const offsetY = getVerticalOffset(pieceH, cellSize);

  /* Titik referensi: tengah bagian atas blok ghost */
  const ghostCenterX = cx;
  const ghostTopY    = cy - offsetY;

  const gridRect = $grid.getBoundingClientRect();

  /* Hitung kolom & baris dari ujung kiri-atas ghost */
  const relX = ghostCenterX - dragging.pieceW / 2 - gridRect.left;
  const relY = ghostTopY - gridRect.top;

  const step = cellSize + gridGap;
  const col  = Math.round(relX / step);
  const row  = Math.round(relY / step);

  return { row, col };
}

function canPlace(shape, row, col) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const gr = row + r;
      const gc = col + c;
      if (gr < 0 || gr >= GRID_SIZE || gc < 0 || gc >= GRID_SIZE) return false;
      if (grid[gr][gc] !== null) return false;
    }
  }
  return true;
}

/* Preview highlight saat drag */
function updatePreview(cx, cy) {
  if (!dragging) return;
  clearPreview();

  const pos = screenToGrid(cx, cy);
  if (!pos) return;

  const { shape } = dragging;
  const valid = canPlace(shape, pos.row, pos.col);
  const cls   = valid ? 'preview' : 'preview-invalid';

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const cell = getCell(pos.row + r, pos.col + c);
      if (cell) cell.classList.add(cls);
    }
  }
}

function clearPreview() {
  $grid.querySelectorAll('.preview, .preview-invalid').forEach(el => {
    el.classList.remove('preview', 'preview-invalid');
  });
}

/* ══════════════════════════════════════════════
   DROP LOGIC
══════════════════════════════════════════════ */
function tryDrop(cx, cy) {
  if (!dragging) return false;

  const pos = screenToGrid(cx, cy);
  if (!pos) return false;

  const { shape, color, slotIndex } = dragging;

  /* Cari posisi snap terdekat jika tidak tepat */
  let finalRow = pos.row;
  let finalCol = pos.col;
  let placed   = false;

  if (canPlace(shape, finalRow, finalCol)) {
    placed = true;
  } else {
    /* Coba offset ±1 untuk toleransi */
    outerLoop:
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        if (canPlace(shape, finalRow + dr, finalCol + dc)) {
          finalRow += dr;
          finalCol += dc;
          placed = true;
          break outerLoop;
        }
      }
    }
  }

  if (!placed) return false;

  /* Simpan state ke history untuk Undo */
  history.push({
    grid: grid.map(row => [...row]),
    tray: tray.map(t => t ? {...t, shape: t.shape.map(r=>[...r])} : null),
    score, combo
  });
  if (history.length > 20) history.shift();

  /* Tempatkan blok di grid */
  placePiece(shape, color, finalRow, finalCol);

  /* Hapus dari tray */
  tray[slotIndex] = null;

  /* Tambah skor */
  const cellCount = shape.flat().filter(Boolean).length;
  addScore(cellCount * POINTS_PER_CELL);

  /* Cek & hancurkan baris/kolom */
  const cleared = clearLines();

  if (cleared === 0) {
    combo = 0;
  } else {
    combo++;
  }

  /* Update UI */
  updateComboUI();
  updateScoreUI();

  /* Efek visual */
  const gridRect = $grid.getBoundingClientRect();
  const cellSize = getCellSize();
  const estX = gridRect.left + (finalCol + shape[0].length / 2) * (cellSize + getGridGap());
  const estY = gridRect.top  + (finalRow + shape.length   / 2) * (cellSize + getGridGap());
  spawnFloatScore(cellCount * POINTS_PER_CELL, estX, estY);
  spawnParticles(estX, estY, 8, getColorHex(color));

  /* Refill tray jika semua slot kosong */
  if (tray.every(t => t === null)) {
    generateTray();
  } else {
    renderTray();
  }

  /* Cek game over */
  if (!hasAnyMove()) {
    setTimeout(() => triggerGameOver(), 600);
  }

  return true;
}

function placePiece(shape, color, row, col) {
  const cells = [];
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      grid[row + r][col + c] = color;
      const cell = getCell(row + r, col + c);
      if (cell) {
        cell.classList.remove('preview', 'preview-invalid');
        cell.classList.add('filled', `color-${color}`);
        cell.classList.add('placing');
        setTimeout(() => cell.classList.remove('placing'), 400);
        cells.push(cell);
      }
    }
  }
}

/* ══════════════════════════════════════════════
   CLEAR LINES
══════════════════════════════════════════════ */
function clearLines() {
  const rowsToClear = [];
  const colsToClear = [];

  /* Cek baris penuh */
  for (let r = 0; r < GRID_SIZE; r++) {
    if (grid[r].every(v => v !== null)) rowsToClear.push(r);
  }

  /* Cek kolom penuh */
  for (let c = 0; c < GRID_SIZE; c++) {
    if (grid.every(row => row[c] !== null)) colsToClear.push(c);
  }

  const total = rowsToClear.length + colsToClear.length;
  if (total === 0) return 0;

  /* Kumpulkan sel unik untuk dihapus */
  const toRemove = new Set();
  rowsToClear.forEach(r => {
    for (let c = 0; c < GRID_SIZE; c++) toRemove.add(`${r},${c}`);
  });
  colsToClear.forEach(c => {
    for (let r = 0; r < GRID_SIZE; r++) toRemove.add(`${r},${c}`);
  });

  /* Animasi hapus */
  let delay = 0;
  for (const key of toRemove) {
    const [r, c] = key.split(',').map(Number);
    const cell = getCell(r, c);
    if (!cell) continue;
    const d = delay;
    setTimeout(() => {
      spawnParticles(
        cell.getBoundingClientRect().left + cell.offsetWidth / 2,
        cell.getBoundingClientRect().top  + cell.offsetHeight / 2,
        4,
        getColorHex(grid[r][c])
      );
      cell.classList.add('clearing');
    }, d);
    delay += 8; /* Stagger efek */
  }

  /* Hapus dari grid setelah animasi */
  setTimeout(() => {
    for (const key of toRemove) {
      const [r, c] = key.split(',').map(Number);
      grid[r][c] = null;
      const cell = getCell(r, c);
      if (cell) {
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
      }
    }
  }, delay + 100);

  /* Skor bonus */
  const baseBonus = total * POINTS_PER_LINE;
  const multi     = COMBO_MULTIPLIER[Math.min(combo, COMBO_MULTIPLIER.length - 1)];
  addScore(Math.round(baseBonus * multi));

  /* Float score bonus */
  setTimeout(() => {
    const gridRect = $grid.getBoundingClientRect();
    const cx = gridRect.left + gridRect.width / 2;
    const cy = gridRect.top  + gridRect.height / 2;
    if (combo >= 2) {
      spawnFloatScore(`COMBO x${combo}! +${Math.round(baseBonus * multi)}`, cx, cy - 40, 'combo');
    } else {
      spawnFloatScore(`+${Math.round(baseBonus * multi)}`, cx, cy - 20);
    }
  }, delay + 50);

  return total;
}

/* ══════════════════════════════════════════════
   SKOR & UI
══════════════════════════════════════════════ */
function addScore(points) {
  score += points;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('bb_highscore', highScore);
  }
}

function updateScoreUI() {
  $score.textContent     = score.toLocaleString();
  $highScore.textContent = highScore.toLocaleString();
  /* Animasi pop */
  $score.classList.remove('pop');
  void $score.offsetWidth;
  $score.classList.add('pop');
}

function updateComboUI() {
  if (combo >= 2) {
    $comboDisp.innerHTML =
      `<div class="combo-badge"><span class="combo-icon">🔥</span>COMBO x${combo}!</div>`;
  } else {
    $comboDisp.innerHTML = '';
  }
}

/* ══════════════════════════════════════════════
   EFEK VISUAL: PARTIKEL & FLOAT SCORE
══════════════════════════════════════════════ */
function spawnParticles(cx, cy, count, colorHex) {
  for (let i = 0; i < count; i++) {
    const el    = document.createElement('div');
    const angle = (Math.random() * 360) * Math.PI / 180;
    const dist  = 30 + Math.random() * 60;
    const tx    = Math.cos(angle) * dist;
    const ty    = Math.sin(angle) * dist - 20;
    const size  = 4 + Math.random() * 6;
    const dur   = 0.5 + Math.random() * 0.4;

    el.className = 'particle';
    el.style.cssText = `
      left:${cx - size/2}px; top:${cy - size/2}px;
      width:${size}px; height:${size}px;
      background:${colorHex};
      --tx:${tx}px; --ty:${ty}px;
      --rot:${Math.random()*360}deg;
      --dur:${dur}s;
      box-shadow: 0 0 ${size}px ${colorHex};
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), dur * 1000 + 50);
  }
}

function spawnFloatScore(text, cx, cy, type = '') {
  const el = document.createElement('div');
  el.className = `float-score ${type}`;
  el.textContent = text;
  el.style.left = cx + 'px';
  el.style.top  = cy + 'px';
  el.style.transform = 'translate(-50%, -50%)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

const COLOR_HEX = [
  '#6366f1','#a855f7','#ec4899','#f97316',
  '#f59e0b','#10b981','#06b6d4','#ef4444'
];
function getColorHex(idx) {
  return COLOR_HEX[idx] || '#ffffff';
}

/* ══════════════════════════════════════════════
   POWER-UPS
══════════════════════════════════════════════ */

/* Bomb: hapus area 3×3 di sekitar sel yang diklik */
function activateBomb() {
  activePowerup = 'bomb';
  showPowerupBanner('💣 Tap cell to BOMB!', '#ef4444');
  highlightGridForPowerup('bomb');
}

/* Hammer: hapus satu sel */
function activateHammer() {
  activePowerup = 'hammer';
  showPowerupBanner('🔨 Tap a block to SMASH!', '#f59e0b');
  highlightGridForPowerup('hammer');
}

/* Clear Line: hapus satu baris atau kolom */
function activateClearLine() {
  activePowerup = 'clearline';
  showPowerupBanner('⚡ Tap a row or column!', '#10b981');
  highlightGridForPowerup('clearline');
}

/* Shuffle: acak semua blok di tray */
function activateShuffle() {
  tray = Array.from({length: TRAY_SIZE}, () => randomPiece());
  renderTray();
  spawnParticles(window.innerWidth / 2, window.innerHeight / 2, 20, '#06b6d4');
  showPowerupBanner('🔀 Blocks Shuffled!', '#06b6d4');
  setTimeout(hidePowerupBanner, 1200);
}

/* Undo: kembali ke state sebelumnya */
function activateUndo() {
  if (history.length === 0) {
    showPowerupBanner('❌ Nothing to undo!', '#6366f1');
    setTimeout(hidePowerupBanner, 1000);
    return;
  }
  const prev = history.pop();
  grid    = prev.grid;
  tray    = prev.tray;
  score   = prev.score;
  combo   = prev.combo;
  if (score > highScore) highScore = score;
  renderGrid();
  renderTray();
  updateScoreUI();
  updateComboUI();
  showPowerupBanner('↩️ Undone!', '#7c3aed');
  setTimeout(hidePowerupBanner, 1000);
}

function showPowerupBanner(text, color) {
  $powerBanner.textContent  = text;
  $powerBanner.style.color  = color;
  $powerBanner.style.borderColor = color + '60';
  $powerBanner.classList.add('visible');
}

function hidePowerupBanner() {
  $powerBanner.classList.remove('visible');
}

function highlightGridForPowerup(type) {
  /* Hover effect di grid sudah di-handle via event */
}

/* Grid click handler untuk powerup */
function attachGridPointerEvents() {
  $grid.querySelectorAll('.cell').forEach(cell => {
    cell.addEventListener('click', onCellClick);
    cell.addEventListener('mouseenter', onCellHover);
    cell.addEventListener('mouseleave', onCellLeave);
    cell.addEventListener('touchend', onCellTouch, {passive: false});
  });
}

function onCellHover(e) {
  if (!activePowerup) return;
  const r = parseInt(e.target.dataset.r);
  const c = parseInt(e.target.dataset.c);
  clearCellHighlights();

  if (activePowerup === 'bomb') {
    /* Highlight 3×3 area */
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const cell = getCell(r + dr, c + dc);
        if (cell) cell.classList.add('select-bomb-hover');
      }
    }
  } else if (activePowerup === 'hammer') {
    e.target.classList.add('select-hover');
  } else if (activePowerup === 'clearline') {
    /* Highlight seluruh baris + kolom */
    for (let i = 0; i < GRID_SIZE; i++) {
      const rc = getCell(r, i);
      const cc = getCell(i, c);
      if (rc) rc.classList.add('select-hover');
      if (cc) cc.classList.add('select-hover');
    }
  }
}

function onCellLeave() {
  if (!activePowerup) return;
  clearCellHighlights();
}

function clearCellHighlights() {
  $grid.querySelectorAll('.select-hover, .select-bomb-hover').forEach(el => {
    el.classList.remove('select-hover', 'select-bomb-hover');
  });
}

function onCellTouch(e) {
  if (!activePowerup) return;
  e.preventDefault();
  const cell = e.currentTarget;
  handlePowerupCell(parseInt(cell.dataset.r), parseInt(cell.dataset.c));
}

function onCellClick(e) {
  if (!activePowerup) return;
  handlePowerupCell(parseInt(e.currentTarget.dataset.r), parseInt(e.currentTarget.dataset.c));
}

function handlePowerupCell(r, c) {
  /* Simpan ke history */
  history.push({
    grid: grid.map(row => [...row]),
    tray: tray.map(t => t ? {...t, shape: t.shape.map(row=>[...row])} : null),
    score, combo
  });
  if (history.length > 20) history.shift();

  if (activePowerup === 'bomb') {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const gr = r + dr, gc = c + dc;
        if (gr >= 0 && gr < GRID_SIZE && gc >= 0 && gc < GRID_SIZE) {
          if (grid[gr][gc] !== null) {
            const color = grid[gr][gc];
            const cell = getCell(gr, gc);
            if (cell) {
              const rect = cell.getBoundingClientRect();
              spawnParticles(rect.left + rect.width/2, rect.top + rect.height/2, 6, getColorHex(color));
              cell.classList.add('clearing');
              setTimeout(() => { cell.className = 'cell'; cell.dataset.r = gr; cell.dataset.c = gc; }, 450);
            }
            grid[gr][gc] = null;
            count++;
          }
        }
      }
    }
    addScore(count * POINTS_PER_CELL * 2);
    updateScoreUI();
  } else if (activePowerup === 'hammer') {
    if (grid[r][c] !== null) {
      const color = grid[r][c];
      const cell  = getCell(r, c);
      if (cell) {
        const rect = cell.getBoundingClientRect();
        spawnParticles(rect.left + rect.width/2, rect.top + rect.height/2, 10, getColorHex(color));
        cell.classList.add('clearing');
        setTimeout(() => { cell.className = 'cell'; cell.dataset.r = r; cell.dataset.c = c; }, 450);
      }
      grid[r][c] = null;
      addScore(POINTS_PER_CELL * 3);
      updateScoreUI();
    }
  } else if (activePowerup === 'clearline') {
    /* Tanya baris atau kolom — ambil keduanya langsung */
    let count = 0;
    for (let i = 0; i < GRID_SIZE; i++) {
      if (grid[r][i] !== null) { grid[r][i] = null; count++; }
      if (grid[i][c] !== null) { grid[i][c] = null; count++; }
    }
    /* Re-render */
    renderGrid();
    addScore(count * POINTS_PER_CELL * 2);
    updateScoreUI();
    spawnParticles(window.innerWidth/2, window.innerHeight/2, 20, '#10b981');
  }

  activePowerup = null;
  clearCellHighlights();
  hidePowerupBanner();
}

/* ══════════════════════════════════════════════
   GAME OVER
══════════════════════════════════════════════ */
function hasAnyMove() {
  for (const piece of tray) {
    if (!piece) continue;
    const { shape } = piece;
    for (let r = 0; r <= GRID_SIZE - shape.length; r++) {
      for (let c = 0; c <= GRID_SIZE - shape[0].length; c++) {
        if (canPlace(shape, r, c)) return true;
      }
    }
  }
  return false;
}

function triggerGameOver() {
  isGameOver = true;
  $finalScore.textContent = score.toLocaleString();
  $finalBest.textContent  = highScore.toLocaleString();
  $finalCombo.textContent = combo;
  $gameOverlay.classList.remove('hidden');
}

/* ══════════════════════════════════════════════
   EVENT LISTENERS UI
══════════════════════════════════════════════ */
document.getElementById('btn-restart')?.addEventListener('click', init);
document.getElementById('btn-restart-2')?.addEventListener('click', init);

document.getElementById('pw-bomb')?.addEventListener('click',      activateBomb);
document.getElementById('pw-hammer')?.addEventListener('click',    activateHammer);
document.getElementById('pw-shuffle')?.addEventListener('click',   activateShuffle);
document.getElementById('pw-undo')?.addEventListener('click',      activateUndo);
document.getElementById('pw-clearline')?.addEventListener('click', activateClearLine);

/* Batalkan powerup jika klik di luar grid */
document.addEventListener('click', (e) => {
  if (!activePowerup) return;
  if (!$grid.contains(e.target)) {
    activePowerup = null;
    clearCellHighlights();
    hidePowerupBanner();
  }
});

/* Cegah context menu saat long-press di mobile */
document.addEventListener('contextmenu', e => e.preventDefault());

/* ══════════════════════════════════════════════
   PWA SPLASH SCREEN
══════════════════════════════════════════════ */
window.addEventListener('load', () => {
  setTimeout(() => {
    if ($splash) {
      $splash.classList.add('fade-out');
      setTimeout(() => $splash.remove(), 450);
    }
    init();
  }, 1400);
});

/* ══════════════════════════════════════════════
   SERVICE WORKER REGISTRATION
══════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] SW registered:', reg.scope))
      .catch(err => console.warn('[PWA] SW failed:', err));
  });
}
