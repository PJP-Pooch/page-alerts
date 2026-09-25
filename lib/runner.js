const storage = require('./storage');
const sitemapParser = require('./sitemapParser');
const diffEngine = require('./diffEngine');
const slackNotifier = require('./slackNotifier');

/**
 * Executes a full crawl, diff calculation, snapshot persistence, and optional Slack notification.
 * @param {Object} options - { competitorId, trigger: 'manual'|'scheduled'|'cli', sendSlack: boolean }
 */
async function runCheck(options = {}) {
  const trigger = options.trigger || 'manual';
  const sendSlack = options.sendSlack !== false;
  const targetCompId = options.competitorId || null;
  const targetProjectId = options.projectId || null;

  const startTime = Date.now();
  const settings = await storage.getSettings();
  let competitors = await storage.getCompetitors();

  if (targetCompId) {
    competitors = competitors.filter(c => c.id === targetCompId);
  } else if (targetProjectId && targetProjectId !== 'all') {
    competitors = competitors.filter(c => c.active !== false && c.projectId === targetProjectId);
  } else {
    competitors = competitors.filter(c => c.active !== false);
  }

  if (competitors.length === 0) {
    return {
      success: true,
      message: 'No active competitors found to check.',
      results: [],
      durationMs: Date.now() - startTime
    };
  }

  console.log(`[PageAlerts Runner] Starting check for ${competitors.length} competitor(s) (Trigger: ${trigger})...`);

  const results = [];
  let totalAddedCount = 0;
  let totalRemovedCount = 0;
  const errors = [];

  for (const comp of competitors) {
    console.log(`[PageAlerts Runner] Processing "${comp.name}" (${comp.sitemapUrl})...`);
    const compStartTime = Date.now();

    try {
      // 1. Get yesterday's / latest previous snapshot
      const previousSnapshot = await storage.getLatestSnapshot(comp.id);

      // 2. Fetch and parse current XML sitemap
      const crawlResult = await sitemapParser.crawlSitemap(comp.sitemapUrl, settings.userAgent);

      // Safeguard 1: Failed fetch / parse error should never be treated as zero URLs
      if (crawlResult.totalUrls === 0 && crawlResult.errors && crawlResult.errors.length > 0) {
        const errorDetails = crawlResult.errors.map(e => `${e.url}: ${e.error}`).join('; ');
        throw new Error(`Sitemap crawl failed (${errorDetails})`);
      }

      // Safeguard 2: Sudden 100% drop to 0 URLs when previous snapshot had URLs
      if (crawlResult.totalUrls === 0 && previousSnapshot && (previousSnapshot.totalUrls || 0) > 0) {
        throw new Error(`Sitemap returned 0 URLs while previous snapshot had ${previousSnapshot.totalUrls.toLocaleString()} URLs. Preserving snapshot to prevent false deletion alert.`);
      }

      // Safeguard 3: Severe drop (>70% URLs missing) while encountering errors in sub-sitemaps
      const prevTotal = previousSnapshot?.totalUrls || 0;
      if (prevTotal > 50 && crawlResult.errors && crawlResult.errors.length > 0 && crawlResult.totalUrls < (prevTotal * 0.3)) {
        throw new Error(`Incomplete crawl detected (${crawlResult.totalUrls} of ${prevTotal} URLs loaded with ${crawlResult.errors.length} sitemap errors). Preserving previous snapshot.`);
      }

      // 3. Compute diff against previous snapshot
      const diff = diffEngine.calculateDiff(previousSnapshot, crawlResult);

      // 4. Save new current snapshot
      const savedSnapshot = await storage.saveSnapshot(comp.id, crawlResult.urls);

      // 5. Update competitor record
      await storage.updateCompetitor(comp.id, {
        totalUrls: crawlResult.totalUrls,
        lastCheck: new Date().toISOString(),
        lastDiff: {
          added: diff.added,
          removed: diff.removed,
          byCategory: diff.byCategory,
          modifiedCount: diff.modified.length,
          timestamp: new Date().toISOString(),
          isFirstRun: diff.isFirstRun
        }
      });

      totalAddedCount += diff.added.length;
      totalRemovedCount += diff.removed.length;

      results.push({
        competitor: comp,
        totalUrls: crawlResult.totalUrls,
        isFirstRun: diff.isFirstRun,
        diff,
        durationMs: Date.now() - compStartTime,
        crawlErrors: crawlResult.errors
      });

      console.log(`[PageAlerts Runner] Done "${comp.name}": ${crawlResult.totalUrls} URLs (+${diff.added.length}, -${diff.removed.length})`);
    } catch (err) {
      console.error(`[PageAlerts Runner] Error checking "${comp.name}":`, err.message);
      errors.push({ competitorId: comp.id, name: comp.name, error: err.message });
      results.push({
        competitor: comp,
        error: err.message,
        totalUrls: comp.totalUrls || 0,
        isFirstRun: false,
        diff: { added: [], removed: [], modified: [] },
        durationMs: Date.now() - compStartTime
      });
    }
  }

  // 6. Slack notification
  let slackSent = false;
  let slackError = null;

  const projects = await storage.getProjects();
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const targetProject = targetProjectId && targetProjectId !== 'all' ? projectMap.get(targetProjectId) : null;
  const pName = targetProject ? targetProject.name : 'All Projects';

  if (sendSlack) {
    try {
      // Group results by project
      const resultsByProject = new Map();
      for (const res of results) {
        if (res.error) continue;
        const pId = res.competitor?.projectId || 'proj_default';
        if (!resultsByProject.has(pId)) resultsByProject.set(pId, []);
        resultsByProject.get(pId).push(res);
      }

      for (const [pId, projResults] of resultsByProject.entries()) {
        const proj = projectMap.get(pId) || { name: 'Main Project', type: 'competitor' };
        const webhookUrl = (proj && proj.slackWebhookUrl) ? proj.slackWebhookUrl : settings.slackWebhookUrl;
        if (!webhookUrl) continue;

        console.log(`[PageAlerts Runner] Sending Slack notification for project "${proj.name}"...`);
        const sent = await slackNotifier.sendDailySummaryNotification(
          webhookUrl,
          projResults,
          settings,
          proj
        );
        if (sent) slackSent = true;
      }
    } catch (sErr) {
      console.error('[PageAlerts Runner] Slack notification failed:', sErr.message);
      slackError = sErr.message;
    }
  }

  const durationMs = Date.now() - startTime;

  // 7. Record run history
  await storage.addHistoryEntry({
    trigger,
    projectId: targetProjectId || 'all',
    projectName: pName,
    competitorsCount: competitors.length,
    totalAdded: totalAddedCount,
    totalRemoved: totalRemovedCount,
    durationMs,
    slackSent: Boolean(slackSent),
    slackError,
    errors
  });

  return {
    success: errors.length < competitors.length,
    projectId: targetProjectId || 'all',
    projectName: pName,
    competitorsChecked: competitors.length,
    totalAdded: totalAddedCount,
    totalRemoved: totalRemovedCount,
    slackSent: Boolean(slackSent),
    slackError,
    errors,
    results,
    durationMs
  };
}

module.exports = {
  runCheck
};
