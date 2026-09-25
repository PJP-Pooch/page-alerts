/**
 * Calculates the difference between two sitemap snapshots:
 * - Added URLs: exist in current but not in previous
 * - Removed URLs: exist in previous but not in current
 * - Modified URLs: exist in both but lastmod differs
 */
function calculateDiff(previousSnapshot, currentSnapshot) {
  const currentUrlsMap = currentSnapshot?.urls || {};
  const currentUrls = Object.keys(currentUrlsMap);
  const currentSet = new Set(currentUrls);

  // If there is no previous snapshot, this is the first baseline crawl
  if (!previousSnapshot || !previousSnapshot.urls) {
    return {
      isFirstRun: true,
      added: [],
      removed: [],
      modified: [],
      summary: {
        addedCount: 0,
        removedCount: 0,
        modifiedCount: 0,
        totalCurrent: currentUrls.length,
        totalPrevious: 0,
        baselineEstablished: true
      }
    };
  }

  const previousUrlsMap = previousSnapshot.urls || {};
  const previousUrls = Object.keys(previousUrlsMap);
  const previousSet = new Set(previousUrls);

  const added = [];
  const modified = [];
  const byCategory = {};

  function ensureCategory(cat) {
    if (!byCategory[cat]) {
      byCategory[cat] = { added: [], removed: [] };
    }
  }

  for (const url of currentUrls) {
    const currentMeta = currentUrlsMap[url] || {};
    const cat = currentMeta.category || 'General';

    if (!previousSet.has(url)) {
      const item = { url, category: cat, sourceSitemap: currentMeta.sourceSitemap || null };
      added.push(item);
      ensureCategory(cat);
      byCategory[cat].added.push(item);
    } else {
      const prevMod = previousUrlsMap[url]?.lastmod;
      const currMod = currentMeta.lastmod;
      if (prevMod && currMod && prevMod !== currMod) {
        modified.push({
          url,
          category: cat,
          prevLastmod: prevMod,
          currentLastmod: currMod
        });
      }
    }
  }

  const removed = [];
  for (const url of previousUrls) {
    const prevMeta = previousUrlsMap[url] || {};
    const cat = prevMeta.category || 'General';

    if (!currentSet.has(url)) {
      const item = { url, category: cat, sourceSitemap: prevMeta.sourceSitemap || null };
      removed.push(item);
      ensureCategory(cat);
      byCategory[cat].removed.push(item);
    }
  }

  // Sort
  added.sort((a, b) => a.url.localeCompare(b.url));
  removed.sort((a, b) => a.url.localeCompare(b.url));

  return {
    isFirstRun: false,
    added,
    removed,
    modified,
    byCategory,
    summary: {
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
      totalCurrent: currentUrls.length,
      totalPrevious: previousUrls.length,
      hasChanges: (added.length > 0 || removed.length > 0)
    }
  };
}

module.exports = {
  calculateDiff
};
