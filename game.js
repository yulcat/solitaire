// ============================================================
// 🃏 Klondike Solitaire — Full Game Engine + Canvas Renderer
// ============================================================

// === Constants ===
const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS = { '♠': 'black', '♣': 'black', '♥': 'red', '♦': 'red' };
const SUIT_RENDER_COLORS = { '♠': '#1a1a3e', '♣': '#222222', '♥': '#d32f2f', '♦': '#e65100' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_VALUES = {};
RANKS.forEach((r, i) => RANK_VALUES[r] = i + 1);

// === Card ===
class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.color = SUIT_COLORS[suit];
    this.value = RANK_VALUES[rank];
    this.faceUp = false;
    // Layout positions (set by renderer)
    this.x = 0;
    this.y = 0;
    this.w = 0;
    this.h = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.animating = false;
  }

  get id() { return `${this.rank}${this.suit}`; }

  isRed() { return this.color === 'red'; }
  isBlack() { return this.color === 'black'; }

  canStackOnTableau(target) {
    // Must be opposite color, one rank lower
    if (!target) return this.rank === 'K'; // empty column = only K
    return this.color !== target.color && this.value === target.value - 1;
  }

  canStackOnFoundation(topCard) {
    if (!topCard) return this.rank === 'A'; // empty foundation = only A
    return this.suit === topCard.suit && this.value === topCard.value + 1;
  }
}

// === Game State ===
class SolitaireGame {
  constructor() {
    this.stock = [];
    this.waste = [];
    this.foundations = [[], [], [], []]; // 4 foundation piles
    this.tableau = [[], [], [], [], [], [], []]; // 7 tableau columns
    this.moves = 0;
    this.startTime = null;
    this.elapsed = 0;
    this.history = []; // for undo
    this.won = false;
    this.autoPlaying = false;
  }

  // --- Setup ---
  newGame() {
    this.stock = [];
    this.waste = [];
    this.foundations = [[], [], [], []];
    this.tableau = [[], [], [], [], [], [], []];
    this.moves = 0;
    this.startTime = Date.now();
    this.elapsed = 0;
    this.history = [];
    this.won = false;
    this.autoPlaying = false;

    // Create & shuffle deck
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push(new Card(suit, rank));
      }
    }
    this.shuffle(deck);

    // Deal to tableau
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck.pop();
        card.faceUp = (row === col);
        this.tableau[col].push(card);
      }
    }

    // Remaining cards go to stock
    this.stock = deck.reverse(); // reverse so pop gives top
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // --- Save state for undo ---
  saveState() {
    this.history.push({
      stock: this.stock.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      waste: this.waste.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      foundations: this.foundations.map(f => f.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      tableau: this.tableau.map(col => col.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      moves: this.moves
    });
    // Keep max 50 undo states
    if (this.history.length > 50) this.history.shift();
  }

  restoreCard(data) {
    const c = new Card(data.suit, data.rank);
    c.faceUp = data.faceUp;
    return c;
  }

  undo() {
    if (this.history.length === 0) return false;
    const state = this.history.pop();
    this.stock = state.stock.map(d => this.restoreCard(d));
    this.waste = state.waste.map(d => this.restoreCard(d));
    this.foundations = state.foundations.map(f => f.map(d => this.restoreCard(d)));
    this.tableau = state.tableau.map(col => col.map(d => this.restoreCard(d)));
    this.moves = state.moves;
    return true;
  }

  // --- Moves ---
  drawFromStock() {
    this.saveState();
    if (this.stock.length === 0) {
      // Recycle waste back to stock
      if (this.waste.length === 0) return false;
      this.stock = this.waste.reverse();
      this.stock.forEach(c => c.faceUp = false);
      this.waste = [];
    } else {
      const card = this.stock.pop();
      card.faceUp = true;
      this.waste.push(card);
    }
    this.moves++;
    return true;
  }

  moveWasteToFoundation(foundIdx) {
    if (this.waste.length === 0) return false;
    const card = this.waste[this.waste.length - 1];
    const found = this.foundations[foundIdx];
    const topCard = found.length > 0 ? found[found.length - 1] : null;
    if (!card.canStackOnFoundation(topCard)) return false;

    this.saveState();
    this.waste.pop();
    found.push(card);
    this.moves++;
    this.checkWin();
    return true;
  }

  moveWasteToTableau(colIdx) {
    if (this.waste.length === 0) return false;
    const card = this.waste[this.waste.length - 1];
    const col = this.tableau[colIdx];
    const topCard = col.length > 0 ? col[col.length - 1] : null;
    if (!card.canStackOnTableau(topCard)) return false;

    this.saveState();
    this.waste.pop();
    col.push(card);
    this.moves++;
    return true;
  }

  moveTableauToFoundation(colIdx, foundIdx) {
    const col = this.tableau[colIdx];
    if (col.length === 0) return false;
    const card = col[col.length - 1];
    if (!card.faceUp) return false;
    const found = this.foundations[foundIdx];
    const topCard = found.length > 0 ? found[found.length - 1] : null;
    if (!card.canStackOnFoundation(topCard)) return false;

    this.saveState();
    col.pop();
    found.push(card);
    // Flip new top card
    if (col.length > 0 && !col[col.length - 1].faceUp) {
      col[col.length - 1].faceUp = true;
    }
    this.moves++;
    this.checkWin();
    return true;
  }

  moveTableauToTableau(fromCol, toCol, cardIndex) {
    const from = this.tableau[fromCol];
    const to = this.tableau[toCol];
    if (cardIndex < 0 || cardIndex >= from.length) return false;
    const card = from[cardIndex];
    if (!card.faceUp) return false;

    const targetTop = to.length > 0 ? to[to.length - 1] : null;
    if (!card.canStackOnTableau(targetTop)) return false;

    this.saveState();
    const moving = from.splice(cardIndex);
    to.push(...moving);
    // Flip new top card
    if (from.length > 0 && !from[from.length - 1].faceUp) {
      from[from.length - 1].faceUp = true;
    }
    this.moves++;
    return true;
  }

  // --- Auto-move to foundation ---
  autoMoveToFoundation() {
    // Try to move any card to foundation automatically
    let moved = false;

    // From waste
    for (let f = 0; f < 4; f++) {
      if (this.moveWasteToFoundation(f)) { moved = true; break; }
    }
    if (moved) return true;

    // From tableau
    for (let c = 0; c < 7; c++) {
      for (let f = 0; f < 4; f++) {
        if (this.moveTableauToFoundation(c, f)) { moved = true; break; }
      }
      if (moved) break;
    }
    return moved;
  }

  // --- Check win ---
  checkWin() {
    const total = this.foundations.reduce((sum, f) => sum + f.length, 0);
    if (total === 52) {
      this.won = true;
    }
  }

  // --- Auto play (find best move) ---
  findBestMove() {
    // Priority:
    // 1. Move to foundation (if safe)
    // 2. Flip/reveal hidden cards by moving stacks
    // 3. Move from waste to tableau
    // 4. Draw from stock

    // 1) Move to foundation
    const move = this.findFoundationMove();
    if (move) return move;

    // 2) Reveal hidden cards - move stacks that expose face-down cards
    const reveal = this.findRevealMove();
    if (reveal) return reveal;

    // 3) Move from waste to tableau
    const wasteMove = this.findWasteToTableauMove();
    if (wasteMove) return wasteMove;

    // 4) Move King to empty column (only if beneficial)
    const kingMove = this.findKingMove();
    if (kingMove) return kingMove;

    // 5) Draw from stock
    if (this.stock.length > 0 || this.waste.length > 0) {
      return { type: 'draw' };
    }

    return null; // No moves available
  }

  allFaceUp() {
    // Check if all remaining cards in tableau are face up
    for (const col of this.tableau) {
      for (const card of col) {
        if (!card.faceUp) return false;
      }
    }
    return true;
  }

  findFoundationMove() {
    const allUp = this.allFaceUp() && this.stock.length === 0;

    // Check waste
    if (this.waste.length > 0) {
      const card = this.waste[this.waste.length - 1];
      for (let f = 0; f < 4; f++) {
        const found = this.foundations[f];
        const top = found.length > 0 ? found[found.length - 1] : null;
        if (card.canStackOnFoundation(top) && (allUp || this.isSafeFoundationMove(card))) {
          return { type: 'waste-to-foundation', foundIdx: f };
        }
      }
    }

    // Check tableau tops
    for (let c = 0; c < 7; c++) {
      const col = this.tableau[c];
      if (col.length === 0) continue;
      const card = col[col.length - 1];
      if (!card.faceUp) continue;
      for (let f = 0; f < 4; f++) {
        const found = this.foundations[f];
        const top = found.length > 0 ? found[found.length - 1] : null;
        if (card.canStackOnFoundation(top) && (allUp || this.isSafeFoundationMove(card))) {
          return { type: 'tableau-to-foundation', colIdx: c, foundIdx: f };
        }
      }
    }
    return null;
  }

  isSafeFoundationMove(card) {
    // A card is safe to move to foundation if both cards of opposite color
    // with value - 1 are already on foundations
    if (card.value <= 2) return true; // A and 2 are always safe

    const oppositeColor = card.isRed() ? 'black' : 'red';
    const neededValue = card.value - 1;
    let count = 0;
    for (const found of this.foundations) {
      if (found.length === 0) continue;
      const top = found[found.length - 1];
      if (SUIT_COLORS[top.suit] === oppositeColor && top.value >= neededValue) {
        count++;
      }
    }
    return count >= 2;
  }

  findRevealMove() {
    // Try to move face-up stacks to reveal hidden cards
    for (let c = 0; c < 7; c++) {
      const col = this.tableau[c];
      if (col.length === 0) continue;

      // Find first face-up card index
      let firstFaceUp = -1;
      for (let i = 0; i < col.length; i++) {
        if (col[i].faceUp) { firstFaceUp = i; break; }
      }
      if (firstFaceUp <= 0) continue; // No hidden cards to reveal

      const card = col[firstFaceUp];
      // Try to move this stack to another column
      for (let t = 0; t < 7; t++) {
        if (t === c) continue;
        const target = this.tableau[t];
        const targetTop = target.length > 0 ? target[target.length - 1] : null;
        if (card.canStackOnTableau(targetTop)) {
          return { type: 'tableau-to-tableau', fromCol: c, toCol: t, cardIndex: firstFaceUp };
        }
      }
    }
    return null;
  }

  findWasteToTableauMove() {
    if (this.waste.length === 0) return null;
    const card = this.waste[this.waste.length - 1];
    for (let c = 0; c < 7; c++) {
      const col = this.tableau[c];
      const top = col.length > 0 ? col[col.length - 1] : null;
      if (card.canStackOnTableau(top)) {
        // Don't move to empty column unless it's a King
        if (col.length === 0 && card.rank !== 'K') continue;
        return { type: 'waste-to-tableau', colIdx: c };
      }
    }
    return null;
  }

  findKingMove() {
    // Move a King to an empty column if it has hidden cards underneath
    for (let c = 0; c < 7; c++) {
      const col = this.tableau[c];
      if (col.length === 0) continue;
      let firstFaceUp = -1;
      for (let i = 0; i < col.length; i++) {
        if (col[i].faceUp) { firstFaceUp = i; break; }
      }
      if (firstFaceUp <= 0) continue;
      const card = col[firstFaceUp];
      if (card.rank !== 'K') continue;

      // Find empty column
      for (let t = 0; t < 7; t++) {
        if (t === c) continue;
        if (this.tableau[t].length === 0) {
          return { type: 'tableau-to-tableau', fromCol: c, toCol: t, cardIndex: firstFaceUp };
        }
      }
    }
    return null;
  }

  executeMove(move) {
    switch (move.type) {
      case 'draw':
        return this.drawFromStock();
      case 'waste-to-foundation':
        return this.moveWasteToFoundation(move.foundIdx);
      case 'waste-to-tableau':
        return this.moveWasteToTableau(move.colIdx);
      case 'tableau-to-foundation':
        return this.moveTableauToFoundation(move.colIdx, move.foundIdx);
      case 'tableau-to-tableau':
        return this.moveTableauToTableau(move.fromCol, move.toCol, move.cardIndex);
      default:
        return false;
    }
  }

  getElapsedTime() {
    if (!this.startTime) return '0:00';
    const elapsed = this.won ? this.elapsed : Math.floor((Date.now() - this.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}


// ============================================================
// 🎨 Canvas Renderer
// ============================================================

class SolitaireRenderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.dpr = window.devicePixelRatio || 1;

    // Layout constants (calculated on resize)
    this.cardW = 0;
    this.cardH = 0;
    this.gap = 0;
    this.margin = 0;
    this.tabFaceDownStep = 0;
    this.tabFaceUpStep = 0;
    this.topRowY = 0;
    this.tabY = 0;

    // Card back pattern
    this.backPattern = null;

    // Drag state
    this.dragging = null; // { cards: Card[], source: { type, colIdx, cardIndex }, offsetX, offsetY, x, y }

    // Animation queue
    this.animations = [];

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const toolbarH = document.getElementById('toolbar').offsetHeight;
    const w = rect.width;
    const h = rect.height - toolbarH;

    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.width = w;
    this.height = h;

    // Calculate card size: 7 columns with gaps
    this.margin = Math.max(6, w * 0.015);
    this.gap = Math.max(4, w * 0.012);
    this.cardW = Math.floor((w - this.margin * 2 - this.gap * 6) / 7);
    this.cardH = Math.floor(this.cardW * 1.45);
    this.radius = Math.max(3, this.cardW * 0.06);

    // Steps for tableau stacking
    this.tabFaceDownStep = Math.max(4, this.cardH * 0.12);
    this.tabFaceUpStep = Math.max(12, this.cardH * 0.22);

    this.topRowY = this.margin;
    this.tabY = this.topRowY + this.cardH + this.margin * 1.5;

    this.render();
  }

  getColX(col) {
    return this.margin + col * (this.cardW + this.gap);
  }

  // --- Hit Testing ---
  getAreaAt(x, y) {
    // Stock pile (col 0, top row)
    const stockX = this.getColX(0);
    if (x >= stockX && x <= stockX + this.cardW && y >= this.topRowY && y <= this.topRowY + this.cardH) {
      return { type: 'stock' };
    }

    // Waste pile (col 1, top row) - account for fanned cards
    const wasteX = this.getColX(1);
    const wasteVisCount = Math.min(this.game.waste.length, 3);
    const wasteFanOffset = this.cardW * 0.22;
    const wasteEndX = wasteX + (wasteVisCount > 0 ? (wasteVisCount - 1) * wasteFanOffset : 0) + this.cardW;
    if (x >= wasteX && x <= wasteEndX && y >= this.topRowY && y <= this.topRowY + this.cardH) {
      return { type: 'waste' };
    }

    // Foundations (cols 3-6, top row)
    for (let f = 0; f < 4; f++) {
      const fx = this.getColX(f + 3);
      if (x >= fx && x <= fx + this.cardW && y >= this.topRowY && y <= this.topRowY + this.cardH) {
        return { type: 'foundation', index: f };
      }
    }

    // Tableau columns
    for (let c = 0; c < 7; c++) {
      const cx = this.getColX(c);
      if (x < cx || x > cx + this.cardW) continue;

      const col = this.game.tableau[c];
      if (col.length === 0) {
        if (y >= this.tabY && y <= this.tabY + this.cardH) {
          return { type: 'tableau-empty', colIdx: c };
        }
        continue;
      }

      // Check from bottom (last card) up
      for (let i = col.length - 1; i >= 0; i--) {
        const card = col[i];
        let cy = this.tabY;
        for (let j = 0; j < i; j++) {
          cy += col[j].faceUp ? this.tabFaceUpStep : this.tabFaceDownStep;
        }
        const nextY = (i === col.length - 1) ? cy + this.cardH : cy + (col[i].faceUp ? this.tabFaceUpStep : this.tabFaceDownStep);
        if (y >= cy && y < (i === col.length - 1 ? cy + this.cardH : nextY)) {
          return { type: 'tableau', colIdx: c, cardIndex: i, card: col[i] };
        }
      }
    }

    return null;
  }

  // --- Card positions for tableau ---
  getCardPos(colIdx, cardIndex) {
    const x = this.getColX(colIdx);
    let y = this.tabY;
    const col = this.game.tableau[colIdx];
    for (let i = 0; i < cardIndex; i++) {
      y += col[i].faceUp ? this.tabFaceUpStep : this.tabFaceDownStep;
    }
    return { x, y };
  }

  // --- Rendering ---
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, '#1a7a35');
    grad.addColorStop(1, '#145524');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw stock
    this.drawStock(ctx);

    // Draw waste
    this.drawWaste(ctx);

    // Draw foundations
    this.drawFoundations(ctx);

    // Draw tableau
    this.drawTableau(ctx);

    // Draw drop highlights
    if (this.dragging) {
      this.drawDropHighlights(ctx);
    }

    // Draw dragged cards on top
    if (this.dragging) {
      this.drawDraggedCards(ctx);
    }
  }

  drawDropHighlights(ctx) {
    if (!this.dragging) return;
    const { cards, source } = this.dragging;
    const card = cards[0];

    ctx.save();
    ctx.strokeStyle = 'rgba(244, 197, 66, 0.6)';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);

    // Check tableau columns
    for (let c = 0; c < 7; c++) {
      if (source.type === 'tableau' && source.colIdx === c) continue;
      const col = this.game.tableau[c];
      const topCard = col.length > 0 ? col[col.length - 1] : null;
      if (card.canStackOnTableau(topCard)) {
        const x = this.getColX(c);
        let y = this.tabY;
        if (col.length > 0) {
          for (let i = 0; i < col.length; i++) {
            y += col[i].faceUp ? this.tabFaceUpStep : this.tabFaceDownStep;
          }
        }
        this.roundRect(ctx, x, y, this.cardW, this.cardH, this.radius);
        ctx.stroke();
      }
    }

    // Check foundations (single card only)
    if (cards.length === 1) {
      for (let f = 0; f < 4; f++) {
        const found = this.game.foundations[f];
        const topCard = found.length > 0 ? found[found.length - 1] : null;
        if (card.canStackOnFoundation(topCard)) {
          const x = this.getColX(f + 3);
          this.roundRect(ctx, x, this.topRowY, this.cardW, this.cardH, this.radius);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  drawStock(ctx) {
    const x = this.getColX(0);
    const y = this.topRowY;

    if (this.game.stock.length > 0) {
      this.drawCardBack(ctx, x, y);
      // Card count indicator
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = `bold ${Math.max(10, this.cardW * 0.14)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(this.game.stock.length.toString(), x + this.cardW / 2, y + this.cardH - 6);
    } else {
      // Empty stock - draw recycle icon
      this.drawEmptySlot(ctx, x, y);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = `${Math.max(16, this.cardW * 0.3)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('↻', x + this.cardW / 2, y + this.cardH / 2);
      ctx.textBaseline = 'alphabetic';
    }
  }

  drawWaste(ctx) {
    const x = this.getColX(1);
    const y = this.topRowY;

    if (this.game.waste.length > 0) {
      const isDraggingWaste = this.dragging && this.dragging.source.type === 'waste';
      // Show up to 3 cards fanned out to the right
      const wasteLen = this.game.waste.length;
      const visibleCount = Math.min(wasteLen, 3);
      const fanOffset = this.cardW * 0.22;

      // If dragging the top waste card, show one less
      const showCount = isDraggingWaste ? visibleCount - 1 : visibleCount;
      const startIdx = wasteLen - visibleCount;

      for (let i = 0; i < showCount; i++) {
        const card = this.game.waste[startIdx + i];
        const offsetX = i * fanOffset;
        this.drawCardFace(ctx, card, x + offsetX, y);
      }
    } else {
      this.drawEmptySlot(ctx, x, y);
    }
  }

  drawFoundations(ctx) {
    for (let f = 0; f < 4; f++) {
      const x = this.getColX(f + 3);
      const y = this.topRowY;
      const found = this.game.foundations[f];

      if (found.length > 0) {
        const card = found[found.length - 1];
        this.drawCardFace(ctx, card, x, y);
      } else {
        this.drawEmptySlot(ctx, x, y);
        // Suit indicator
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = `${Math.max(16, this.cardW * 0.35)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(SUITS[f], x + this.cardW / 2, y + this.cardH / 2);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  drawTableau(ctx) {
    for (let c = 0; c < 7; c++) {
      const col = this.game.tableau[c];
      const x = this.getColX(c);

      if (col.length === 0) {
        this.drawEmptySlot(ctx, x, this.tabY);
        continue;
      }

      let cy = this.tabY;
      for (let i = 0; i < col.length; i++) {
        const card = col[i];

        // Skip dragged cards
        if (this.dragging && this.dragging.source.type === 'tableau' &&
            this.dragging.source.colIdx === c && i >= this.dragging.source.cardIndex) {
          cy += card.faceUp ? this.tabFaceUpStep : this.tabFaceDownStep;
          continue;
        }

        if (card.faceUp) {
          this.drawCardFace(ctx, card, x, cy);
        } else {
          this.drawCardBack(ctx, x, cy);
        }
        cy += card.faceUp ? this.tabFaceUpStep : this.tabFaceDownStep;
      }
    }
  }

  drawDraggedCards(ctx) {
    if (!this.dragging) return;
    const { cards, x, y, offsetX, offsetY } = this.dragging;
    let cy = y - offsetY;
    for (let i = 0; i < cards.length; i++) {
      // Shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;
      this.drawCardFace(ctx, cards[i], x - offsetX, cy);
      ctx.restore();
      cy += this.tabFaceUpStep;
    }
  }

  drawEmptySlot(ctx, x, y) {
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    this.roundRect(ctx, x, y, this.cardW, this.cardH, this.radius);
    ctx.stroke();
  }

  drawCardBack(ctx, x, y) {
    // Card shape
    ctx.save();
    ctx.fillStyle = '#2255aa';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    this.roundRect(ctx, x, y, this.cardW, this.cardH, this.radius);
    ctx.fill();
    ctx.restore();

    // Border
    ctx.strokeStyle = '#1a4488';
    ctx.lineWidth = 1;
    this.roundRect(ctx, x, y, this.cardW, this.cardH, this.radius);
    ctx.stroke();

    // Inner pattern
    const inset = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, x + inset, y + inset, this.cardW - inset * 2, this.cardH - inset * 2, this.radius - 1);
    ctx.stroke();

    // Diamond pattern
    const cx = x + this.cardW / 2;
    const cy = y + this.cardH / 2;
    const dSize = Math.min(this.cardW, this.cardH) * 0.2;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - dSize);
    ctx.lineTo(cx + dSize * 0.7, cy);
    ctx.lineTo(cx, cy + dSize);
    ctx.lineTo(cx - dSize * 0.7, cy);
    ctx.closePath();
    ctx.fill();
  }

  drawCardFace(ctx, card, x, y) {
    // Card shape
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    this.roundRect(ctx, x, y, this.cardW, this.cardH, this.radius);
    ctx.fill();
    ctx.restore();

    // Border
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 0.5;
    this.roundRect(ctx, x, y, this.cardW, this.cardH, this.radius);
    ctx.stroke();

    // Per-suit color for better distinction
    ctx.fillStyle = SUIT_RENDER_COLORS[card.suit];

    const fontSize = Math.max(12, this.cardW * 0.22);
    const suitFontSize = Math.max(12, this.cardW * 0.22);

    // Top-left rank + suit
    ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(card.rank, x + 4, y + fontSize + 2);
    ctx.font = `${suitFontSize}px sans-serif`;
    ctx.fillText(card.suit, x + 4, y + fontSize + suitFontSize + 2);

    // Bottom-right (rotated)
    ctx.save();
    ctx.translate(x + this.cardW - 4, y + this.cardH - 4);
    ctx.rotate(Math.PI);
    ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(card.rank, 0, fontSize);
    ctx.font = `${suitFontSize}px sans-serif`;
    ctx.fillText(card.suit, 0, fontSize + suitFontSize);
    ctx.restore();

    // Center suit (larger for visibility)
    const centerSize = Math.max(24, this.cardW * 0.5);
    ctx.font = `${centerSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.suit, x + this.cardW / 2, y + this.cardH / 2);
    ctx.textBaseline = 'alphabetic';
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}


// ============================================================
// 🎮 Input Handler (Touch + Mouse)
// ============================================================

class InputHandler {
  constructor(renderer, game, ui) {
    this.renderer = renderer;
    this.game = game;
    this.ui = ui;
    this.canvas = renderer.canvas;

    this.pointerDown = false;
    this.startX = 0;
    this.startY = 0;
    this.hasMoved = false;
    this.tapTimeout = null;
    this.lastTapTime = 0;
    this.lastTapArea = null;

    // Bind events
    this.canvas.addEventListener('pointerdown', e => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', e => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', e => this.onPointerUp(e));
    this.canvas.addEventListener('pointercancel', e => this.onPointerUp(e));
  }

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  onPointerDown(e) {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const { x, y } = this.getCanvasPos(e);
    this.pointerDown = true;
    this.startX = x;
    this.startY = y;
    this.hasMoved = false;

    const area = this.renderer.getAreaAt(x, y);
    if (!area) return;

    // Start drag for face-up tableau cards and waste
    if (area.type === 'tableau' && area.card && area.card.faceUp) {
      const pos = this.renderer.getCardPos(area.colIdx, area.cardIndex);
      const col = this.game.tableau[area.colIdx];
      const cards = col.slice(area.cardIndex);
      this.renderer.dragging = {
        cards,
        source: { type: 'tableau', colIdx: area.colIdx, cardIndex: area.cardIndex },
        offsetX: x - pos.x,
        offsetY: y - pos.y,
        x, y
      };
    } else if (area.type === 'waste' && this.game.waste.length > 0) {
      const wasteX = this.renderer.getColX(1);
      const wasteY = this.renderer.topRowY;
      const visibleCount = Math.min(this.game.waste.length, 3);
      const fanOffset = this.renderer.cardW * 0.22;
      const topCardX = wasteX + (visibleCount - 1) * fanOffset;
      const card = this.game.waste[this.game.waste.length - 1];
      this.renderer.dragging = {
        cards: [card],
        source: { type: 'waste' },
        offsetX: x - topCardX,
        offsetY: y - wasteY,
        x, y
      };
    }
  }

  onPointerMove(e) {
    if (!this.pointerDown) return;
    const { x, y } = this.getCanvasPos(e);
    const dx = x - this.startX;
    const dy = y - this.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      this.hasMoved = true;
    }
    if (this.renderer.dragging) {
      this.renderer.dragging.x = x;
      this.renderer.dragging.y = y;
      this.renderer.render();
    }
  }

  onPointerUp(e) {
    const { x, y } = this.getCanvasPos(e);
    const wasMoving = this.hasMoved && this.renderer.dragging;

    if (wasMoving) {
      this.handleDrop(x, y);
    } else if (!this.hasMoved) {
      this.handleTap(x, y);
    }

    this.renderer.dragging = null;
    this.pointerDown = false;
    this.renderer.render();
    this.ui.updateButtons();

    // Auto-finish: if all cards face up and stock empty, auto-complete
    if (!this.game.won && !this.game.autoPlaying && this.game.allFaceUp() && this.game.stock.length === 0 && this.game.waste.length === 0) {
      this.ui.startAutoFinish();
    }
  }

  handleTap(x, y) {
    const area = this.renderer.getAreaAt(x, y);
    if (!area) return;

    const now = Date.now();
    const isDoubleTap = (now - this.lastTapTime < 400) &&
                        this.lastTapArea &&
                        this.lastTapArea.type === area.type &&
                        this.lastTapArea.colIdx === area.colIdx;
    this.lastTapTime = now;
    this.lastTapArea = area;

    // Stock: draw card
    if (area.type === 'stock') {
      this.game.drawFromStock();
      this.renderer.render();
      this.ui.updateButtons();
      return;
    }

    // Waste: try auto-move to foundation or tap
    if (area.type === 'waste') {
      if (this.tryAutoPlace('waste')) return;
    }

    // Tableau card: double tap = try to move to foundation
    // Single tap on top card of column = also try foundation
    if (area.type === 'tableau' && area.card && area.card.faceUp) {
      if (isDoubleTap) {
        // Double tap: force try foundation
        if (this.tryAutoPlace('tableau', area.colIdx)) return;
      } else if (area.cardIndex === this.game.tableau[area.colIdx].length - 1) {
        // Single tap on top card: try foundation
        if (this.tryAutoPlace('tableau', area.colIdx)) return;
      }
    }
  }

  tryAutoPlace(sourceType, colIdx) {
    if (sourceType === 'waste') {
      for (let f = 0; f < 4; f++) {
        if (this.game.moveWasteToFoundation(f)) {
          this.renderer.render();
          this.ui.updateButtons();
          this.ui.checkWin();
          return true;
        }
      }
    } else if (sourceType === 'tableau') {
      for (let f = 0; f < 4; f++) {
        if (this.game.moveTableauToFoundation(colIdx, f)) {
          this.renderer.render();
          this.ui.updateButtons();
          this.ui.checkWin();
          return true;
        }
      }
    }
    return false;
  }

  handleDrop(x, y) {
    const drag = this.renderer.dragging;
    if (!drag) return;

    // Calculate the center of the dragged card
    const dragCenterX = x - drag.offsetX + this.renderer.cardW / 2;
    const dragCenterY = y - drag.offsetY + this.renderer.cardH / 2;
    const card = drag.cards[0];

    // Build list of candidate destinations with distances
    const candidates = [];

    // Check foundations (single card only)
    if (drag.cards.length === 1) {
      for (let f = 0; f < 4; f++) {
        const found = this.game.foundations[f];
        const topCard = found.length > 0 ? found[found.length - 1] : null;
        if (card.canStackOnFoundation(topCard)) {
          const fx = this.renderer.getColX(f + 3) + this.renderer.cardW / 2;
          const fy = this.renderer.topRowY + this.renderer.cardH / 2;
          const dist = Math.hypot(dragCenterX - fx, dragCenterY - fy);
          candidates.push({ dist, type: 'foundation', index: f });
        }
      }
    }

    // Check tableau columns
    for (let c = 0; c < 7; c++) {
      if (drag.source.type === 'tableau' && drag.source.colIdx === c) continue;
      const col = this.game.tableau[c];
      const topCard = col.length > 0 ? col[col.length - 1] : null;
      if (card.canStackOnTableau(topCard)) {
        const tx = this.renderer.getColX(c) + this.renderer.cardW / 2;
        let ty = this.renderer.tabY;
        if (col.length > 0) {
          for (let i = 0; i < col.length; i++) {
            ty += col[i].faceUp ? this.renderer.tabFaceUpStep : this.renderer.tabFaceDownStep;
          }
        }
        ty += this.renderer.cardH / 2;
        const dist = Math.hypot(dragCenterX - tx, dragCenterY - ty);
        candidates.push({ dist, type: 'tableau', colIdx: c });
      }
    }

    // Sort by distance and pick the closest within a generous range (1.5x card diagonal)
    const maxDist = Math.hypot(this.renderer.cardW, this.renderer.cardH) * 1.5;
    candidates.sort((a, b) => a.dist - b.dist);

    let moved = false;
    for (const cand of candidates) {
      if (cand.dist > maxDist) break;
      if (cand.type === 'foundation') {
        if (drag.source.type === 'waste') {
          moved = this.game.moveWasteToFoundation(cand.index);
        } else if (drag.source.type === 'tableau') {
          moved = this.game.moveTableauToFoundation(drag.source.colIdx, cand.index);
        }
      } else if (cand.type === 'tableau') {
        if (drag.source.type === 'waste') {
          moved = this.game.moveWasteToTableau(cand.colIdx);
        } else if (drag.source.type === 'tableau') {
          moved = this.game.moveTableauToTableau(drag.source.colIdx, cand.colIdx, drag.source.cardIndex);
        }
      }
      if (moved) break;
    }

    // If drop failed, cards snap back (just re-render)
    if (moved) {
      this.ui.checkWin();
    }
  }
}


// ============================================================
// 🖥️ UI Controller
// ============================================================

class UIController {
  constructor(game, renderer, winAnim) {
    this.game = game;
    this.renderer = renderer;
    this.winAnim = winAnim;
    this.timerInterval = null;
    this.autoPlayInterval = null;
    this.drawAttempts = 0;
    this.maxDrawAttempts = 0;
    this.stats = new StatsManager();

    // Buttons
    this.btnNew = document.getElementById('btn-new');
    this.btnUndo = document.getElementById('btn-undo');
    this.btnAuto = document.getElementById('btn-auto');
    this.btnStats = document.getElementById('btn-stats');
    this.movesEl = document.getElementById('moves');
    this.timeEl = document.getElementById('time');
    this.btnNewGame = document.getElementById('btn-new-game');

    this.btnNew.addEventListener('click', () => this.newGame());
    this.btnUndo.addEventListener('click', () => this.undo());
    this.btnAuto.addEventListener('click', () => this.toggleAutoPlay());
    this.btnStats.addEventListener('click', () => this.showStats());
    this.btnNewGame.addEventListener('click', () => {
      document.getElementById('win-overlay').classList.add('hidden');
      this.newGame();
    });
    document.getElementById('btn-close-stats').addEventListener('click', () => {
      document.getElementById('stats-overlay').classList.add('hidden');
    });

    this.startTimer();
  }

  newGame() {
    // Record previous game as loss if it wasn't won
    if (this.game.startTime && !this.game.won && this.game.moves > 0) {
      this.stats.recordLoss();
    }
    this.stopAutoPlay();
    if (this.winAnim) this.winAnim.stop();
    this.game.newGame();
    this.stats.recordGame();
    this.renderer.render();
    this.updateButtons();
    this.startTimer();
    document.getElementById('win-overlay').classList.add('hidden');
  }

  undo() {
    if (this.game.undo()) {
      this.renderer.render();
      this.updateButtons();
    }
  }

  toggleAutoPlay() {
    if (this.game.autoPlaying) {
      this.stopAutoPlay();
    } else {
      this.startAutoPlay();
    }
  }

  startAutoPlay() {
    this.game.autoPlaying = true;
    this.btnAuto.classList.add('running');
    this.btnAuto.textContent = '⏸️ 정지';
    this.drawAttempts = 0;
    // Total stock cycle = stock.length + waste.length
    this.maxDrawAttempts = this.game.stock.length + this.game.waste.length + 2;

    this.autoPlayInterval = setInterval(() => {
      if (this.game.won) {
        this.stopAutoPlay();
        return;
      }

      const move = this.game.findBestMove();
      if (!move) {
        this.stopAutoPlay();
        return;
      }

      if (move.type === 'draw') {
        this.drawAttempts++;
        if (this.drawAttempts > this.maxDrawAttempts) {
          // We've cycled through the entire stock with no useful moves
          this.stopAutoPlay();
          return;
        }
      } else {
        // Reset draw counter on any non-draw move
        this.drawAttempts = 0;
        this.maxDrawAttempts = this.game.stock.length + this.game.waste.length + 2;
      }

      this.game.executeMove(move);
      this.renderer.render();
      this.updateButtons();
      this.checkWin();
    }, 300);
  }

  stopAutoPlay() {
    this.game.autoPlaying = false;
    this.btnAuto.classList.remove('running');
    this.btnAuto.textContent = '🤖 오토플레이';
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
      this.autoPlayInterval = null;
    }
  }

  startAutoFinish() {
    // Rapidly move all remaining cards to foundations
    this.game.autoPlaying = true;
    this.btnAuto.classList.add('running');
    this.btnAuto.textContent = '⏸️ 정리 중...';

    const finishInterval = setInterval(() => {
      if (this.game.won) {
        clearInterval(finishInterval);
        this.stopAutoPlay();
        this.checkWin();
        return;
      }

      // Find any card that can go to foundation
      let moved = false;
      for (let c = 0; c < 7; c++) {
        const col = this.game.tableau[c];
        if (col.length === 0) continue;
        const card = col[col.length - 1];
        if (!card.faceUp) continue;
        for (let f = 0; f < 4; f++) {
          if (this.game.moveTableauToFoundation(c, f)) {
            moved = true;
            break;
          }
        }
        if (moved) break;
      }

      if (!moved) {
        // Try waste
        for (let f = 0; f < 4; f++) {
          if (this.game.moveWasteToFoundation(f)) {
            moved = true;
            break;
          }
        }
      }

      this.renderer.render();
      this.updateButtons();

      if (!moved) {
        clearInterval(finishInterval);
        this.stopAutoPlay();
      }
    }, 80); // Fast finish animation
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.game.won) {
        this.timeEl.textContent = this.game.getElapsedTime();
      }
    }, 1000);
  }

  updateButtons() {
    this.btnUndo.disabled = this.game.history.length === 0;
    this.movesEl.textContent = this.game.moves;
    this.timeEl.textContent = this.game.getElapsedTime();
  }

  checkWin() {
    if (this.game.won) {
      this.game.elapsed = Math.floor((Date.now() - this.game.startTime) / 1000);
      this.stopAutoPlay();
      this.stats.recordWin(this.game.elapsed, this.game.moves);

      // Start cascading card animation
      if (this.winAnim) {
        this.winAnim.start();
      }

      // Show win dialog after a short delay (let animation play)
      setTimeout(() => {
        document.getElementById('win-moves').textContent = this.game.moves;
        document.getElementById('win-time').textContent = this.game.getElapsedTime();
        document.getElementById('win-overlay').classList.remove('hidden');
      }, 2000);
    }
  }

  showStats() {
    document.getElementById('stats-content').innerHTML = this.stats.getHTML();
    document.getElementById('stats-overlay').classList.remove('hidden');
  }
}


// ============================================================
// 🎆 Win Animation (Cascading Cards)
// ============================================================

class WinAnimation {
  constructor(renderer) {
    this.renderer = renderer;
    this.particles = [];
    this.running = false;
    this.animFrame = null;
    this.cardCache = new Map(); // pre-rendered card images
  }

  // Pre-render all cards to offscreen canvases for fast blitting
  _cacheCards() {
    this.cardCache.clear();
    const r = this.renderer;
    const dpr = r.dpr;
    const w = r.cardW;
    const h = r.cardH;

    for (const p of this.particles) {
      const key = p.card.id;
      if (this.cardCache.has(key)) continue;
      const off = document.createElement('canvas');
      off.width = w * dpr;
      off.height = h * dpr;
      const octx = off.getContext('2d');
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      r.drawCardFace(octx, p.card, 0, 0);
      this.cardCache.set(key, off);
    }
  }

  start() {
    this.particles = [];
    this.running = true;

    // Create falling cards from foundations
    const foundations = this.renderer.game.foundations;
    let delay = 0;
    for (let f = 0; f < 4; f++) {
      const cards = [...foundations[f]].reverse();
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const x = this.renderer.getColX(f + 3);
        const y = this.renderer.topRowY;
        this.particles.push({
          card,
          x, y,
          vx: (Math.random() - 0.5) * 7,
          vy: -Math.random() * 5 - 2,
          gravity: 0.22,
          bounce: 0.65,
          delay: delay,
          settled: false,
        });
        delay += 55;
      }
    }

    // Pre-render all card images once
    this._cacheCards();

    // Draw green background once
    const ctx = this.renderer.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.renderer.height);
    grad.addColorStop(0, '#1a7a35');
    grad.addColorStop(1, '#145524');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);

    this.lastTime = performance.now();
    this.animate();
  }

  stop() {
    this.running = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    this.particles = [];
    this.cardCache.clear();
  }

  animate() {
    if (!this.running) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 16, 3);
    this.lastTime = now;

    const ctx = this.renderer.ctx;
    const height = this.renderer.height;
    const width = this.renderer.width;
    const cardH = this.renderer.cardH;
    const cardW = this.renderer.cardW;

    // Don't clear the canvas — cards leave trails naturally!
    // Classic Windows Solitaire effect

    let active = 0;
    for (const p of this.particles) {
      if (p.delay > 0) {
        p.delay -= dt * 16;
        active++;
        continue;
      }
      if (p.settled) continue;

      // Physics
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Bounce off bottom
      if (p.y + cardH > height) {
        p.y = height - cardH;
        p.vy = -Math.abs(p.vy) * p.bounce;
        p.bounce *= 0.88;
        if (Math.abs(p.vy) < 0.8) {
          p.settled = true;
          continue;
        }
      }

      // Bounce off sides
      if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx) * 0.9; }
      if (p.x + cardW > width) { p.x = width - cardW; p.vx = -Math.abs(p.vx) * 0.9; }

      active++;

      // Draw using cached card image (very fast!)
      const cached = this.cardCache.get(p.card.id);
      if (cached) {
        ctx.drawImage(cached, 0, 0, cached.width, cached.height,
                      p.x, p.y, cardW, cardH);
      }
    }

    if (active > 0) {
      this.animFrame = requestAnimationFrame(() => this.animate());
    } else {
      this.running = false;
    }
  }
}


// ============================================================
// 📊 Stats Manager
// ============================================================

class StatsManager {
  constructor() {
    this.stats = this.load();
  }

  load() {
    try {
      const data = localStorage.getItem('solitaire-stats');
      if (data) return JSON.parse(data);
    } catch (e) {}
    return {
      gamesPlayed: 0,
      gamesWon: 0,
      bestTime: null,
      bestMoves: null,
      currentStreak: 0,
      bestStreak: 0,
    };
  }

  save() {
    localStorage.setItem('solitaire-stats', JSON.stringify(this.stats));
  }

  recordWin(time, moves) {
    this.stats.gamesWon++;
    this.stats.currentStreak++;
    if (this.stats.currentStreak > this.stats.bestStreak) {
      this.stats.bestStreak = this.stats.currentStreak;
    }
    if (this.stats.bestTime === null || time < this.stats.bestTime) {
      this.stats.bestTime = time;
    }
    if (this.stats.bestMoves === null || moves < this.stats.bestMoves) {
      this.stats.bestMoves = moves;
    }
    this.save();
  }

  recordGame() {
    this.stats.gamesPlayed++;
    this.save();
  }

  recordLoss() {
    this.stats.currentStreak = 0;
    this.save();
  }

  getWinRate() {
    if (this.stats.gamesPlayed === 0) return 0;
    return Math.round((this.stats.gamesWon / this.stats.gamesPlayed) * 100);
  }

  formatTime(seconds) {
    if (seconds === null) return '-';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  getHTML() {
    const s = this.stats;
    return `
      <div class="stat-row"><span class="stat-label">게임 수</span><span class="stat-value">${s.gamesPlayed}</span></div>
      <div class="stat-row"><span class="stat-label">승리</span><span class="stat-value">${s.gamesWon}</span></div>
      <div class="stat-row"><span class="stat-label">승률</span><span class="stat-value">${this.getWinRate()}%</span></div>
      <div class="stat-row"><span class="stat-label">연승</span><span class="stat-value">${s.currentStreak}</span></div>
      <div class="stat-row"><span class="stat-label">최고 연승</span><span class="stat-value">${s.bestStreak}</span></div>
      <div class="stat-row"><span class="stat-label">최단 시간</span><span class="stat-value">${this.formatTime(s.bestTime)}</span></div>
      <div class="stat-row"><span class="stat-label">최소 이동</span><span class="stat-value">${s.bestMoves ?? '-'}</span></div>
    `;
  }
}


// ============================================================
// 🚀 Initialization
// ============================================================

const game = new SolitaireGame();
const canvas = document.getElementById('game-canvas');
const renderer = new SolitaireRenderer(canvas, game);
const winAnim = new WinAnimation(renderer);
const ui = new UIController(game, renderer, winAnim);
const input = new InputHandler(renderer, game, ui);

// Start game
game.newGame();
renderer.render();
ui.updateButtons();

// Game loop for smooth rendering
function gameLoop() {
  // Check win on every frame
  if (game.won && !document.getElementById('win-overlay').classList.contains('hidden') === false) {
    ui.checkWin();
  }
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
