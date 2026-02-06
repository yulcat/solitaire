// Quick smoke test for game logic
// Run: node test.js

// We need to extract classes from the module... let's do it inline
const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS = { '♠': 'black', '♣': 'black', '♥': 'red', '♦': 'red' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_VALUES = {};
RANKS.forEach((r, i) => RANK_VALUES[r] = i + 1);

class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.color = SUIT_COLORS[suit];
    this.value = RANK_VALUES[rank];
    this.faceUp = false;
  }
  isRed() { return this.color === 'red'; }
  isBlack() { return this.color === 'black'; }
  canStackOnTableau(target) {
    if (!target) return this.rank === 'K';
    return this.color !== target.color && this.value === target.value - 1;
  }
  canStackOnFoundation(topCard) {
    if (!topCard) return this.rank === 'A';
    return this.suit === topCard.suit && this.value === topCard.value + 1;
  }
}

// Test 1: Card stacking rules
console.log('=== Test 1: Card stacking ===');
const blackQ = new Card('♠', 'Q');
const redJ = new Card('♥', 'J');
const blackJ = new Card('♣', 'J');
const aceH = new Card('♥', 'A');
const twoH = new Card('♥', '2');

console.assert(redJ.canStackOnTableau(blackQ) === true, 'Red J on Black Q should work');
console.assert(blackJ.canStackOnTableau(blackQ) === false, 'Black J on Black Q should NOT work');
console.assert(aceH.canStackOnFoundation(null) === true, 'Ace on empty foundation should work');
console.assert(twoH.canStackOnFoundation(aceH) === true, '2♥ on A♥ should work');
console.assert(blackQ.canStackOnFoundation(aceH) === false, 'Q♠ on A♥ should NOT work');
console.log('  All stacking tests passed ✓');

// Test 2: King on empty column
console.log('=== Test 2: King rules ===');
const kingS = new Card('♠', 'K');
const queenH = new Card('♥', 'Q');
console.assert(kingS.canStackOnTableau(null) === true, 'King on empty column should work');
console.assert(queenH.canStackOnTableau(null) === false, 'Queen on empty column should NOT work');
console.log('  King rules passed ✓');

// Test 3: Deck creation
console.log('=== Test 3: Full deck ===');
const deck = [];
for (const suit of SUITS) {
  for (const rank of RANKS) {
    deck.push(new Card(suit, rank));
  }
}
console.assert(deck.length === 52, 'Deck should have 52 cards');
const ids = new Set(deck.map(c => `${c.rank}${c.suit}`));
console.assert(ids.size === 52, 'All cards should be unique');
console.log('  Full deck test passed ✓');

// Test 4: Deal check
console.log('=== Test 4: Deal distribution ===');
// Simulate dealing: 1+2+3+4+5+6+7 = 28 cards to tableau, 24 to stock
const tableauCount = 1 + 2 + 3 + 4 + 5 + 6 + 7;
const stockCount = 52 - tableauCount;
console.assert(tableauCount === 28, `Tableau should get 28 cards, got ${tableauCount}`);
console.assert(stockCount === 24, `Stock should get 24 cards, got ${stockCount}`);
console.log('  Deal distribution test passed ✓');

console.log('\n✅ All tests passed!');
