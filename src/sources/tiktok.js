import { deepCollectObjects, normalizeSeedUrls, parseEmbeddedJsonCandidates, toAbsoluteUrl, withCrawlerBySource } from './shared.js';

const BASE_URL = 'https://www.tiktok.com';

export async function runTikTok({ queries, startUrls, maxItems, crawlerOptions, emit, log }) {
  const seedUrls = normalizeSeedUrls(startUrls?.tiktok);
  const initialUrls = seedUrls.length > 0 ? seedUrls : queries.map((q) => `${BASE_URL}/search?q=${encodeURIComponent(q)}`);
  let emitted = 0;

  const crawler = withCrawlerBySource({
    useBrowser: true,
    crawlerOptions,
    requestHandler: async ({ request, page }) => {
      if (emitted >= maxItems) return;

      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
      } catch {
        // Best effort.
      }

      const html = await page.content();
      const jsonCandidates = parseEmbeddedJsonCandidates(html, ['__UNIVERSAL_DATA_FOR_REHYDRATION__', 'itemStruct']);
      const videos = extractTikTokVideos(jsonCandidates);

      for (const video of videos) {
        if (emitted >= maxItems) break;
        emitted += 1;

        await emit({
          source: 'tiktok',
          sourceItemId: video.id,
          url: toAbsoluteUrl(BASE_URL, video.url),
          title: video.title,
          description: video.description,
          sellerName: video.authorName,
          sellerId: video.authorId,
          publishedAt: video.publishedAt,
          images: video.images,
          metrics: {
            views: video.views,
            likes: video.likes,
            comments: video.comments,
            shares: video.shares,
          },
          raw: {
            duration: video.duration,
          },
          query: request.userData?.query,
        });
      }

      if (emitted === 0) {
        log.warning('TikTok yielded no parseable public videos in this run.');
      }
    },
  });

  try {
    await crawler.run(initialUrls.map((url) => ({ url, userData: { query: queryFromUrl(url, queries) } })));
  } catch (error) {
    log.warning(`TikTok crawl failed: ${error.message}`);
  }

  return emitted;
}

function extractTikTokVideos(jsonObjects) {
  const out = [];

  for (const jsonObj of jsonObjects) {
    const candidates = deepCollectObjects(
      jsonObj,
      (obj) => obj && typeof obj === 'object' && obj.id && (obj.desc || obj.title) && (obj.author || obj.authorId),
      300,
    );

    for (const item of candidates) {
      const stats = item.stats ?? item.statistics ?? {};

      out.push({
        id: item.id,
        url: item.video?.playAddr ? undefined : item.shareUrl ?? (item.id ? `/@${item.author?.uniqueId ?? item.author?.secUid ?? 'unknown'}/video/${item.id}` : undefined),
        title: item.title ?? item.desc?.slice(0, 80),
        description: item.desc,
        authorName: item.author?.nickname ?? item.authorName,
        authorId: item.author?.id ?? item.authorId,
        publishedAt: item.createTime ? new Date(item.createTime * 1000).toISOString() : undefined,
        images: [item.video?.cover, item.video?.dynamicCover].filter(Boolean),
        views: stats.playCount,
        likes: stats.diggCount,
        comments: stats.commentCount,
        shares: stats.shareCount,
        duration: item.video?.duration,
      });
    }
  }

  return dedupById(out);
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
  return new URL(url).searchParams.get('q') ?? queries[0];
}
