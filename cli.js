#!/usr/bin/env node

const storage = require('./lib/storage');
const runner = require('./lib/runner');
const sitemapParser = require('./lib/sitemapParser');
const slackNotifier = require('./lib/slackNotifier');

const args = process.argv.slice(2);
const command = args[0] || 'help';

async function main() {
  switch (command) {
    case 'check': {
      const dryRun = args.includes('--dry-run') || args.includes('-d');
      console.log(`\n🔍 Running Competitor Sitemap Check (Slack notification: ${dryRun ? 'DISABLED (Dry Run)' : 'ENABLED'})...`);

      const result = await runner.runCheck({
        trigger: 'cli',
        sendSlack: !dryRun
      });

      console.log('\n================ CHECK SUMMARY ================');
      console.log(`Competitors Checked: ${result.competitorsChecked}`);
      console.log(`Total New Pages Added:   +${result.totalAdded}`);
      console.log(`Total Pages Removed:     -${result.totalRemoved}`);
      console.log(`Duration:                ${(result.durationMs / 1000).toFixed(2)}s`);
      console.log(`Slack Notification:      ${result.slackSent ? 'Sent ✅' : (result.slackError ? `Failed ❌ (${result.slackError})` : 'Skipped / Not configured')}`);
      console.log('================================================\n');

      if (result.results && result.results.length > 0) {
        for (const r of result.results) {
          console.log(`• ${r.competitor.name}: ${r.totalUrls} URLs | +${r.diff?.added?.length || 0} Added | -${r.diff?.removed?.length || 0} Removed`);
          if (r.diff?.added?.length > 0) {
            console.log('   New Added URLs:');
            r.diff.added.slice(0, 5).forEach(u => console.log(`     + ${u}`));
            if (r.diff.added.length > 5) console.log(`     ... and ${r.diff.added.length - 5} more`);
          }
          if (r.diff?.removed?.length > 0) {
            console.log('   Removed URLs:');
            r.diff.removed.slice(0, 5).forEach(u => console.log(`     - ${u}`));
            if (r.diff.removed.length > 5) console.log(`     ... and ${r.diff.removed.length - 5} more`);
          }
        }
      }
      break;
    }

    case 'list': {
      const competitors = await storage.getCompetitors();
      console.log(`\n📋 Monitored Competitors (${competitors.length}):\n`);
      if (competitors.length === 0) {
        console.log('No competitors configured yet. Add them in the Web UI or via CLI.');
      } else {
        competitors.forEach((c, idx) => {
          console.log(`${idx + 1}. [${c.active ? 'ACTIVE' : 'PAUSED'}] ${c.name}`);
          console.log(`   Sitemap:    ${c.sitemapUrl}`);
          console.log(`   Total URLs: ${c.totalUrls || 0}`);
          console.log(`   Last Check: ${c.lastCheck ? new Date(c.lastCheck).toLocaleString() : 'Never'}`);
          if (c.lastDiff) {
            console.log(`   Last Diff:  +${c.lastDiff.added?.length || 0} / -${c.lastDiff.removed?.length || 0}`);
          }
          console.log('');
        });
      }
      break;
    }

    case 'test-sitemap': {
      const url = args[1];
      if (!url) {
        console.error('Error: Please provide a sitemap URL. Example: node cli.js test-sitemap https://example.com/sitemap.xml');
        process.exit(1);
      }
      console.log(`\n🔍 Inspecting sitemap: ${url}...`);
      const settings = await storage.getSettings();
      try {
        const info = await sitemapParser.inspectSitemap(url, settings.userAgent);
        console.log('\n✅ Sitemap valid!');
        console.log(`Type: ${info.type}`);
        if (info.type === 'sitemapindex') {
          console.log(`Child sitemaps count: ${info.childSitemapsCount}`);
          console.log('Sample child sitemaps:');
          info.sampleChildSitemaps.forEach(s => console.log(` - ${s.loc}`));
        } else {
          console.log(`Total URLs found: ${info.totalUrlsFound}`);
          console.log('Sample URLs:');
          info.sampleUrls.forEach(u => console.log(` - ${u}`));
        }
      } catch (err) {
        console.error('❌ Sitemap inspection failed:', err.message);
      }
      break;
    }

    case 'test-slack': {
      const settings = await storage.getSettings();
      if (!settings.slackWebhookUrl) {
        console.error('❌ No Slack Webhook URL found in settings. Configure it in the Web UI or in data/settings.json');
        process.exit(1);
      }
      console.log(`\n🔔 Sending test notification to Slack webhook...`);
      try {
        await slackNotifier.sendTestNotification(settings.slackWebhookUrl, settings.slackChannel);
        console.log('✅ Test alert sent successfully! Check your Slack channel.');
      } catch (err) {
        console.error('❌ Failed to send Slack alert:', err.message);
      }
      break;
    }

    case 'help':
    default: {
      console.log(`
Competitor Sitemap Page Alerts - CLI
-------------------------------------
Usage:
  node cli.js check              Run full crawl & diff analysis on all active competitors and send Slack alert
  node cli.js check --dry-run    Run check and diff analysis WITHOUT sending Slack alerts
  node cli.js list               List all monitored competitors and status
  node cli.js test-sitemap <url> Test & validate an XML sitemap or sitemap index URL
  node cli.js test-slack         Send a test message to your configured Slack webhook
  node server.js                 Start the Web Dashboard and scheduler (default: http://localhost:3456)
`);
      break;
    }
  }
}

main().catch(err => {
  console.error('CLI Fatal Error:', err);
  process.exit(1);
});
