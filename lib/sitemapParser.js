const zlib = require('zlib');
const { XMLParser } = require('fast-xml-parser');

// Permit scraper to fetch public sitemaps across corporate proxies and intermediate certificates
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  parseTagValue: false
});

/**
 * Fetch a URL with headers, timeout, and gzip decompression if needed
 */
async function fetchXml(url, userAgent = 'Mozilla/5.0 (compatible; PageAlertsBot/1.0)') {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/xml,text/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} when fetching ${url}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let xmlText;
    // Check if gzipped (magic bytes 0x1F 0x8B or ends in .gz or content-encoding)
    const isGzipped = (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) ||
                      url.toLowerCase().endsWith('.gz') ||
                      response.headers.get('content-encoding') === 'gzip';

    if (isGzipped) {
      try {
        const decompressed = zlib.gunzipSync(buffer);
        xmlText = decompressed.toString('utf8');
      } catch (gzipErr) {
        // Fallback to raw string if decompression fails
        xmlText = buffer.toString('utf8');
      }
    } else {
      xmlText = buffer.toString('utf8');
    }

    return xmlText;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract clean string from an XML node (handles nested text objects or strings)
 */
function extractText(node) {
  if (!node) return null;
  if (typeof node === 'string') return node.trim();
  if (typeof node === 'object') {
    if (node['#text']) return String(node['#text']).trim();
    if (node['_text']) return String(node['_text']).trim();
    // In case loc contains an array or object
    const values = Object.values(node);
    if (values.length > 0 && typeof values[0] === 'string') return values[0].trim();
  }
  return String(node).trim();
}

/**
 * Parses XML sitemap text into either:
 * - { type: 'sitemapindex', sitemaps: [...] }
 * - { type: 'urlset', urls: { [url]: { lastmod } } }
 */
function parseSitemapContent(xmlContent) {
  const parsed = xmlParser.parse(xmlContent);

  // Look for sitemapindex
  const rootIndex = parsed.sitemapindex || parsed.sitemapIndex || parsed['sitemap-index'];
  if (rootIndex) {
    let sitemapList = rootIndex.sitemap;
    if (!Array.isArray(sitemapList)) {
      sitemapList = sitemapList ? [sitemapList] : [];
    }

    const sitemaps = [];
    for (const item of sitemapList) {
      const loc = extractText(item.loc);
      const lastmod = extractText(item.lastmod);
      if (loc) {
        sitemaps.push({ loc, lastmod });
      }
    }
    return { type: 'sitemapindex', sitemaps };
  }

  // Look for urlset
  const rootUrlset = parsed.urlset || parsed.urlSet || parsed['url-set'];
  if (rootUrlset) {
    let urlList = rootUrlset.url;
    if (!Array.isArray(urlList)) {
      urlList = urlList ? [urlList] : [];
    }

    const urls = {};
    for (const item of urlList) {
      const loc = extractText(item.loc);
      const lastmod = extractText(item.lastmod);
      if (loc) {
        urls[loc] = {
          lastmod: lastmod || null
        };
      }
    }
    return { type: 'urlset', urls };
  }

  // Fallback regex in case of unusual XML namespaces or broken root tags
  const fallbackUrls = {};
  const locRegex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(xmlContent)) !== null) {
    const loc = match[1].trim();
    fallbackUrls[loc] = { lastmod: null };
  }

  if (Object.keys(fallbackUrls).length > 0) {
    return { type: 'urlset', urls: fallbackUrls };
  }

  throw new Error('Unrecognized sitemap format: neither <urlset> nor <sitemapindex> found.');
}

/**
 * Helper to derive a clean human-readable page type / category from a sitemap URL
 */
function deriveCategoryFromSitemapUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const filename = pathname.split('/').pop() || '';
    const cleanName = filename.replace(/\.(xml|gz)$/i, '');

    if (/product/i.test(cleanName)) return 'Products';
    if (/blog|post|article/i.test(cleanName)) return 'Blog Posts';
    if (/collection|category|cat/i.test(cleanName)) return 'Collections / Categories';
    if (/page/i.test(cleanName)) return 'Pages';
    if (/author|user/i.test(cleanName)) return 'Authors';
    if (/tag/i.test(cleanName)) return 'Tags';
    if (/brand/i.test(cleanName)) return 'Brands';
    if (/discovery|agentic/i.test(cleanName)) return 'Discovery';

    // Fallback: capitalized clean filename
    const parts = cleanName.replace(/[-_]/g, ' ').trim();
    if (parts) {
      return parts.charAt(0).toUpperCase() + parts.slice(1);
    }
    return 'General';
  } catch {
    return 'General';
  }
}

/**
 * Crawls a sitemap URL recursively if it's a sitemapindex.
 * Returns { totalUrls: number, urls: { [url]: { lastmod, sourceSitemap, category } }, subSitemaps: [], errors: [] }
 */
async function crawlSitemap(startUrl, userAgent, options = {}) {
  const maxSitemaps = options.maxSitemaps || 60; // Max child sitemaps to traverse
  const results = {};
  const processedSitemaps = new Set();
  const queue = [startUrl];
  const subSitemapsInfo = [];
  const errors = [];
  let isIndex = false;

  while (queue.length > 0 && processedSitemaps.size < maxSitemaps) {
    const currentUrl = queue.shift();
    if (processedSitemaps.has(currentUrl)) continue;
    processedSitemaps.add(currentUrl);

    try {
      const xml = await fetchXml(currentUrl, userAgent);
      const parsed = parseSitemapContent(xml);

      if (parsed.type === 'sitemapindex') {
        isIndex = true;
        for (const child of parsed.sitemaps) {
          if (!processedSitemaps.has(child.loc) && !queue.includes(child.loc)) {
            queue.push(child.loc);
          }
        }
      } else if (parsed.type === 'urlset') {
        const category = deriveCategoryFromSitemapUrl(currentUrl);
        const urlEntries = Object.entries(parsed.urls);

        for (const [url, meta] of urlEntries) {
          results[url] = {
            lastmod: meta.lastmod,
            sourceSitemap: currentUrl,
            category
          };
        }

        subSitemapsInfo.push({
          url: currentUrl,
          name: category,
          count: urlEntries.length
        });
      }
    } catch (err) {
      console.error(`Error processing sitemap ${currentUrl}:`, err.message);
      errors.push({ url: currentUrl, error: err.message });
    }
  }

  return {
    isIndex,
    totalUrls: Object.keys(results).length,
    urls: results,
    subSitemaps: subSitemapsInfo,
    sitemapsProcessed: processedSitemaps.size,
    errors
  };
}

/**
 * Fast test/inspection of a sitemap URL without crawling all sub-sitemaps
 */
async function inspectSitemap(url, userAgent) {
  const xml = await fetchXml(url, userAgent);
  const parsed = parseSitemapContent(xml);

  if (parsed.type === 'sitemapindex') {
    const categorizedChildren = parsed.sitemaps.map(s => ({
      loc: s.loc,
      lastmod: s.lastmod,
      category: deriveCategoryFromSitemapUrl(s.loc)
    }));

    return {
      type: 'sitemapindex',
      childSitemapsCount: parsed.sitemaps.length,
      sampleChildSitemaps: categorizedChildren.slice(0, 8),
      allChildSitemaps: categorizedChildren,
      valid: true
    };
  } else {
    const urls = Object.keys(parsed.urls);
    const category = deriveCategoryFromSitemapUrl(url);
    return {
      type: 'urlset',
      category,
      totalUrlsFound: urls.length,
      sampleUrls: urls.slice(0, 5),
      valid: true
    };
  }
}

module.exports = {
  fetchXml,
  parseSitemapContent,
  crawlSitemap,
  inspectSitemap
};
