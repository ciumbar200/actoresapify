import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDedupKey, normalizeItem } from '../src/normalize.js';

test('normalizeItem returns canonical shape and sanitizes values', () => {
  const result = normalizeItem({
    source: 'wallapop',
    sourceItemId: ' 123 ',
    title: ' iPhone 14 ',
    price: '499.99',
    images: ['https://img/1.jpg', null],
    raw: { foo: 'bar' },
    scrapedAt: '2026-04-10T00:00:00.000Z',
  });

  assert.equal(result.source, 'wallapop');
  assert.equal(result.sourceItemId, '123');
  assert.equal(result.title, 'iPhone 14');
  assert.equal(result.price, 499.99);
  assert.deepEqual(result.images, ['https://img/1.jpg']);
  assert.equal(result.raw.foo, 'bar');
  assert.equal(result.scrapedAt, '2026-04-10T00:00:00.000Z');
});

test('buildDedupKey uses source and sourceItemId first', () => {
  const key = buildDedupKey({
    source: 'tiktok',
    sourceItemId: 'abc',
    url: 'https://example.com/video/1',
  });

  assert.equal(key, 'tiktok:abc');
});
