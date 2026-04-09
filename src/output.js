import { buildDedupKey, normalizeItem } from './normalize.js';

export function createOutputManager({ maxItemsPerSource, pushData }) {
  const seen = new Set();
  const countBySource = new Map();

  async function emit(item) {
    const normalized = normalizeItem(item);
    const source = normalized.source;
    if (!source) return false;

    const currentCount = countBySource.get(source) ?? 0;
    if (currentCount >= maxItemsPerSource) return false;

    const dedupKey = buildDedupKey(normalized);
    if (seen.has(dedupKey)) return false;

    seen.add(dedupKey);
    countBySource.set(source, currentCount + 1);
    await pushData(normalized);
    return true;
  }

  return {
    emit,
    getCounts() {
      return Object.fromEntries(countBySource.entries());
    },
    getTotal() {
      let total = 0;
      for (const value of countBySource.values()) total += value;
      return total;
    },
  };
}
