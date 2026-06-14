/* ================================================
   Block Blast Premium — Game Engine v2
   Fixes: layout, powerups, game-over, drag precision
   ================================================ */
'use strict';

/* ══════════════════════════════════════════════
   KONSTANTA
══════════════════════════════════════════════ */
const GRID_SIZE = 9;
const TRAY_SIZE = 3;
const COLORS    = [0, 1, 2, 3, 4, 5, 6, 7];

const SHAPES = [
  [[1]],
  [[1,1]],
  [[1],[1]],
  [[1,1,1]],
  [[1],[1],[1]],
  [[1,1,1,1]],
  [[1],[1],[1],[1]],
  [[1,1,1,1,1]],
  [[1],[1],[1],[1],[1]],
  [[1,1],[1,1]],
  [[1,1,1],[1,1,1],[1,1,1]],
  [[1,1],[1,1],[1,1]],
  [[1,1,1],[1,1,1]],
  [[1,0],[1,0],[1,1]],
  [[0,1],[0,1],[1,1]],
  [[1,1,1],[1,0,0]],
  [[1,0,0],[1,1,1]],
  [[1,1],[1,0],[1,0]],
  [[1,1],[0,1],[0,1]],
  [[1,1,1],[0,1,0]],
  [[0,1,0],[1,1,1]],
  [[0,1,1],[1,1,0]],
  [[1,1,0],[0,1,1]],
  [[1,1],[1,0]],
  [[1,1],[0,1]],
  [[1,0],[1,1]],
  [[0,1],[1,1]],
  [[0,1,0],[1,1,1],[0,1,0]],
];

const PTS_CELL = 10;
const PTS_LINE = 100;
const COMBO_MULTI = [1, 1.5, 2, 2.5, 3, 4, 5];
const COLOR_HEX = [
  '#6366f1','#a855f7','#ec4899','#f97316',
  '#f59e0b','#10b981','#06b6d4','#ef4444'
];

/* ══════════════════════════════════════════════
   SETTINGS — drag responsiveness & offset
══════════════════════════════════════════════ */
let settings = {
  responsiveness: 80,   // 0=smooth lerp, 100=instant
  offsetFactor:   60,   // 0=close to finger, 100=far
};

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('bb_settings') || '{}');
    if (s.responsiveness != null) settings.responsiveness = s.responsiveness;
    if (s.offsetFactor   != null) settings.offsetFactor   = s.offsetFactor;
  } catch(e) {}
  applySettingsUI();
}
function saveSettings() {
  localStorage.setItem('bb_settings', JSON.stringify(settings));
}
function applySettingsUI() {
  document.getElementById('resp-slider').value   = settings.responsiveness;
  document.getElementById('offset-slider').value = settings.offsetFactor;
  updateSliderDesc();
}
function updateSliderDesc() {
  const r = settings.responsiveness;
  const o = settings.offsetFactor;
  const rLabel = r < 30 ? 'Low' : r < 60 ? 'Medium' : r < 85 ? 'High' : 'Instant';
  const oLabel = o < 30 ? 'Close' : o < 60 ? 'Normal' : o < 85 ? 'Far' : 'Very Far';
  document.getElementById('resp-desc').textContent   = `Current: ${rLabel} (${r})`;
  document.getElementById('offset-desc').textContent = `Current: ${oLabel} (${o})`;
}

/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
let grid       = [];
let tray       = [];
let score      = 0;
let highScore  = 0;
let combo      = 0;
let history    = [];
let isGameOver = false;
let activePU   = null;   // null | 'bomb' | 'hammer' | 'clearline'

/* ── Drag state ── */
let drag = null;
/* drag = {
  slotIndex, shape, color,
  cellSize, gridGap,
  ghostW, ghostH,        // pixel size of ghost element
  targetX, targetY,      // where ghost SHOULD be (top-left)
  currentX, currentY,    // where ghost IS right now (for lerp)
  fingerX, fingerY,      // raw finger position
  rafId,
  lastTime,
} */

/* ══════════════════════════════════════════════
   DOM
══════════════════════════════════════════════ */
const $grid        = document.getElementById('grid');
const $tray        = document.getElementById('tray');
const $ghost       = document.getElementById('drag-ghost');
const $scoreEl     = document.getElementById('score-val');
const $hsEl        = document.getElementById('highscore-val');
const $comboEl     = document.getElementById('combo-display');
const $gameOver    = document.getElementById('game-over-overlay');
const $finalScore  = document.getElementById('final-score');
const $finalBest   = document.getElementById('final-best');
const $finalCombo  = document.getElementById('final-combo');
const $puBanner    = document.getElementById('powerup-mode-banner');
const $puCancel    = document.getElementById('powerup-cancel-zone');
const $splash      = document.getElementById('splash');

/* ══════════════════════════════════════════════
   ANIMATED BG
══════════════════════════════════════════════ */
(function initBG() {
  const cv  = document.getElementById('bg-canvas');
  const ctx = cv.getContext('2d');
  let W, H, stars = [];

  function resize() {
    W = cv.width  = window.innerWidth;
    H = cv.height = window.innerHeight;
  }
  function mkStar() {
    return {
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.4 + 0.2,
      vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
      a: Math.random() * 0.45 + 0.04,
    };
  }
  function initStars() { stars = Array.from({length:80}, mkStar); }
  function draw() {
    ctx.clearRect(0,0,W,H);
    const g = ctx.createRadialGradient(W/2,H/2,0, W/2,H/2, Math.max(W,H)*0.72);
    g.addColorStop(0,'rgba(28,10,55,1)');
    g.addColorStop(1,'rgba(7,7,18,1)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    for (const s of stars) {
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fillStyle = `rgba(210,190,255,${s.a})`; ctx.fill();
      s.x += s.vx; s.y += s.vy;
      if (s.x<0) s.x=W; if (s.x>W) s.x=0;
      if (s.y<0) s.y=H; if (s.y>H) s.y=0;
    }
    requestAnimationFrame(draw);
  }
  resize(); initStars(); draw();
  window.addEventListener('resize', ()=>{ resize(); initStars(); });
})();

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
function init() {
  highScore  = parseInt(localStorage.getItem('bb_highscore') || '0', 10);
  score      = 0;
  combo      = 0;
  history    = [];
  isGameOver = false;
  activePU   = null;

  grid = Array.from({length:GRID_SIZE}, () => Array(GRID_SIZE).fill(null));

  hidePUBanner();
  $puCancel.classList.remove('visible');
  document.querySelectorAll('.powerup-btn').forEach(b => b.classList.remove('active-pu'));

  renderGrid();
  generateTray();
  updateScoreUI();
  updateComboUI();
  $gameOver.classList.add('hidden');
}

/* ══════════════════════════════════════════════
   GRID RENDER
══════════════════════════════════════════════ */
function renderGrid() {
  $grid.innerHTML = '';
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r; cell.dataset.c = c;
      if (grid[r][c] !== null)
        cell.classList.add('filled', `color-${grid[r][c]}`);
      $grid.appendChild(cell);
    }
  }
  bindGridEvents();
}

function getCell(r, c) {
  if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return null;
  return $grid.children[r * GRID_SIZE + c] || null;
}

/* ══════════════════════════════════════════════
   TRAY
══════════════════════════════════════════════ */
function generateTray() {
  tray = Array.from({length:TRAY_SIZE}, randomPiece);
  renderTray();
}

function randomPiece() {
  return {
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

/* Tray piece cell size */
const TRAY_CELL = 26;
const TRAY_GAP  = 2;
/* Ghost (drag) cell size = grid cell size — measured at drag start */

function renderTray() {
  const slots = $tray.querySelectorAll('.tray-slot');
  slots.forEach((slot, i) => {
    slot.innerHTML = '';
    if (!tray[i]) return;
    const el = buildPieceEl(tray[i], TRAY_CELL, TRAY_GAP, i);
    el.classList.add('incoming');
    slot.appendChild(el);
  });
}

function buildPieceEl(piece, cellPx, gapPx, slotIndex) {
  const { shape, color } = piece;
  const rows = shape.length, cols = shape[0].length;
  const wrap = document.createElement('div');
  wrap.className = 'block-piece';

  const pg = document.createElement('div');
  pg.className = 'piece-grid';
  pg.style.gridTemplateColumns = `repeat(${cols},${cellPx}px)`;
  pg.style.gridTemplateRows    = `repeat(${rows},${cellPx}px)`;
  pg.style.gap = `${gapPx}px`;

  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const cl = document.createElement('div');
      cl.className = shape[r][c] ? `piece-cell color-${color}` : 'piece-cell empty';
      pg.appendChild(cl);
    }

  wrap.appendChild(pg);

  if (slotIndex !== undefined) {
    wrap.addEventListener('touchstart', e => startDrag(e, slotIndex), {passive:false});
    wrap.addEventListener('mousedown',  e => startDrag(e, slotIndex));
  }
  return wrap;
}

/* ══════════════════════════════════════════════
   HELPERS: cell / gap sizes
══════════════════════════════════════════════ */
function getCellSize() {
  const c = $grid.children[0];
  return c ? c.getBoundingClientRect().width : 40;
}
function getGap() {
  return parseFloat(getComputedStyle($grid).gap) || 3;
}

/* ══════════════════════════════════════════════
   DRAG — START
══════════════════════════════════════════════ */
function startDrag(e, slotIndex) {
  if (isGameOver || activePU) return;
  if (!tray[slotIndex]) return;
  e.preventDefault();

  const piece = tray[slotIndex];
  const pt    = e.touches ? e.touches[0] : e;
  const cellPx = getCellSize();
  const gapPx  = getGap();

  const cols = piece.shape[0].length;
  const rows = piece.shape.length;
  const ghostW = cols * cellPx + (cols - 1) * gapPx;
  const ghostH = rows * cellPx + (rows - 1) * gapPx;

  /* Build ghost visually same size as grid cells */
  $ghost.innerHTML = '';
  const ghostEl = buildPieceEl(piece, cellPx, gapPx, undefined);
  /* Style ghost cells to match grid cell size */
  ghostEl.querySelectorAll('.piece-cell').forEach(c => {
    c.style.width  = cellPx + 'px';
    c.style.height = cellPx + 'px';
    c.style.borderRadius = '6px';
  });
  $ghost.appendChild(ghostEl);
  $ghost.style.display = 'block';

  /* Dim original piece in tray */
  const slot = $tray.querySelectorAll('.tray-slot')[slotIndex];
  const orig = slot?.querySelector('.block-piece');
  if (orig) orig.style.opacity = '0.25';

  const offsetY = computeOffsetY(ghostH, cellPx);
  const startX  = pt.clientX - ghostW / 2;
  const startY  = pt.clientY - offsetY;

  drag = {
    slotIndex, shape: piece.shape, color: piece.color,
    cellSize: cellPx, gridGap: gapPx,
    ghostW, ghostH,
    targetX: startX, targetY: startY,
    currentX: startX, currentY: startY,
    fingerX: pt.clientX, fingerY: pt.clientY,
    rafId: null, lastTime: performance.now(),
  };

  /* Place ghost immediately at computed position */
  setGhostPos(startX, startY);
  updatePreview(pt.clientX, pt.clientY);

  /* Start lerp loop */
  drag.rafId = requestAnimationFrame(dragLoop);

  if (e.touches) {
    document.addEventListener('touchmove',   onDragMove, {passive:false});
    document.addEventListener('touchend',    onDragEnd,  {passive:false});
    document.addEventListener('touchcancel', cancelDrag, {passive:false});
  } else {
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup',   onDragEnd);
  }
}

/* ══════════════════════════════════════════════
   DRAG — LOOP (lerp for smoothness, or instant)
══════════════════════════════════════════════ */
function dragLoop(now) {
  if (!drag) return;

  /* Responsiveness: 100 = instant, 0 = very slow lerp */
  /* Map 0-100 → lerp factor per frame */
  /* At 100: factor = 1 (snap instantly) */
  /* At 0: factor = 0.05 (very smooth) */
  const resp  = settings.responsiveness / 100;
  const lerp  = 0.05 + resp * 0.95; /* 0.05..1.0 */

  drag.currentX += (drag.targetX - drag.currentX) * lerp;
  drag.currentY += (drag.targetY - drag.currentY) * lerp;

  /* Snap when close enough */
  if (Math.abs(drag.targetX - drag.currentX) < 0.5) drag.currentX = drag.targetX;
  if (Math.abs(drag.targetY - drag.currentY) < 0.5) drag.currentY = drag.targetY;

  setGhostPos(drag.currentX, drag.currentY);
  drag.rafId = requestAnimationFrame(dragLoop);
}

function setGhostPos(x, y) {
  $ghost.style.left = x + 'px';
  $ghost.style.top  = y + 'px';
}

/* ══════════════════════════════════════════════
   DRAG — MOVE
══════════════════════════════════════════════ */
function onDragMove(e) {
  if (!drag) return;
  e.preventDefault();
  const pt = e.touches ? e.touches[0] : e;
  drag.fingerX = pt.clientX;
  drag.fingerY = pt.clientY;

  const offsetY = computeOffsetY(drag.ghostH, drag.cellSize);
  drag.targetX  = pt.clientX - drag.ghostW / 2;
  drag.targetY  = pt.clientY - offsetY;

  updatePreview(pt.clientX, pt.clientY);
}

/* ══════════════════════════════════════════════
   DRAG — END
══════════════════════════════════════════════ */
function onDragEnd(e) {
  if (!drag) return;
  e.preventDefault();
  const pt = e.changedTouches ? e.changedTouches[0] : e;

  cancelAnimationFrame(drag.rafId);

  const dropped = tryDrop(pt.clientX, pt.clientY);
  if (!dropped) restoreTraySlot(drag.slotIndex);

  clearPreview();
  $ghost.style.display = 'none';
  removeDragListeners();
  drag = null;
}

function cancelDrag() {
  if (!drag) return;
  cancelAnimationFrame(drag.rafId);
  restoreTraySlot(drag.slotIndex);
  clearPreview();
  $ghost.style.display = 'none';
  removeDragListeners();
  drag = null;
}

function restoreTraySlot(i) {
  const slot = $tray.querySelectorAll('.tray-slot')[i];
  const orig = slot?.querySelector('.block-piece');
  if (orig) orig.style.opacity = '1';
}

function removeDragListeners() {
  document.removeEventListener('touchmove',   onDragMove);
  document.removeEventListener('touchend',    onDragEnd);
  document.removeEventListener('touchcancel', cancelDrag);
  document.removeEventListener('mousemove',   onDragMove);
  document.removeEventListener('mouseup',     onDragEnd);
}

/* ══════════════════════════════════════════════
   OFFSET above finger
   offsetFactor 0→100 maps to 0.8× .. 2.4× ghostH
══════════════════════════════════════════════ */
function computeOffsetY(ghostH, cellPx) {
  const f   = settings.offsetFactor / 100; // 0..1
  const min = ghostH + cellPx * 0.4;       // close
  const max = ghostH + cellPx * 2.2;       // very far
  return min + (max - min) * f;
}

/* ══════════════════════════════════════════════
   SCREEN → GRID coordinate
══════════════════════════════════════════════ */
function screenToGrid(fingerX, fingerY) {
  if (!drag) return null;
  const offsetY = computeOffsetY(drag.ghostH, drag.cellSize);
  const ghostLeft = fingerX - drag.ghostW / 2;
  const ghostTop  = fingerY - offsetY;

  const rect = $grid.getBoundingClientRect();
  const step = drag.cellSize + drag.gridGap;

  const col = Math.round((ghostLeft - rect.left) / step);
  const row = Math.round((ghostTop  - rect.top)  / step);
  return { row, col };
}

/* ══════════════════════════════════════════════
   CAN PLACE
══════════════════════════════════════════════ */
function canPlace(shape, row, col) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const gr = row + r, gc = col + c;
      if (gr < 0 || gr >= GRID_SIZE || gc < 0 || gc >= GRID_SIZE) return false;
      if (grid[gr][gc] !== null) return false;
    }
  return true;
}

/* ══════════════════════════════════════════════
   PREVIEW
══════════════════════════════════════════════ */
function updatePreview(fx, fy) {
  if (!drag) return;
  clearPreview();
  const pos = screenToGrid(fx, fy);
  if (!pos) return;
  const valid = canPlace(drag.shape, pos.row, pos.col);
  const cls   = valid ? 'preview' : 'preview-invalid';
  for (let r = 0; r < drag.shape.length; r++)
    for (let c = 0; c < drag.shape[r].length; c++) {
      if (!drag.shape[r][c]) continue;
      const cell = getCell(pos.row + r, pos.col + c);
      if (cell) cell.classList.add(cls);
    }
}

function clearPreview() {
  $grid.querySelectorAll('.preview,.preview-invalid').forEach(el =>
    el.classList.remove('preview','preview-invalid')
  );
}

/* ══════════════════════════════════════════════
   TRY DROP
══════════════════════════════════════════════ */
function tryDrop(fx, fy) {
  if (!drag) return false;
  const pos = screenToGrid(fx, fy);
  if (!pos) return false;

  let { row, col } = pos;
  let placed = false;

  /* Exact match first */
  if (canPlace(drag.shape, row, col)) {
    placed = true;
  } else {
    /* Tolerance snap: try ±1 in all 8 directions */
    outer:
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        if (canPlace(drag.shape, row+dr, col+dc)) {
          row += dr; col += dc; placed = true; break outer;
        }
      }
  }
  if (!placed) return false;

  /* Save history */
  pushHistory();

  /* Place on grid */
  placePiece(drag.shape, drag.color, row, col);
  tray[drag.slotIndex] = null;

  /* Score: cells */
  const cellCnt = drag.shape.flat().filter(Boolean).length;
  addScore(cellCnt * PTS_CELL);

  /* Clear lines — must happen AFTER grid state update */
  const cleared = clearLines();
  combo = cleared > 0 ? combo + 1 : 0;

  updateComboUI();
  updateScoreUI();

  /* Visual FX */
  const rect = $grid.getBoundingClientRect();
  const step = drag.cellSize + drag.gridGap;
  const fxX  = rect.left + (col + drag.shape[0].length/2) * step;
  const fxY  = rect.top  + (row + drag.shape.length/2)    * step;
  spawnFloat(`+${cellCnt * PTS_CELL}`, fxX, fxY);
  spawnParticles(fxX, fxY, 8, COLOR_HEX[drag.color]);

  /* Refill tray */
  if (tray.every(t => t === null)) generateTray();
  else renderTray();

  /* Check game over — with delay so animation plays first */
  setTimeout(checkGameOver, 450);
  return true;
}

function placePiece(shape, color, row, col) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      grid[row+r][col+c] = color;
      const cell = getCell(row+r, col+c);
      if (cell) {
        cell.className = `cell filled color-${color} placing`;
        cell.dataset.r = row+r; cell.dataset.c = col+c;
        setTimeout(() => cell.classList.remove('placing'), 350);
      }
    }
}

/* ══════════════════════════════════════════════
   CLEAR LINES
══════════════════════════════════════════════ */
function clearLines() {
  const rows = [], cols = [];
  for (let r = 0; r < GRID_SIZE; r++)
    if (grid[r].every(v => v !== null)) rows.push(r);
  for (let c = 0; c < GRID_SIZE; c++)
    if (grid.every(row => row[c] !== null)) cols.push(c);

  const total = rows.length + cols.length;
  if (!total) return 0;

  /* Collect unique cells */
  const toRemove = new Set();
  rows.forEach(r => { for (let c=0;c<GRID_SIZE;c++) toRemove.add(r*GRID_SIZE+c); });
  cols.forEach(c => { for (let r=0;r<GRID_SIZE;r++) toRemove.add(r*GRID_SIZE+c); });

  /* Stagger animation */
  let delay = 0;
  for (const key of toRemove) {
    const r = Math.floor(key / GRID_SIZE), c = key % GRID_SIZE;
    const cell = getCell(r, c);
    if (!cell) continue;
    const clr = COLOR_HEX[grid[r][c]] || '#fff';
    const d   = delay;
    setTimeout(() => {
      const rect = cell.getBoundingClientRect();
      spawnParticles(rect.left+rect.width/2, rect.top+rect.height/2, 5, clr);
      cell.classList.add('clearing');
    }, d);
    delay += 10;
  }

  /* Update grid data + DOM after animation */
  setTimeout(() => {
    for (const key of toRemove) {
      const r = Math.floor(key / GRID_SIZE), c = key % GRID_SIZE;
      grid[r][c] = null;
      const cell = getCell(r, c);
      if (cell) {
        cell.className = 'cell';
        cell.dataset.r = r; cell.dataset.c = c;
      }
    }
  }, delay + 80);

  /* Score bonus */
  const multi = COMBO_MULTI[Math.min(combo, COMBO_MULTI.length-1)];
  const bonus = Math.round(total * PTS_LINE * multi);
  addScore(bonus);

  /* Float score */
  setTimeout(() => {
    const rect = $grid.getBoundingClientRect();
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    const txt = combo >= 2
      ? `COMBO x${combo+1}!  +${bonus}`
      : `+${bonus}`;
    spawnFloat(txt, cx, cy - 30, combo >= 2 ? 'combo' : '');
  }, delay + 40);

  return total;
}

/* ══════════════════════════════════════════════
   GAME OVER CHECK — robust version
══════════════════════════════════════════════ */
function checkGameOver() {
  if (isGameOver) return;

  /* Check every non-null tray piece */
  for (const piece of tray) {
    if (!piece) continue;
    if (hasMoveForPiece(piece.shape)) return; /* at least one move exists */
  }

  /* No move found for any piece — game over */
  isGameOver = true;
  $finalScore.textContent = score.toLocaleString();
  $finalBest.textContent  = highScore.toLocaleString();
  $finalCombo.textContent = combo;
  $gameOver.classList.remove('hidden');
}

function hasMoveForPiece(shape) {
  const maxR = GRID_SIZE - shape.length;
  const maxC = GRID_SIZE - shape[0].length;
  for (let r = 0; r <= maxR; r++)
    for (let c = 0; c <= maxC; c++)
      if (canPlace(shape, r, c)) return true;
  return false;
}

/* ══════════════════════════════════════════════
   SCORE & UI
══════════════════════════════════════════════ */
function addScore(pts) {
  score += pts;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('bb_highscore', highScore);
  }
}
function updateScoreUI() {
  $scoreEl.textContent = score.toLocaleString();
  $hsEl.textContent    = highScore.toLocaleString();
  $scoreEl.classList.remove('pop');
  void $scoreEl.offsetWidth;
  $scoreEl.classList.add('pop');
}
function updateComboUI() {
  if (combo >= 2)
    $comboEl.innerHTML =
      `<div class="combo-badge"><span class="combo-fire">🔥</span>COMBO x${combo}!</div>`;
  else
    $comboEl.innerHTML = '';
}

/* ══════════════════════════════════════════════
   VISUAL FX
══════════════════════════════════════════════ */
function spawnParticles(cx, cy, n, hex) {
  for (let i = 0; i < n; i++) {
    const el  = document.createElement('div');
    const ang = Math.random() * Math.PI * 2;
    const d   = 28 + Math.random() * 55;
    const sz  = 3 + Math.random() * 5;
    const dur = 0.45 + Math.random() * 0.35;
    el.className = 'particle';
    el.style.cssText =
      `left:${cx-sz/2}px;top:${cy-sz/2}px;width:${sz}px;height:${sz}px;` +
      `background:${hex};box-shadow:0 0 ${sz}px ${hex};` +
      `--tx:${Math.cos(ang)*d}px;--ty:${Math.sin(ang)*d-18}px;` +
      `--rot:${Math.random()*360}deg;--dur:${dur}s;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), (dur+0.1)*1000);
  }
}
function spawnFloat(txt, cx, cy, cls='') {
  const el = document.createElement('div');
  el.className = `float-score ${cls}`;
  el.textContent = txt;
  el.style.cssText = `left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

/* ══════════════════════════════════════════════
   HISTORY (Undo)
══════════════════════════════════════════════ */
function pushHistory() {
  history.push({
    grid:  grid.map(row => [...row]),
    tray:  tray.map(t => t ? {...t, shape: t.shape.map(r=>[...r])} : null),
    score, combo,
  });
  if (history.length > 20) history.shift();
}

/* ══════════════════════════════════════════════
   POWERUPS
══════════════════════════════════════════════ */

/* ── activate ── */
function setPU(type) {
  /* toggle off */
  if (activePU === type) {
    activePU = null;
    hidePUBanner();
    $puCancel.classList.remove('visible');
    document.querySelectorAll('.powerup-btn').forEach(b=>b.classList.remove('active-pu'));
    return;
  }

  activePU = type;
  document.querySelectorAll('.powerup-btn').forEach(b=>b.classList.remove('active-pu'));
  document.getElementById(`pw-${type}`)?.classList.add('active-pu');
  $puCancel.classList.add('visible');

  const msgs = {
    bomb:      { txt:'💣 Tap cell to BOMB a 3×3 area', color:'#ef4444' },
    hammer:    { txt:'🔨 Tap any block to destroy it', color:'#f59e0b' },
    clearline: { txt:'⚡ Tap to clear row + column',    color:'#10b981' },
  };
  const m = msgs[type];
  if (m) showPUBanner(m.txt, m.color);
}

function activateShuffle() {
  pushHistory();
  tray = Array.from({length:TRAY_SIZE}, randomPiece);
  renderTray();
  spawnParticles(window.innerWidth/2, window.innerHeight*0.6, 22, '#06b6d4');
  showPUBanner('🔀 Blocks Shuffled!', '#06b6d4');
  setTimeout(hidePUBanner, 1200);
}

function activateUndo() {
  if (!history.length) {
    showPUBanner('↩ Nothing to undo', '#6366f1');
    setTimeout(hidePUBanner, 1000);
    return;
  }
  const prev = history.pop();
  grid  = prev.grid;
  tray  = prev.tray;
  score = prev.score;
  combo = prev.combo;
  if (score > highScore) highScore = score;
  isGameOver = false;
  $gameOver.classList.add('hidden');
  renderGrid();
  renderTray();
  updateScoreUI();
  updateComboUI();
  showPUBanner('↩ Undone!', '#a855f7');
  setTimeout(hidePUBanner, 900);
}

/* ── banner ── */
function showPUBanner(txt, color) {
  $puBanner.innerHTML =
    `${txt}<span class="pu-cancel">Tap outside grid to cancel</span>`;
  $puBanner.style.color = color;
  $puBanner.style.borderColor = color + '55';
  $puBanner.classList.add('visible');
}
function hidePUBanner() {
  $puBanner.classList.remove('visible');
}

/* Cancel zone — tap outside grid while PU active */
$puCancel.addEventListener('click', (e) => {
  /* Check if click is on grid — if yes, let grid handle it */
  if ($grid.contains(e.target)) return;
  deactivatePU();
});
$puCancel.addEventListener('touchend', (e) => {
  if ($grid.contains(e.target)) return;
  deactivatePU();
});

function deactivatePU() {
  activePU = null;
  hidePUBanner();
  $puCancel.classList.remove('visible');
  clearCellHL();
  document.querySelectorAll('.powerup-btn').forEach(b=>b.classList.remove('active-pu'));
}

/* ══════════════════════════════════════════════
   GRID EVENTS (powerup interaction + hover HL)
══════════════════════════════════════════════ */
function bindGridEvents() {
  /* Use event delegation on $grid for performance */
  $grid.addEventListener('click',      onGridClick);
  $grid.addEventListener('touchend',   onGridTouch, {passive:false});
  $grid.addEventListener('mouseover',  onGridHover);
  $grid.addEventListener('mouseout',   onGridOut);
}

function cellFromEvent(e) {
  let el = e.target;
  while (el && el !== $grid) {
    if (el.classList.contains('cell')) return el;
    el = el.parentElement;
  }
  return null;
}

function onGridClick(e) {
  if (!activePU) return;
  const cell = cellFromEvent(e);
  if (!cell) return;
  handlePUCell(parseInt(cell.dataset.r), parseInt(cell.dataset.c));
}
function onGridTouch(e) {
  if (!activePU) return;
  e.preventDefault();
  /* Find cell under touch */
  const t = e.changedTouches[0];
  const el = document.elementFromPoint(t.clientX, t.clientY);
  let cell = el;
  while (cell && cell !== $grid) {
    if (cell.classList.contains('cell')) break;
    cell = cell.parentElement;
  }
  if (!cell || !cell.classList.contains('cell')) return;
  handlePUCell(parseInt(cell.dataset.r), parseInt(cell.dataset.c));
}
function onGridHover(e) {
  if (!activePU) return;
  const cell = cellFromEvent(e);
  if (!cell) return;
  clearCellHL();
  const r = parseInt(cell.dataset.r), c = parseInt(cell.dataset.c);
  highlightForPU(r, c);
}
function onGridOut(e) {
  if (!activePU) return;
  const to = e.relatedTarget;
  if (!$grid.contains(to)) clearCellHL();
}

function highlightForPU(r, c) {
  if (activePU === 'bomb') {
    for (let dr=-1;dr<=1;dr++)
      for (let dc=-1;dc<=1;dc++) {
        const cl = getCell(r+dr, c+dc);
        if (cl) cl.classList.add('select-bomb');
      }
  } else if (activePU === 'hammer') {
    const cl = getCell(r, c);
    if (cl) cl.classList.add('select-hover');
  } else if (activePU === 'clearline') {
    for (let i=0;i<GRID_SIZE;i++) {
      getCell(r,i)?.classList.add('select-hover');
      getCell(i,c)?.classList.add('select-hover');
    }
  }
}

function clearCellHL() {
  $grid.querySelectorAll('.select-hover,.select-bomb').forEach(el =>
    el.classList.remove('select-hover','select-bomb')
  );
}

/* ── Execute powerup on a cell ── */
function handlePUCell(r, c) {
  pushHistory();

  if (activePU === 'bomb') {
    let cnt = 0;
    for (let dr=-1;dr<=1;dr++)
      for (let dc=-1;dc<=1;dc++) {
        const gr=r+dr, gc=c+dc;
        if (gr<0||gr>=GRID_SIZE||gc<0||gc>=GRID_SIZE) continue;
        if (grid[gr][gc] === null) continue;
        const clr = COLOR_HEX[grid[gr][gc]];
        grid[gr][gc] = null;
        const cell = getCell(gr,gc);
        if (cell) {
          const rect = cell.getBoundingClientRect();
          spawnParticles(rect.left+rect.width/2, rect.top+rect.height/2, 6, clr);
          cell.classList.add('clearing');
          const _r=gr, _c=gc;
          setTimeout(() => {
            const cl = getCell(_r,_c);
            if (cl) { cl.className='cell'; cl.dataset.r=_r; cl.dataset.c=_c; }
          }, 440);
        }
        cnt++;
      }
    addScore(cnt * PTS_CELL * 2);
    spawnFloat(`💣 +${cnt*PTS_CELL*2}`, window.innerWidth/2, window.innerHeight*0.45, 'combo');

  } else if (activePU === 'hammer') {
    if (grid[r][c] !== null) {
      const clr = COLOR_HEX[grid[r][c]];
      grid[r][c] = null;
      const cell = getCell(r,c);
      if (cell) {
        const rect = cell.getBoundingClientRect();
        spawnParticles(rect.left+rect.width/2, rect.top+rect.height/2, 12, clr);
        cell.classList.add('clearing');
        setTimeout(() => {
          const cl = getCell(r,c);
          if (cl) { cl.className='cell'; cl.dataset.r=r; cl.dataset.c=c; }
        }, 440);
      }
      addScore(PTS_CELL * 3);
      spawnFloat(`🔨 +${PTS_CELL*3}`, window.innerWidth/2, window.innerHeight*0.45);
    }

  } else if (activePU === 'clearline') {
    let cnt = 0;
    /* Clear entire row */
    for (let i=0;i<GRID_SIZE;i++) {
      if (grid[r][i] !== null) { grid[r][i]=null; cnt++; }
    }
    /* Clear entire column */
    for (let i=0;i<GRID_SIZE;i++) {
      if (grid[i][c] !== null) { grid[i][c]=null; cnt++; }
    }
    /* Re-render grid (simplest for clearline) */
    renderGrid();
    addScore(cnt * PTS_CELL * 2);
    spawnParticles(window.innerWidth/2, window.innerHeight*0.5, 24, '#10b981');
    spawnFloat(`⚡ +${cnt*PTS_CELL*2}`, window.innerWidth/2, window.innerHeight*0.42, 'combo');
  }

  updateScoreUI();
  deactivatePU();
  /* Re-check game over after powerup use */
  setTimeout(checkGameOver, 500);
}

/* ══════════════════════════════════════════════
   SETTINGS UI
══════════════════════════════════════════════ */
function openSettings() {
  document.getElementById('settings-overlay').classList.remove('hidden');
}
function closeSettings() {
  document.getElementById('settings-overlay').classList.add('hidden');
  saveSettings();
}

document.getElementById('resp-slider').addEventListener('input', function() {
  settings.responsiveness = parseInt(this.value);
  updateSliderDesc();
});
document.getElementById('offset-slider').addEventListener('input', function() {
  settings.offsetFactor = parseInt(this.value);
  updateSliderDesc();
});

/* ══════════════════════════════════════════════
   BUTTON BINDINGS
══════════════════════════════════════════════ */
document.getElementById('btn-restart')?.addEventListener('click', init);
document.getElementById('btn-restart-2')?.addEventListener('click', init);
document.getElementById('btn-settings')?.addEventListener('click', openSettings);

document.getElementById('pw-bomb')?.addEventListener('click',      () => setPU('bomb'));
document.getElementById('pw-hammer')?.addEventListener('click',    () => setPU('hammer'));
document.getElementById('pw-shuffle')?.addEventListener('click',   activateShuffle);
document.getElementById('pw-undo')?.addEventListener('click',      activateUndo);
document.getElementById('pw-clearline')?.addEventListener('click', () => setPU('clearline'));

/* Prevent context menu on long press */
document.addEventListener('contextmenu', e => e.preventDefault());

/* ══════════════════════════════════════════════
   SPLASH & BOOT
══════════════════════════════════════════════ */
window.addEventListener('load', () => {
  loadSettings();
  setTimeout(() => {
    $splash?.classList.add('fade-out');
    setTimeout(() => $splash?.remove(), 440);
    init();
  }, 1300);
});

/* ══════════════════════════════════════════════
   SERVICE WORKER
══════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(r => console.log('[SW] registered', r.scope))
      .catch(e => console.warn('[SW] failed', e));
  });
}
