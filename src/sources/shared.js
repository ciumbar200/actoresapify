import { CheerioCrawler, PlaywrightCrawler } from 'crawlee';

export const DEFAULT_NAVIGATION_TIMEOUT_SECS = 40;

export function clampLimit(value, min = 1, max = 500, fallback = 30) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function normalizeSeedUrls(startUrlsValue) {
  if (!Array.isArray(startUrlsValue)) return [];
  return startUrlsValue
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') return entry.url;
      return undefined;
    })
    .filter(Boolean);
}

export function parseEmbeddedJsonCandidates(html, markers = []) {
  const chunks = [];

  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptRegex)) {
    const body = match[1]?.trim();
    if (!body) continue;
    if (markers.length === 0 || markers.some((marker) => body.includes(marker))) {
      chunks.push(body);
    }
  }

  const jsonObjects = [];
  for (const chunk of chunks) {
    const extracted = extractLikelyJson(chunk);
    for (const candidate of extracted) {
      try {
        jsonObjects.push(JSON.parse(candidate));
      } catch {
        // Keep best effort extraction; invalid chunks are ignored.
      }
    }
  }

  return jsonObjects;
}

export function deepCollectObjects(value, matcher, maxMatches = 200) {
  const out = [];
  const stack = [value];

  while (stack.length > 0 && out.length < maxMatches) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;

    if (matcher(current)) {
      out.push(current);
    }

    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
    } else {
      for (const item of Object.values(current)) stack.push(item);
    }
  }

  return out;
}

export function extractText($, selectors) {
  for (const selector of selectors) {
    const text = $(selector).first().text()?.trim();
    if (text) return text;
  }
  return undefined;
}

export function extractHref($, selectors) {
  for (const selector of selectors) {
    const href = $(selector).first().attr('href');
    if (href) return href;
  }
  return undefined;
}

export function toAbsoluteUrl(base, maybeUrl) {
  if (!maybeUrl) return undefined;
  try {
    return new URL(maybeUrl, base).toString();
  } catch {
    return undefined;
  }
}

export function withCrawlerBySource({ useBrowser, crawlerOptions, requestHandler }) {
  const base = {
    ...crawlerOptions,
    requestHandler,
    maxRequestRetries: crawlerOptions.maxRequestRetries ?? 3,
    navigationTimeoutSecs: crawlerOptions.navigationTimeoutSecs ?? DEFAULT_NAVIGATION_TIMEOUT_SECS,
  };

  if (useBrowser) {
    return new PlaywrightCrawler(base);
  }

  return new CheerioCrawler(base);
}

function extractLikelyJson(scriptBody) {
  const trimmed = scriptBody.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return [trimmed];
  }

  const candidates = [];
  const assignmentRegexes = [
    /=\s*(\{[\s\S]*\});?$/m,
    /=\s*(\[[\s\S]*\]);?$/m,
    /JSON\.parse\(("[\s\S]*")\)/m,
  ];

  for (const regex of assignmentRegexes) {
    const match = trimmed.match(regex);
    if (!match) continue;

    if (regex.source.startsWith('JSON')) {
      try {
        candidates.push(JSON.parse(match[1]));
      } catch {
        // ignore malformed values
      }
      continue;
    }

    candidates.push(match[1]);
  }

  return candidates.flatMap((value) => (typeof value === 'string' ? [value] : []));
}
