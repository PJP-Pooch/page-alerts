# ⚡ PageAlerts - Competitor XML Sitemap Change Monitor & Slack Alerts

A modern tool to track competitor XML sitemaps daily, store previous versions/snapshots, analyze page additions & removals, and send alerts directly to Slack.

---

## 🌟 Features

- **Automated Daily Crawls & Diff Engine**: Automatically compares today's crawl against yesterday's snapshot.
- **Added & Removed Page Detection**: Pinpoints newly published URLs and dropped/deindexed URLs across all competitors.
- **Sitemap Index & Compression Support**: Recursively parses standard XML sitemaps, nested sitemap index files (`sitemap_index.xml`), and gzip-compressed sitemaps (`.xml.gz`).
- **Slack Block Kit Notifications**: Sends formatted summaries with competitor breakdowns, +Added / -Removed badges, and clickable page links.
- **Premium Glassmorphic Dashboard**: Dark mode UI built with Inter typography, visual diff explorer, copy-to-clipboard, and CSV export.
- **Dual Execution Modes**:
  - **Interactive Web App**: Real-time dashboard at `http://localhost:3456`.
  - **Headless CLI**: Run unattended via Windows Task Scheduler or cron (`npm run check`).

---

## 🚀 Quick Start

### 1. Launch the Web Dashboard
```bash
npm start
```
Then open [http://localhost:3456](http://localhost:3456) in your browser.

### 2. Configure Slack Webhook
1. Go to the **Slack & Schedule** tab in the dashboard.
2. Paste your [Slack Incoming Webhook URL](https://api.slack.com/apps).
3. Click **Send Test Slack Ping** to verify connectivity.
4. Click **Save Settings**.

### 3. Add Competitors
1. Click **Add Competitor** in the dashboard.
2. Enter the competitor's name and their XML sitemap URL (e.g., `https://competitor.com/sitemap.xml`).
3. Click **Test URL** to validate and inspect child sitemaps.
4. Click **Save Competitor**.

### 4. Run Check & Establish Baseline
- Click **Run Check Now** to crawl all active sitemaps.
- The first crawl establishes the **initial baseline** snapshot.
- On subsequent daily crawls, any new pages added or removed will trigger an alert!

---

## 🖥️ Command-Line Interface (CLI)

You can also run checks completely headless from the terminal or background scripts:

| Command | Description |
|---|---|
| `npm run check` | Crawl all competitor sitemaps, compute diffs against previous snapshots, and send Slack summary. |
| `npm run dry-run` | Crawl and compute diffs **without** sending Slack alerts. |
| `npm run list` | Display all configured competitors and their status in terminal. |
| `node cli.js test-sitemap <url>` | Test and inspect any sitemap URL from the command line. |
| `node cli.js test-slack` | Send a test ping to your configured Slack webhook. |

---

## ⏰ Automated Scheduling

### Option A: In-App Scheduler (Default)
Keep `npm start` running in the background. In the **Slack & Schedule** tab, choose your preferred daily check time (e.g., 08:00 AM). The built-in scheduler will run the check and send Slack alerts every day.

### Option B: Windows Task Scheduler (Unattended)
To run PageAlerts daily without keeping a browser open:
1. Open Windows **Task Scheduler** (`taskschd.msc`).
2. Create a Basic Task named **PageAlerts Daily Check**.
3. Set the trigger to **Daily** at your preferred time (e.g. 08:00 AM).
4. Set Action to **Start a program**:
   - **Program/script**: `node.exe` (or full path `C:\Program Files\nodejs\node.exe`)
   - **Add arguments**: `cli.js check`
   - **Start in**: `c:\Users\phill\OneDrive\Desktop\SEO Tools\Page Alerts`

---

## 📁 Data Storage Structure

All snapshots and configurations are saved locally in the `data/` folder:
```
data/
├── competitors.json          # Monitored competitors registry
├── settings.json             # Slack webhook & scheduler config
├── history.json              # Audit log of all crawl runs
└── snapshots/
    └── [competitor_id]/
        ├── latest.json       # Yesterday's snapshot
        └── [timestamp].json  # Historical snapshot records (last 30 retained)
```
