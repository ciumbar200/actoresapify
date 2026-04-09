import test from 'node:test';
import assert from 'node:assert/strict';
import { createOutputManager } from '../src/output.js';

test('output manager enforces per-source limit and dedupe', async () => {
  const pushed = [];
  const manager = createOutputManager({
    maxItemsPerSource: 2,
    pushData: async (item) => pushed.push(item),
  });

  assert.equal(await manager.emit({ source: 'facebook', sourceItemId: '1', title: 'A' }), true);
  assert.equal(await manager.emit({ source: 'facebook', sourceItemId: '1', title: 'A duplicate' }), false);
  assert.equal(await manager.emit({ source: 'facebook', sourceItemId: '2', title: 'B' }), true);
  assert.equal(await manager.emit({ source: 'facebook', sourceItemId: '3', title: 'C should overflow' }), false);

  assert.equal(await manager.emit({ source: 'instagram', sourceItemId: '1', title: 'X' }), true);

  assert.equal(pushed.length, 3);
  assert.deepEqual(manager.getCounts(), { facebook: 2, instagram: 1 });
  assert.equal(manager.getTotal(), 3);
});
