/**
 * Formats and sends Slack notifications using Incoming Webhooks and Slack Block Kit
 */

async function sendSlackWebhook(webhookUrl, payload) {
  if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
    throw new Error('Invalid Slack webhook URL. It must begin with https://hooks.slack.com/');
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack API error: ${response.status} - ${text}`);
  }

  return true;
}

/**
 * Sends a test ping to verify webhook connectivity
 */
async function sendTestNotification(webhookUrl, channel = '#seo-alerts') {
  const payload = {
    text: '🔔 Page Alerts: Slack Webhook Test Successful!',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚀 Page Alerts Connected Successfully!',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Your Slack webhook is verified and working. Page Alerts will send daily competitor sitemap diff reports to this channel (*${channel}*).`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Timestamp:* ${new Date().toLocaleString()} | *Status:* Ready for daily checks`
          }
        ]
      }
    ]
  };

  return await sendSlackWebhook(webhookUrl, payload);
}

/**
 * Builds and sends the full daily competitor sitemap summary
 */
async function sendDailySummaryNotification(webhookUrl, results, settings = {}) {
  if (!webhookUrl) {
    console.warn('Slack Webhook URL is not set. Skipping Slack notification.');
    return false;
  }

  const maxUrls = settings.maxUrlsInSlack || 8;
  const notifyOnlyIfChanges = settings.notifyOnlyIfChanges !== false;
  const notifyOnRemoved = settings.notifyOnRemoved !== false;

  const competitorsWithChanges = results.filter(r => !r.isFirstRun && (r.diff.added.length > 0 || (notifyOnRemoved && r.diff.removed.length > 0)));
  const baselineCompetitors = results.filter(r => r.isFirstRun);
  const totalAddedAll = results.reduce((acc, r) => acc + (r.diff?.added?.length || 0), 0);
  const totalRemovedAll = results.reduce((acc, r) => acc + (r.diff?.removed?.length || 0), 0);
  const hasAnyChanges = competitorsWithChanges.length > 0;

  // If notifyOnlyIfChanges is true and nothing changed and no baseline, exit
  if (notifyOnlyIfChanges && !hasAnyChanges && baselineCompetitors.length === 0) {
    console.log('No competitor changes detected. Skipping Slack alert due to notifyOnlyIfChanges setting.');
    return false;
  }

  const blocks = [];

  // Header
  const title = hasAnyChanges
    ? '🚨 Competitor Sitemap Alert: Changes Detected'
    : baselineCompetitors.length > 0
      ? '📦 Competitor Sitemap Baseline Created'
      : '✅ Competitor Sitemap Check: No Changes';

  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: title,
      emoji: true
    }
  });

  // Overview summary section
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Monitored Competitors:* ${results.length} | *🟢 New Pages:* +${totalAddedAll} | *🔴 Removed Pages:* -${totalRemovedAll}\n_Check completed at ${new Date().toLocaleString()}_`
    }
  });

  blocks.push({ type: 'divider' });

  // Details per competitor with changes
  for (const compResult of competitorsWithChanges) {
    const comp = compResult.competitor;
    const diff = compResult.diff;
    const addedCount = diff.added.length;
    const removedCount = diff.removed.length;

    let compText = `*<${comp.sitemapUrl}|${comp.name}>*\n`;
    compText += `🟢 *+${addedCount} Added*  |  🔴 *-${removedCount} Removed*  |  📊 *Total Pages:* ${compResult.totalUrls}\n`;

    // If we have category breakdown
    const byCategory = diff.byCategory || {};
    const categoriesWithChanges = Object.keys(byCategory).filter(cat => 
      byCategory[cat].added.length > 0 || (notifyOnRemoved && byCategory[cat].removed.length > 0)
    );

    if (categoriesWithChanges.length > 0) {
      for (const cat of categoriesWithChanges) {
        const catAdded = byCategory[cat].added || [];
        const catRemoved = byCategory[cat].removed || [];

        let catHeader = `\n📁 *${cat}:*`;
        if (catAdded.length > 0) catHeader += ` 🟢 +${catAdded.length}`;
        if (notifyOnRemoved && catRemoved.length > 0) catHeader += ` 🔴 -${catRemoved.length}`;
        compText += `${catHeader}\n`;

        if (catAdded.length > 0) {
          const sampleAdded = catAdded.slice(0, 4);
          sampleAdded.forEach(item => {
            const u = typeof item === 'string' ? item : item.url;
            compText += `• <${u}|${u}>\n`;
          });
          if (catAdded.length > 4) {
            compText += `  _...and ${catAdded.length - 4} more_\n`;
          }
        }

        if (notifyOnRemoved && catRemoved.length > 0) {
          const sampleRemoved = catRemoved.slice(0, 3);
          sampleRemoved.forEach(item => {
            const u = typeof item === 'string' ? item : item.url;
            compText += `• ~<${u}|${u}>~\n`;
          });
          if (catRemoved.length > 3) {
            compText += `  _...and ${catRemoved.length - 3} more removed_\n`;
          }
        }
      }
    } else {
      // Fallback flat list
      if (addedCount > 0) {
        compText += `\n*✨ New Pages Added:*`;
        const displayedAdded = diff.added.slice(0, maxUrls);
        displayedAdded.forEach(item => {
          const u = typeof item === 'string' ? item : item.url;
          compText += `\n• <${u}|${u}>`;
        });
        if (addedCount > maxUrls) {
          compText += `\n  _...and ${addedCount - maxUrls} more new URLs_`;
        }
      }

      if (notifyOnRemoved && removedCount > 0) {
        compText += `\n\n*🗑️ Pages Removed:*`;
        const displayedRemoved = diff.removed.slice(0, maxUrls);
        displayedRemoved.forEach(item => {
          const u = typeof item === 'string' ? item : item.url;
          compText += `\n• ~<${u}|${u}>~`;
        });
        if (removedCount > maxUrls) {
          compText += `\n  _...and ${removedCount - maxUrls} more removed URLs_`;
        }
      }
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: compText
      }
    });

    blocks.push({ type: 'divider' });
  }

  // Baseline competitors
  if (baselineCompetitors.length > 0) {
    let baselineText = `*🌱 Initial Baselines Established:*\n`;
    for (const b of baselineCompetitors) {
      baselineText += `• *${b.competitor.name}*: Stored ${b.totalUrls.toLocaleString()} URLs snapshot. Tomorrow's check will alert on changes.\n`;
    }
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: baselineText
      }
    });
    blocks.push({ type: 'divider' });
  }

  // Context footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `🔍 Page Alerts by Antigravity SEO Tools | Comparing current crawl vs yesterday's snapshot`
      }
    ]
  });

  const payload = {
    text: `Page Alerts: ${totalAddedAll} new pages, ${totalRemovedAll} removed across ${results.length} competitors`,
    blocks
  };

  return await sendSlackWebhook(webhookUrl, payload);
}

module.exports = {
  sendSlackWebhook,
  sendTestNotification,
  sendDailySummaryNotification
};
