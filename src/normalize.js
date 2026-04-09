const SOURCE_FIELDS = [
  'source',
  'sourceItemId',
  'url',
  'title',
  'description',
  'price',
  'currency',
  'sellerName',
  'sellerId',
  'locationText',
  'publishedAt',
  'scrapedAt',
  'images',
  'metrics',
  'raw',
  'query',
];

export function normalizeItem(item) {
  const cleaned = {
    source: item.source,
    sourceItemId: normalizeText(item.sourceItemId),
    url: normalizeText(item.url),
    title: normalizeText(item.title),
    description: normalizeText(item.description),
    price: normalizePrice(item.price),
    currency: normalizeText(item.currency),
    sellerName: normalizeText(item.sellerName),
    sellerId: normalizeText(item.sellerId),
    locationText: normalizeText(item.locationText),
    publishedAt: normalizeDate(item.publishedAt),
    scrapedAt: normalizeDate(item.scrapedAt) ?? new Date().toISOString(),
    images: Array.isArray(item.images) ? item.images.filter(Boolean).map(String) : [],
    metrics: item.metrics && typeof item.metrics === 'object' ? item.metrics : undefined,
    raw: item.raw && typeof item.raw === 'object' ? item.raw : undefined,
    query: normalizeText(item.query),
  };

  for (const key of SOURCE_FIELDS) {
    if (!(key in cleaned)) {
      cleaned[key] = undefined;
    }
  }

  return cleaned;
}

export function buildDedupKey(item) {
  return `${item.source}:${item.sourceItemId ?? item.url ?? ''}`;
}

function normalizeText(value) {
  if (value === null || value === undefined) return undefined;
  const str = String(value).trim();
  return str.length > 0 ? str : undefined;
}

function normalizePrice(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDate(value) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? undefined : d.toISOString();
}
