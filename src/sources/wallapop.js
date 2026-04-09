import { deepCollectObjects, normalizeSeedUrls, parseEmbeddedJsonCandidates, toAbsoluteUrl, withCrawlerBySource } from './shared.js';

const BASE_URL = 'https://es.wallapop.com';

export async function runWallapop({ queries, startUrls, location, maxItems, crawlerOptions, emit, log }) {
  const seedUrls = normalizeSeedUrls(startUrls?.wallapop);
  const initialUrls = seedUrls.length > 0 ? seedUrls : buildQueryUrls(queries, location);
  let emitted = 0;

  const crawler = withCrawlerBySource({
    useBrowser: false,
    crawlerOptions,
    requestHandler: async ({ $, request, body, enqueueLinks }) => {
      if (emitted >= maxItems) return;

      const jsonCandidates = parseEmbeddedJsonCandidates(body, ['__NEXT_DATA__', 'search']);
      const extracted = extractWallapopListings(jsonCandidates);

      for (const listing of extracted) {
        if (emitted >= maxItems) break;
        emitted += 1;
        await emit({
          source: 'wallapop',
          sourceItemId: listing.id,
          url: toAbsoluteUrl(BASE_URL, listing.web_slug ?? listing.url),
          title: listing.title,
          description: listing.description,
          price: listing.price,
          currency: listing.currency,
          sellerName: listing.user?.micro_name,
          sellerId: listing.user_id,
          locationText: listing.location,
          publishedAt: listing.modified_date,
          images: listing.images,
          metrics: {
            favorites: listing.favorited,
          },
          raw: {
            type: listing.type,
            shipping_allowed: listing.shipping_allowed,
          },
          query: request.userData?.query,
        });
      }

      if (emitted >= maxItems) return;

      const nextHref = $('a[aria-label="Siguiente"], a[rel="next"]').first().attr('href');
      if (nextHref) {
        await enqueueLinks({
          urls: [toAbsoluteUrl(BASE_URL, nextHref)],
          userData: request.userData,
        });
      }
    },
  });

  try {
    await crawler.run(initialUrls.map((url) => ({ url, userData: { query: queryFromUrl(url, queries) } })));
  } catch (error) {
    log.warning(`Wallapop crawl failed: ${error.message}`);
  }

  return emitted;
}

function buildQueryUrls(queries, location) {
  const locationHint = [location?.city, location?.region, location?.country].filter(Boolean).join(' ');
  return queries.map((query) => {
    const q = [query, locationHint].filter(Boolean).join(' ');
    return `${BASE_URL}/app/search?keywords=${encodeURIComponent(q)}`;
  });
}

function extractWallapopListings(jsonObjects) {
  const hits = [];

  for (const jsonObj of jsonObjects) {
    const records = deepCollectObjects(
      jsonObj,
      (obj) => obj && typeof obj === 'object' && obj.id && obj.title && (obj.price || obj.sale_price),
      300,
    );

    for (const rec of records) {
      hits.push({
        id: rec.id,
        title: rec.title,
        description: rec.description,
        price: rec.price ?? rec.sale_price,
        currency: rec.currency ?? 'EUR',
        web_slug: rec.web_slug,
        url: rec.url,
        user: rec.user,
        user_id: rec.user_id,
        location: rec.location?.city ?? rec.location?.region,
        modified_date: rec.modified_date,
        images: (rec.images ?? []).map((img) => img?.original ?? img?.big ?? img?.small).filter(Boolean),
        favorited: rec.favorited,
        type: rec.type,
        shipping_allowed: rec.shipping_allowed,
      });
    }
  }

  return dedupById(hits);
}

function dedupById(items) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    if (!item.id) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }

  return out;
}

function queryFromUrl(url, queries) {
  const parsed = new URL(url);
  const keywords = parsed.searchParams.get('keywords')?.trim();
  if (keywords) return keywords;
  return queries[0];
}
