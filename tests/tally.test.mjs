import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize} from '../lib/tally.js';
test('soma válidos e votos especiais corretamente',()=>{
  const data=summarize([{kind:'candidate',votes:'211'},{kind:'candidate',votes:106},{kind:'blank',votes:1},{kind:'null',votes:7}]);
  assert.equal(data.turnout,325);assert.equal(data.valid,317);assert.equal(data.invalid,8);
});
test('eleição sem votos',()=>{
  const data=summarize([{kind:'candidate',votes:0},{kind:'blank',votes:0}]);
  assert.equal(data.turnout,0);assert.equal(data.valid,0);
});
