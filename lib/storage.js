const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');
const COMPETITORS_FILE = path.join(DATA_DIR, 'competitors.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

// Check available storage backends
const hasRedis = Boolean(
  process.env.KV_REST_API_URL || 
  process.env.UPSTASH_REDIS_REST_URL
);

const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

let redisClient = null;
if (hasRedis) {
  try {
    const { Redis } = require('@upstash/redis');
    redisClient = new Redis({
      url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
    });
  } catch (err) {
    console.warn('[Storage] Could not initialize Redis client, falling back:', err.message);
  }
}

let blobClient = null;
if (hasBlob && !redisClient) {
  try {
    blobClient = require('@vercel/blob');
  } catch (err) {
    console.warn('[Storage] Could not initialize Vercel Blob, falling back:', err.message);
  }
}

// Ensure local directories exist if running locally
function ensureLocalDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }
}

// Local File Read/Write Helpers
function readJsonLocal(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return defaultValue;
  }
}

function writeJsonLocal(filePath, data) {
  ensureLocalDirs();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Default settings
const defaultSettings = {
  slackWebhookUrl: '',
  slackChannel: '#seo-page-alerts',
  notifyOnlyIfChanges: true,
  notifyOnRemoved: true,
  maxUrlsInSlack: 10,
  dailyScheduleHour: 8,
  dailyScheduleMinute: 0,
  scheduleEnabled: true,
  userAgent: 'Mozilla/5.0 (compatible; PageAlertsBot/1.0; +https://github.com/seo-page-alerts)'
};

// ================= Competitors API =================

async function getCompetitors() {
  if (redisClient) {
    const data = await redisClient.get('competitors');
    if (Array.isArray(data) && data.length > 0) return data;
    // Auto-seed from local file if Redis is empty
    const local = readJsonLocal(COMPETITORS_FILE, []);
    if (local.length > 0) {
      await redisClient.set('competitors', local);
      return local;
    }
    return [];
  }
  return readJsonLocal(COMPETITORS_FILE, []);
}

async function saveCompetitors(competitors) {
  if (redisClient) {
    await redisClient.set('competitors', competitors);
    return competitors;
  }
  writeJsonLocal(COMPETITORS_FILE, competitors);
  return competitors;
}

async function addCompetitor(data) {
  const competitors = await getCompetitors();
  const id = 'comp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newComp = {
    id,
    name: data.name.trim(),
    sitemapUrl: data.sitemapUrl.trim(),
    active: data.active !== undefined ? Boolean(data.active) : true,
    tags: Array.isArray(data.tags) ? data.tags : (data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : []),
    totalUrls: 0,
    lastCheck: null,
    lastDiff: null,
    createdAt: new Date().toISOString()
  };
  competitors.push(newComp);
  await saveCompetitors(competitors);
  return newComp;
}

async function updateCompetitor(id, updates) {
  const competitors = await getCompetitors();
  const idx = competitors.findIndex(c => c.id === id);
  if (idx === -1) return null;

  competitors[idx] = {
    ...competitors[idx],
    ...updates,
    tags: Array.isArray(updates.tags) ? updates.tags : (typeof updates.tags === 'string' ? updates.tags.split(',').map(t => t.trim()).filter(Boolean) : competitors[idx].tags)
  };
  await saveCompetitors(competitors);
  return competitors[idx];
}

async function deleteCompetitor(id) {
  const competitors = await getCompetitors();
  const filtered = competitors.filter(c => c.id !== id);
  await saveCompetitors(filtered);

  if (redisClient) {
    await redisClient.del(`snapshot:${id}:latest`);
    const list = await redisClient.get(`snapshots:${id}:list`) || [];
    for (const snap of list) {
      await redisClient.del(`snapshot:${id}:${snap.filename}`);
    }
    await redisClient.del(`snapshots:${id}:list`);
  } else {
    const compDir = path.join(SNAPSHOTS_DIR, id);
    if (fs.existsSync(compDir)) {
      fs.rmSync(compDir, { recursive: true, force: true });
    }
  }
  return true;
}

// ================= Settings API =================

async function getSettings() {
  const envSlackUrl = process.env.SLACK_WEBHOOK_URL || '';
  const envSlackChannel = process.env.SLACK_CHANNEL || '';

  const defaults = {
    ...defaultSettings,
    slackWebhookUrl: envSlackUrl || defaultSettings.slackWebhookUrl,
    slackChannel: envSlackChannel || defaultSettings.slackChannel
  };

  if (redisClient) {
    const data = await redisClient.get('settings');
    const merged = { ...defaults, ...(data || {}) };
    if (envSlackUrl && !merged.slackWebhookUrl) merged.slackWebhookUrl = envSlackUrl;
    return merged;
  }

  const local = readJsonLocal(SETTINGS_FILE, defaultSettings);
  const merged = { ...defaults, ...local };
  if (envSlackUrl && !merged.slackWebhookUrl) merged.slackWebhookUrl = envSlackUrl;
  return merged;
}

async function saveSettings(settings) {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  if (redisClient) {
    await redisClient.set('settings', updated);
    return updated;
  }
  writeJsonLocal(SETTINGS_FILE, updated);
  return updated;
}

// ================= Snapshots API =================

async function getLatestSnapshot(competitorId) {
  if (redisClient) {
    return await redisClient.get(`snapshot:${competitorId}:latest`);
  }
  const dir = path.join(SNAPSHOTS_DIR, competitorId);
  const latestPath = path.join(dir, 'latest.json');
  return readJsonLocal(latestPath, null);
}

async function saveSnapshot(competitorId, urlMap) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const snapshotData = {
    competitorId,
    timestamp: now.toISOString(),
    totalUrls: Object.keys(urlMap).length,
    urls: urlMap
  };

  if (redisClient) {
    await redisClient.set(`snapshot:${competitorId}:latest`, snapshotData);
    await redisClient.set(`snapshot:${competitorId}:${timestamp}.json`, snapshotData);

    let list = await redisClient.get(`snapshots:${competitorId}:list`) || [];
    list.unshift({
      filename: `${timestamp}.json`,
      createdAt: now.toISOString(),
      totalUrls: snapshotData.totalUrls
    });
    // Keep max 30 snapshots
    if (list.length > 30) {
      const removed = list.slice(30);
      for (const r of removed) {
        await redisClient.del(`snapshot:${competitorId}:${r.filename}`);
      }
      list = list.slice(0, 30);
    }
    await redisClient.set(`snapshots:${competitorId}:list`, list);
    return snapshotData;
  }

  // Local filesystem storage
  ensureLocalDirs();
  const dir = path.join(SNAPSHOTS_DIR, competitorId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const snapshotFile = path.join(dir, `${timestamp}.json`);
  writeJsonLocal(snapshotFile, snapshotData);

  const latestFile = path.join(dir, 'latest.json');
  writeJsonLocal(latestFile, snapshotData);

  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json') && f !== 'latest.json')
      .sort()
      .reverse();
    if (files.length > 30) {
      files.slice(30).forEach(oldFile => {
        fs.unlinkSync(path.join(dir, oldFile));
      });
    }
  } catch (err) {
    console.error('Error cleaning up snapshots:', err);
  }

  return snapshotData;
}

async function getSnapshotList(competitorId) {
  if (redisClient) {
    const list = await redisClient.get(`snapshots:${competitorId}:list`);
    return Array.isArray(list) ? list : [];
  }

  const dir = path.join(SNAPSHOTS_DIR, competitorId);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && f !== 'latest.json')
    .sort()
    .reverse();

  return files.map(filename => {
    const filePath = path.join(dir, filename);
    try {
      const stats = fs.statSync(filePath);
      return {
        filename,
        createdAt: stats.mtime.toISOString(),
        size: stats.size
      };
    } catch {
      return { filename };
    }
  });
}

async function getSnapshotContent(competitorId, filename) {
  if (redisClient) {
    if (filename === 'latest') {
      return await redisClient.get(`snapshot:${competitorId}:latest`);
    }
    return await redisClient.get(`snapshot:${competitorId}:${filename}`);
  }

  const dir = path.join(SNAPSHOTS_DIR, competitorId);
  const filePath = path.join(dir, filename);
  return readJsonLocal(filePath, null);
}

// ================= History Logs API =================

async function getHistory(limit = 50) {
  if (redisClient) {
    const history = await redisClient.get('history');
    const arr = Array.isArray(history) ? history : [];
    return arr.slice(-limit).reverse();
  }
  const history = readJsonLocal(HISTORY_FILE, []);
  return history.slice(-limit).reverse();
}

async function addHistoryEntry(entry) {
  const item = {
    id: 'run_' + Date.now(),
    timestamp: new Date().toISOString(),
    ...entry
  };

  if (redisClient) {
    let history = await redisClient.get('history') || [];
    if (!Array.isArray(history)) history = [];
    history.push(item);
    if (history.length > 200) history = history.slice(-200);
    await redisClient.set('history', history);
    return item;
  }

  const history = readJsonLocal(HISTORY_FILE, []);
  history.push(item);
  if (history.length > 200) {
    history.splice(0, history.length - 200);
  }
  writeJsonLocal(HISTORY_FILE, history);
  return item;
}

ensureLocalDirs();

module.exports = {
  getCompetitors,
  saveCompetitors,
  addCompetitor,
  updateCompetitor,
  deleteCompetitor,
  getSettings,
  saveSettings,
  getLatestSnapshot,
  saveSnapshot,
  getSnapshotList,
  getSnapshotContent,
  getHistory,
  addHistoryEntry
};
