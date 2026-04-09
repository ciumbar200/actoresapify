import { deepCollectObjects, normalizeSeedUrls, parseEmbeddedJsonCandidates, toAbsoluteUrl, withCrawlerBySource } from './shared.js';

const BASE_URL = 'https://www.facebook.com';

export async function runFacebook({ queries, startUrls, maxItems, crawlerOptions, emit, log }) {
  const seedUrls = normalizeSeedUrls(startUrls?.facebook);
  const initialUrls = seedUrls.length > 0 ? seedUrls : queries.map((q) => `${BASE_URL}/marketplace/search/?query=${encodeURIComponent(q)}`);
  let emitted = 0;

  const crawler = withCrawlerBySource({
    useBrowser: true,
    crawlerOptions,
    requestHandler: async ({ request, page, body }) => {
      if (emitted >= maxItems) return;

      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      } catch {
        // Continue with whatever rendered.
      }

      const html = await page.content();
      const jsonCandidates = parseEmbeddedJsonCandidates(html, ['marketplace', 'listing', 'RelayPrefetchedStreamCache']);
      const listings = extractFacebookMarketplace(jsonCandidates);

      for (const listing of listings) {
        if (emitted >= maxItems) break;
        emitted += 1;

        await emit({
          source: 'facebook',
          sourceItemId: listing.id,
          url: toAbsoluteUrl(BASE_URL, listing.url),
          title: listing.title,
          description: listing.description,
          price: listing.price,
          currency: listing.currency,
          sellerName: listing.sellerName,
          sellerId: listing.sellerId,
          locationText: listing.location,
          publishedAt: listing.publishedAt,
          images: listing.images,
          metrics: {
            interactions: listing.interactions,
          },
          raw: {
            source: listing.source,
          },
          query: request.userData?.query,
        });
      }

      if (emitted === 0) {
        log.warning('Facebook delivered no parseable marketplace records. This can happen due to anti-bot or regional gating.');
      }
    },
  });

  try {
    await crawler.run(initialUrls.map((url) => ({ url, userData: { query: queryFromUrl(url, queries) } })));
  } catch (error) {
    log.warning(`Facebook crawl failed: ${error.message}`);
  }

  return emitted;
}

function extractFacebookMarketplace(jsonObjects) {
  const out = [];

  for (const jsonObj of jsonObjects) {
    const candidates = deepCollectObjects(
      jsonObj,
      (obj) => obj && typeof obj === 'object' && (obj.marketplace_listing_id || obj.id) && (obj.title || obj.marketplace_listing_title),
      250,
    );

    for (const item of candidates) {
      const listingId = item.marketplace_listing_id ?? item.id;
      out.push({
        id: listingId,
        url: item.url ?? item.story?.url,
        title: item.title ?? item.marketplace_listing_title,
        description: item.description,
        price: parsePrice(item.list_price?.amount ?? item.price_amount ?? item.formatted_price),
        currency: item.list_price?.currency ?? item.currency ?? 'EUR',
        sellerName: item.marketplace_seller?.name ?? item.seller?.name,
        sellerId: item.marketplace_seller?.id ?? item.seller?.id,
        location: item.location_text?.text ?? item.location?.city,
        publishedAt: item.creation_time ? new Date(item.creation_time * 1000).toISOString() : undefined,
        images: [
          item.primary_listing_photo?.image?.uri,
          ...(item.listing_photos?.map((p) => p?.image?.uri) ?? []),
        ].filter(Boolean),
        interactions: item.feedback_count,
        source: 'marketplace',
      });
    }
  }

  return dedupById(out);
}

function parsePrice(value) {
  if (!value) return undefined;
  if (typeof value === 'number') return value;
  const numeric = String(value).replace(/[^\d.,]/g, '').replace(',', '.');
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dedupById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function queryFromUrl(url, queries) {
  const parsed = new URL(url);
  return parsed.searchParams.get('query') ?? queries[0];
}
