const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MAX_SNAPSHOTS = 7;
const MAX_HISTORY = 50;
const GZIP_PREFIX = '__gz__:';

/**
 * Gzip-compress a JavaScript object into a base64 string with prefix.
 * Shrinks JSON sitemap snapshots by 90-95%, keeping storage ultra-lightweight.
 */
function compressData(obj) {
  if (!obj) return obj;
  try {
    const jsonStr = JSON.stringify(obj);
    const buf = zlib.gzipSync(Buffer.from(jsonStr, 'utf8'));
    return GZIP_PREFIX + buf.toString('base64');
  } catch (err) {
    console.error('[Storage] Compression failed, falling back to raw:', err.message);
    return obj;
  }
}

/**
 * Decompress a stored string or return the object as-is if uncompressed.
 * Ensures 100% backwards compatibility with existing stored snapshots.
 */
function decompressData(data) {
  if (!data) return data;
  if (typeof data === 'string' && data.startsWith(GZIP_PREFIX)) {
    try {
      const base64Str = data.slice(GZIP_PREFIX.length);
      const buf = Buffer.from(base64Str, 'base64');
      const decompressed = zlib.gunzipSync(buf);
      return JSON.parse(decompressed.toString('utf8'));
    } catch (err) {
      console.error('[Storage] Decompression failed:', err.message);
      return null;
    }
  }
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

const IS_VERCEL = Boolean(process.env.VERCEL);
const BUNDLE_DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_DIR = IS_VERCEL ? path.join('/tmp', 'data') : BUNDLE_DATA_DIR;
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
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

// Ensure local directories exist safely
function ensureLocalDirs() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(SNAPSHOTS_DIR)) {
      fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    }
    // If on Vercel, copy initial seed competitors into /tmp/data
    if (IS_VERCEL) {
      const seedFile = path.join(BUNDLE_DATA_DIR, 'competitors.json');
      if (fs.existsSync(seedFile) && !fs.existsSync(COMPETITORS_FILE)) {
        fs.copyFileSync(seedFile, COMPETITORS_FILE);
      }
    }
  } catch (err) {
    console.warn('[Storage] Error ensuring dirs:', err.message);
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

// Default projects list
const defaultProjects = [
  {
    id: 'proj_default',
    name: 'Pooch & Mutt',
    type: 'competitor',
    description: 'Competitor pet food brands monitoring',
    slackWebhookUrl: '',
    slackChannel: '',
    createdAt: new Date().toISOString()
  },
  {
    id: 'proj_own',
    name: 'Vafo Digital',
    type: 'own_site',
    description: 'Internal sitemap monitoring for our own websites',
    slackWebhookUrl: '',
    slackChannel: '',
    createdAt: new Date().toISOString()
  }
];

// ================= Projects API =================

async function getProjects() {
  if (redisClient) {
    const data = await redisClient.get('projects');
    if (Array.isArray(data) && data.length > 0) return data;
    await redisClient.set('projects', defaultProjects);
    return defaultProjects;
  }
  const local = readJsonLocal(PROJECTS_FILE, null);
  if (Array.isArray(local) && local.length > 0) return local;
  writeJsonLocal(PROJECTS_FILE, defaultProjects);
  return defaultProjects;
}

async function saveProjects(projects) {
  if (redisClient) {
    await redisClient.set('projects', projects);
    return projects;
  }
  writeJsonLocal(PROJECTS_FILE, projects);
  return projects;
}

async function addProject(data) {
  const projects = await getProjects();
  const id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const newProj = {
    id,
    name: data.name.trim(),
    type: data.type === 'own_site' ? 'own_site' : 'competitor',
    description: (data.description || '').trim(),
    slackWebhookUrl: (data.slackWebhookUrl || '').trim(),
    slackChannel: (data.slackChannel || '').trim(),
    createdAt: new Date().toISOString()
  };
  projects.push(newProj);
  await saveProjects(projects);
  return newProj;
}

async function updateProject(id, updates) {
  const projects = await getProjects();
  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) return null;

  projects[idx] = {
    ...projects[idx],
    ...updates
  };
  await saveProjects(projects);
  return projects[idx];
}

async function deleteProject(id) {
  // Never delete if only one project remains
  const projects = await getProjects();
  if (projects.length <= 1) {
    throw new Error('Cannot delete the last remaining project.');
  }

  const filtered = projects.filter(p => p.id !== id);
  await saveProjects(filtered);

  // Move or delete competitors in this project
  const competitors = await getCompetitors();
  const fallbackProjId = filtered[0].id;
  for (const c of competitors) {
    if (c.projectId === id) {
      c.projectId = fallbackProjId;
    }
  }
  await saveCompetitors(competitors);
  return true;
}

// ================= Competitors API =================

async function getCompetitors() {
  let list = [];
  if (redisClient) {
    const data = await redisClient.get('competitors');
    if (Array.isArray(data) && data.length > 0) {
      list = data;
    } else {
      let local = readJsonLocal(COMPETITORS_FILE, []);
      if (!local || local.length === 0) {
        local = readJsonLocal(path.join(BUNDLE_DATA_DIR, 'competitors.json'), []);
      }
      if (local && local.length > 0) {
        await redisClient.set('competitors', local);
        list = local;
      }
    }
  } else {
    list = readJsonLocal(COMPETITORS_FILE, []);
  }

  // Ensure every competitor has a projectId and siteType
  let modified = false;
  list.forEach(c => {
    if (!c.projectId) {
      c.projectId = 'proj_default';
      modified = true;
    }
    if (!c.siteType) {
      c.siteType = 'competitor';
      modified = true;
    }
  });

  return list;
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
    projectId: data.projectId || 'proj_default',
    siteType: data.siteType || (data.projectId === 'proj_own' ? 'own_site' : 'competitor'),
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
    const raw = await redisClient.get(`snapshot:${competitorId}:latest`);
    return decompressData(raw);
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
    const compressed = compressData(snapshotData);
    await redisClient.set(`snapshot:${competitorId}:latest`, compressed);
    await redisClient.set(`snapshot:${competitorId}:${timestamp}.json`, compressed);

    let list = await redisClient.get(`snapshots:${competitorId}:list`) || [];
    list.unshift({
      filename: `${timestamp}.json`,
      createdAt: now.toISOString(),
      totalUrls: snapshotData.totalUrls
    });
    // Keep max 7 snapshots in Redis
    if (list.length > MAX_SNAPSHOTS) {
      const removed = list.slice(MAX_SNAPSHOTS);
      for (const r of removed) {
        await redisClient.del(`snapshot:${competitorId}:${r.filename}`);
      }
      list = list.slice(0, MAX_SNAPSHOTS);
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
    if (files.length > MAX_SNAPSHOTS) {
      files.slice(MAX_SNAPSHOTS).forEach(oldFile => {
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
    let raw;
    if (filename === 'latest') {
      raw = await redisClient.get(`snapshot:${competitorId}:latest`);
    } else {
      raw = await redisClient.get(`snapshot:${competitorId}:${filename}`);
    }
    return decompressData(raw);
  }

  const dir = path.join(SNAPSHOTS_DIR, competitorId);
  const filePath = path.join(dir, filename);
  return readJsonLocal(filePath, null);
}

// ================= History Logs API =================

async function getHistory(limit = 50, projectId = null) {
  let list = [];
  if (redisClient) {
    const history = await redisClient.get('history');
    list = Array.isArray(history) ? history : [];
  } else {
    list = readJsonLocal(HISTORY_FILE, []);
  }

  if (projectId && projectId !== 'all') {
    list = list.filter(item => {
      // Include specific runs for this project, global runs, and legacy runs without a projectId
      return item.projectId === projectId || item.projectId === 'all' || !item.projectId;
    });
  }

  return list.slice(-limit).reverse();
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
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    await redisClient.set('history', history);
    return item;
  }

  const history = readJsonLocal(HISTORY_FILE, []);
  history.push(item);
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
  writeJsonLocal(HISTORY_FILE, history);
  return item;
}

ensureLocalDirs();

module.exports = {
  getProjects,
  saveProjects,
  addProject,
  updateProject,
  deleteProject,
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
