import { deepCollectObjects, normalizeSeedUrls, parseEmbeddedJsonCandidates, toAbsoluteUrl, withCrawlerBySource } from './shared.js';

const BASE_URL = 'https://www.instagram.com';

export async function runInstagram({ queries, startUrls, maxItems, crawlerOptions, emit, log }) {
  const seedUrls = normalizeSeedUrls(startUrls?.instagram);
  const initialUrls = seedUrls.length > 0 ? seedUrls : queries.map((q) => `${BASE_URL}/explore/tags/${encodeURIComponent(cleanTag(q))}/`);
  let emitted = 0;

  const crawler = withCrawlerBySource({
    useBrowser: true,
    crawlerOptions,
    requestHandler: async ({ request, page }) => {
      if (emitted >= maxItems) return;

      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
      } catch {
        // Continue best effort.
      }

      const html = await page.content();
      const jsonCandidates = parseEmbeddedJsonCandidates(html, ['_sharedData', 'xdt_api__v1__media', 'edge_hashtag_to_media']);
      const posts = extractInstagramPosts(jsonCandidates);

      for (const post of posts) {
        if (emitted >= maxItems) break;
        emitted += 1;

        await emit({
          source: 'instagram',
          sourceItemId: post.id,
          url: toAbsoluteUrl(BASE_URL, post.url),
          title: post.title,
          description: post.caption,
          sellerName: post.ownerUsername,
          sellerId: post.ownerId,
          publishedAt: post.publishedAt,
          images: post.images,
          metrics: {
            likes: post.likes,
            comments: post.comments,
            views: post.views,
          },
          raw: {
            mediaType: post.mediaType,
          },
          query: request.userData?.query,
        });
      }

      if (emitted === 0) {
        log.warning('Instagram returned no parseable public media. This often depends on region/rate limits.');
      }
    },
  });

  try {
    await crawler.run(initialUrls.map((url) => ({ url, userData: { query: queryFromUrl(url, queries) } })));
  } catch (error) {
    log.warning(`Instagram crawl failed: ${error.message}`);
  }

  return emitted;
}

function extractInstagramPosts(jsonObjects) {
  const out = [];

  for (const jsonObj of jsonObjects) {
    const candidates = deepCollectObjects(
      jsonObj,
      (obj) => obj && typeof obj === 'object' && (obj.id || obj.pk) && (obj.shortcode || obj.code || obj.permalink),
      300,
    );

    for (const item of candidates) {
      const edges = item.edge_media_to_caption?.edges ?? [];
      const firstCaption = edges[0]?.node?.text ?? item.caption?.text ?? item.accessibility_caption;
      const images = [
        item.display_url,
        item.thumbnail_src,
        ...(item.thumbnail_resources?.map((r) => r?.src) ?? []),
      ].filter(Boolean);

      out.push({
        id: item.id ?? item.pk,
        url: item.permalink ?? (item.shortcode ? `/p/${item.shortcode}/` : undefined),
        title: firstCaption?.slice(0, 80),
        caption: firstCaption,
        ownerUsername: item.owner?.username,
        ownerId: item.owner?.id,
        publishedAt: item.taken_at_timestamp ? new Date(item.taken_at_timestamp * 1000).toISOString() : undefined,
        images,
        likes: item.edge_liked_by?.count ?? item.like_count,
        comments: item.edge_media_to_comment?.count ?? item.comment_count,
        views: item.video_view_count,
        mediaType: item.is_video ? 'video' : 'image',
      });
    }
  }

  return dedupById(out);
}

function cleanTag(value) {
  return String(value).replace(/^#/, '').trim();
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
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  if (segments[0] === 'explore' && segments[1] === 'tags') {
    return segments[2] ?? queries[0];
  }
  return queries[0];
}
