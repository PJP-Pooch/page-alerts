const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const storage = require('./lib/storage');
const runner = require('./lib/runner');
const scheduler = require('./lib/scheduler');
const sitemapParser = require('./lib/sitemapParser');
const slackNotifier = require('./lib/slackNotifier');
const diffEngine = require('./lib/diffEngine');
const auth = require('./lib/auth');

const app = express();
const PORT = process.env.PORT || 3456;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Serve index.html on root
app.get('/', (req, res) => {
  const p = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.sendFile(path.join(__dirname, 'index.html'));
});

// State tracker for active check
let isCheckRunning = false;
let lastCheckResult = null;

// ================= AUTHENTICATION ROUTES =================

// 1. Auth Status (Check if user is logged in & if Google Auth is enabled)
app.get('/api/auth/status', (req, res) => {
  const authConfigured = auth.isAuthConfigured();
  if (!authConfigured) {
    return res.json({
      authConfigured: false,
      authenticated: true,
      user: { name: 'Local Admin', email: 'admin@local' }
    });
  }

  const token = req.cookies ? req.cookies[auth.COOKIE_NAME] : null;
  const user = auth.verifySignedToken(token);

  if (user && auth.isEmailAllowed(user.email)) {
    return res.json({
      authConfigured: true,
      authenticated: true,
      user: {
        name: user.name,
        email: user.email,
        picture: user.picture
      },
      allowedDomain: auth.ALLOWED_DOMAIN
    });
  }

  return res.json({
    authConfigured: true,
    authenticated: false,
    allowedDomain: auth.ALLOWED_DOMAIN
  });
});

// 2. Initiate Google OAuth Login
app.get('/api/auth/login', (req, res) => {
  if (!auth.isAuthConfigured()) {
    return res.redirect('/');
  }

  const redirectUri = auth.getRedirectUri(req);
  const params = new URLSearchParams({
    client_id: auth.CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account'
  });

  if (auth.ALLOWED_DOMAIN) {
    const firstDomain = auth.ALLOWED_DOMAIN.split(',')[0].trim().replace(/^@/, '');
    params.append('hd', firstDomain);
  }

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// 3. Google OAuth Callback
app.get('/api/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Authentication failed: Missing authorization code.');
  }

  try {
    const redirectUri = auth.getRedirectUri(req);

    // Exchange code for Google Access Token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: auth.CLIENT_ID,
        client_secret: auth.CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || 'Failed to exchange authorization token with Google.');
    }

    // Fetch user profile from Google
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const profile = await profileRes.json();
    if (!profileRes.ok || !profile.email) {
      throw new Error('Failed to retrieve user profile from Google.');
    }

    // Verify company domain
    if (!auth.isEmailAllowed(profile.email)) {
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Access Denied - PageAlerts</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .box { background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 36px; max-width: 480px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            h2 { color: #f43f5e; margin-bottom: 12px; }
            p { color: #9ca3af; font-size: 0.95rem; line-height: 1.6; }
            .email { color: #67e8f9; font-weight: 600; }
            .btn { display: inline-block; margin-top: 24px; padding: 10px 20px; background: #8b5cf6; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>⛔ Access Restricted</h2>
            <p>You signed in as <span class="email">${profile.email}</span>.</p>
            <p>PageAlerts is restricted to accounts with domain: <strong>@${auth.ALLOWED_DOMAIN}</strong>.</p>
            <a href="/api/auth/login" class="btn">Try Another Google Account</a>
          </div>
        </body>
        </html>
      `);
    }

    // Issue signed session cookie (14 days validity)
    const sessionToken = auth.createSignedToken({
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      picture: profile.picture || null,
      exp: Date.now() + 14 * 24 * 60 * 60 * 1000
    });

    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie(auth.COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 14 * 24 * 60 * 60 * 1000
    });

    res.redirect('/');
  } catch (err) {
    console.error('[Google OAuth Error]', err);
    res.status(500).send(`Authentication error: ${err.message}`);
  }
});

// 4. Logout
app.all('/api/auth/logout', (req, res) => {
  res.clearCookie(auth.COOKIE_NAME);
  res.redirect('/');
});

// ================= PROTECTED API ROUTES =================
// Protect all remaining /api routes (except /api/cron/check which handles Vercel crons)
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth') || req.path.startsWith('/cron')) {
    return next();
  }
  auth.requireAuth(req, res, next);
});

// 1. Dashboard Overview Stats
app.get('/api/stats', async (req, res) => {
  try {
    const competitors = await storage.getCompetitors();
    const settings = await storage.getSettings();
    const schedulerStatus = scheduler.getSchedulerStatus(settings);
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

// 4. Crawl Execution (Manual or Automated Vercel Cron)
app.all(['/api/check/run', '/api/cron/check'], async (req, res) => {
  if (isCheckRunning) {
    return res.status(409).json({ error: 'A sitemap check is already in progress. Please wait.' });
  }

  const { competitorId } = req.body || {};
  const isCron = req.path.includes('cron') || Boolean(req.headers['x-vercel-cron']);
  
  // Only send Slack if triggered by schedule/cron, or if explicitly requested
  const shouldSendSlack = (req.body && req.body.sendSlack !== undefined)
    ? Boolean(req.body.sendSlack)
    : isCron;

  isCheckRunning = true;

  try {
    const result = await runner.runCheck({
      competitorId,
      trigger: isCron ? 'scheduled' : 'manual',
      sendSlack: shouldSendSlack
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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[PageAlerts Express Error]:', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error',
    stack: err.stack || null
  });
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
