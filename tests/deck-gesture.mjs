import assert from 'node:assert/strict';
import {deckSwipeStep} from '../src/deck-gesture.js';
assert.equal(deckSwipeStep(4,-80),1,'Swipe up shows next card');
assert.equal(deckSwipeStep(4,80),-1,'Swipe down shows previous card');
assert.equal(deckSwipeStep(20,15),0,'A tap or small movement does not change cards');
assert.equal(deckSwipeStep(80,4),1,'Existing horizontal swipes still work');
assert.equal(deckSwipeStep(-80,4),-1);
console.log('Vertical and horizontal card swipe checks passed.');
