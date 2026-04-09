import { Actor, log } from 'apify';
import { createOutputManager } from './output.js';
import { clampLimit } from './sources/shared.js';
import { runWallapop } from './sources/wallapop.js';
import { runFacebook } from './sources/facebook.js';
import { runInstagram } from './sources/instagram.js';
import { runTikTok } from './sources/tiktok.js';

const SOURCE_RUNNERS = {
  wallapop: runWallapop,
  facebook: runFacebook,
  instagram: runInstagram,
  tiktok: runTikTok,
};

await Actor.init();

try {
  const input = (await Actor.getInput()) ?? {};

  const sources = Array.isArray(input.sources) && input.sources.length > 0
    ? input.sources.filter((source) => source in SOURCE_RUNNERS)
    : Object.keys(SOURCE_RUNNERS);

  const queries = Array.isArray(input.queries)
    ? input.queries.map((q) => String(q).trim()).filter(Boolean)
    : [];

  if (queries.length === 0) {
    throw new Error('Input "queries" must contain at least one non-empty term.');
  }

  const maxItemsPerSource = clampLimit(input.maxItemsPerSource, 1, 500, 30);
  const proxy = {
    useApifyProxy: true,
    ...input.proxy,
  };

  if (input.debug) {
    log.setLevel(log.LEVELS.DEBUG);
  }

  const proxyConfiguration = await Actor.createProxyConfiguration(proxy);
  const output = createOutputManager({
    maxItemsPerSource,
    pushData: (item) => Actor.pushData(item),
  });

  const crawlerOptions = {
    proxyConfiguration,
    maxConcurrency: 3,
    minConcurrency: 1,
    requestHandlerTimeoutSecs: 90,
    maxRequestRetries: 3,
  };

  for (const source of sources) {
    const runSource = SOURCE_RUNNERS[source];
    if (!runSource) continue;

    log.info(`Starting source: ${source}`);

    try {
      const emitted = await runSource({
        queries,
        startUrls: input.startUrls ?? {},
        location: input.location,
        maxItems: maxItemsPerSource,
        crawlerOptions,
        emit: output.emit,
        log,
      });

      log.info(`Source ${source} completed`, { emitted });
    } catch (error) {
      log.warning(`Source ${source} failed and was skipped: ${error.message}`);
    }
  }

  const counts = output.getCounts();
  log.info('Actor finished', {
    totalItems: output.getTotal(),
    counts,
    maxItemsPerSource,
  });

  await Actor.setValue('SUMMARY', {
    generatedAt: new Date().toISOString(),
    totalItems: output.getTotal(),
    counts,
    config: {
      sources,
      queries,
      maxItemsPerSource,
      usedProxy: Boolean(proxy?.useApifyProxy),
    },
  });
} finally {
  await Actor.exit();
}
