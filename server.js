const express = require('express');
const path = require('path');
const storage = require('./lib/storage');
const runner = require('./lib/runner');
const scheduler = require('./lib/scheduler');
const sitemapParser = require('./lib/sitemapParser');
const slackNotifier = require('./lib/slackNotifier');
const diffEngine = require('./lib/diffEngine');

const app = express();
const PORT = process.env.PORT || 3456;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// State tracker for active check
let isCheckRunning = false;
let lastCheckResult = null;

// ================= API ROUTES =================

// 1. Dashboard Overview Stats
app.get('/api/stats', async (req, res) => {
  try {
    const competitors = await storage.getCompetitors();
    const settings = await storage.getSettings();
    const schedulerStatus = scheduler.getSchedulerStatus();
    const history = await storage.getHistory(1);
    const latestRun = history[0] || null;

    const totalUrls = competitors.reduce((acc, c) => acc + (c.totalUrls || 0), 0);
    const activeCompetitors = competitors.filter(c => c.active !== false).length;

    let totalAddedToday = 0;
    let totalRemovedToday = 0;

    const todayStr = new Date().toISOString().split('T')[0];
    competitors.forEach(c => {
      if (c.lastDiff && c.lastDiff.timestamp && c.lastDiff.timestamp.startsWith(todayStr)) {
        totalAddedToday += (c.lastDiff.added?.length || 0);
        totalRemovedToday += (c.lastDiff.removed?.length || 0);
      }
    });

    res.json({
      totalCompetitors: competitors.length,
      activeCompetitors,
      totalUrls,
      totalAddedToday,
      totalRemovedToday,
      isCheckRunning,
      lastRun: latestRun,
      scheduler: schedulerStatus,
      slackConfigured: Boolean(settings.slackWebhookUrl)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Competitors CRUD
app.get('/api/competitors', async (req, res) => {
  try {
    const competitors = await storage.getCompetitors();
    res.json(competitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/competitors', async (req, res) => {
  const { name, sitemapUrl, tags, active } = req.body;
  if (!name || !sitemapUrl) {
    return res.status(400).json({ error: 'Name and sitemapUrl are required.' });
  }

  try {
    new URL(sitemapUrl);
  } catch {
    return res.status(400).json({ error: 'Please enter a valid URL (including http:// or https://).' });
  }

  try {
    const comp = await storage.addCompetitor({ name, sitemapUrl, tags, active });
    res.status(201).json(comp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/competitors/:id', async (req, res) => {
  try {
    const updated = await storage.updateCompetitor(req.params.id, req.body);
    if (!updated) {
      return res.status(400).json({ error: 'Competitor not found.' });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/competitors/:id', async (req, res) => {
  try {
    const ok = await storage.deleteCompetitor(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Competitor Snapshots & Diff Viewer
app.get('/api/competitors/:id/snapshots', async (req, res) => {
  try {
    const snapshots = await storage.getSnapshotList(req.params.id);
    res.json(snapshots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/competitors/:id/diff', async (req, res) => {
  const { snapA, snapB } = req.query;
  const compId = req.params.id;

  try {
    let currentSnap = null;
    let previousSnap = null;

    if (snapA && snapA !== 'latest') {
      currentSnap = await storage.getSnapshotContent(compId, snapA);
    } else {
      currentSnap = await storage.getLatestSnapshot(compId);
    }

    if (snapB && snapB !== 'previous') {
      previousSnap = await storage.getSnapshotContent(compId, snapB);
    } else {
      const snapshots = await storage.getSnapshotList(compId);
      if (snapshots.length > 1) {
        previousSnap = await storage.getSnapshotContent(compId, snapshots[1].filename);
      }
    }

    const diff = diffEngine.calculateDiff(previousSnap, currentSnap);

    res.json({
      diff,
      currentSnapshotMeta: {
        timestamp: currentSnap?.timestamp || null,
        totalUrls: currentSnap?.totalUrls || 0
      },
      previousSnapshotMeta: {
        timestamp: previousSnap?.timestamp || null,
        totalUrls: previousSnap?.totalUrls || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Manual or Vercel Cron Crawl Execution
app.all(['/api/check/run', '/api/cron/check'], async (req, res) => {
  if (isCheckRunning) {
    return res.status(409).json({ error: 'A sitemap check is already in progress. Please wait.' });
  }

  const { competitorId, sendSlack } = req.body || {};
  const isCron = req.path.includes('cron');
  isCheckRunning = true;

  try {
    const result = await runner.runCheck({
      competitorId,
      trigger: isCron ? 'scheduled' : 'manual',
      sendSlack: sendSlack !== false
    });
    lastCheckResult = result;
    isCheckRunning = false;
    res.json(result);
  } catch (err) {
    isCheckRunning = false;
    res.status(500).json({ error: err.message });
  }
});

// 5. Test Sitemap Inspection
app.post('/api/sitemap/test', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Sitemap URL is required.' });
  }
  try {
    const settings = await storage.getSettings();
    const info = await sitemapParser.inspectSitemap(url, settings.userAgent);
    res.json(info);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Settings & Slack Test
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await storage.getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const updated = await storage.saveSettings(req.body);
    scheduler.reschedule();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/slack/test', async (req, res) => {
  const { webhookUrl, channel } = req.body;
  try {
    const settings = await storage.getSettings();
    const targetUrl = webhookUrl || settings.slackWebhookUrl;

    if (!targetUrl) {
      return res.status(400).json({ error: 'Slack Webhook URL is required.' });
    }

    await slackNotifier.sendTestNotification(targetUrl, channel || settings.slackChannel);
    res.json({ success: true, message: 'Test message sent to Slack successfully!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Audit & Crawl History
app.get('/api/history', async (req, res) => {
  try {
    const history = await storage.getHistory(50);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start scheduler when running as a persistent Node server
if (!process.env.VERCEL) {
  scheduler.initScheduler();

  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Page Alerts Dashboard is running!`);
    console.log(`🔗 Web Dashboard URL: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
