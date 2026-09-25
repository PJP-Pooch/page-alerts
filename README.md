# ⚡ PageAlerts - Competitor & Own Site XML Sitemap Change Monitor & Slack Alerts

A modern tool to track competitor and internal XML sitemaps daily, store previous versions/snapshots, analyze page additions & removals, and send alerts directly to Slack.

---

## 🌟 Features

- **Multi-Project Workspaces**: Organize monitored websites into dedicated projects (e.g., Client Brands, Competitor Sets, or Internal Websites).
- **Own Site vs Competitor Intelligence**:
  - 🎯 **Competitor Monitoring**: Catch new product launches, blog articles, and strategic moves the moment competitors publish them.
  - 🏠 **Own Site Monitoring**: Get notified if internal URLs accidentally drop, deindex, or new staging pages get inadvertently exposed.
- **Automated Daily Crawls & Diff Engine**: Automatically compares today's crawl against yesterday's snapshot.
- **Added & Removed Page Detection**: Pinpoints newly published URLs and dropped/deindexed URLs across all monitored websites.
- **Sitemap Index & Compression Support**: Recursively parses standard XML sitemaps, nested sitemap index files (`sitemap_index.xml`), and gzip-compressed sitemaps (`.xml.gz`).
- **Targeted Slack Block Kit Notifications**: Sends formatted summaries with site breakdowns, +Added / -Removed badges, and clickable page links. Supports global default webhooks and dedicated webhooks per project.
- **Google Workspace OAuth Protection**: Restricts web dashboard access to specified Google Workspace domain(s).
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

### 2. Set Up Projects & Workspaces
1. Click the **Projects** tab in the sidebar.
2. Manage default projects (e.g., *Pooch & Mutt (Competitors)*, *Pooch & Mutt (Own Sites)*) or click **Create Project**.
3. (Optional) Set a dedicated Slack webhook URL and channel for that specific project.

### 3. Add Monitored Sites
1. Click **Add Site** in the dashboard.
2. Assign the site to a project and select classification (🎯 *Competitor* or 🏠 *Own Site*).
3. Enter the site/brand name and XML sitemap URL (e.g., `https://competitor.com/sitemap.xml`).
4. Click **Test URL** to validate and inspect child sitemaps in real time.
5. Click **Save Site**.

### 4. Configure Slack & Scheduling
1. Go to the **Slack & Schedule** tab in the dashboard.
2. Set your default [Slack Incoming Webhook URL](https://api.slack.com/apps) and notification preferences.
3. Click **Send Test Slack Ping** to verify connectivity.
4. Click **Save Settings**.

### 5. Run Check & Establish Baseline
- Click **Run Check Now** to crawl all active sitemaps (or use the top project selector to check a specific project).
- The first crawl establishes the **initial baseline** snapshot.
- On subsequent daily crawls, any new pages added or removed will trigger a notification!

---

## 🖥️ Command-Line Interface (CLI)

You can also run checks and manage projects completely headless from the terminal or background scripts:

| Command | Description |
|---|---|
| `npm run check` | Crawl all active sitemaps, compute diffs against previous snapshots, and send Slack summary. |
| `node cli.js check --project <id>` | Crawl and diff only sites assigned to a specific project. |
| `npm run dry-run` | Crawl and compute diffs **without** sending Slack alerts. |
| `npm run projects` | List all configured Projects & Workspaces and site counts in terminal. |
| `npm run list` | Display all configured sites, project assignment, and status in terminal. |
| `node cli.js test-sitemap <url>` | Test and inspect any sitemap URL from the command line. |
| `node cli.js test-slack` | Send a test ping to your configured Slack webhook. |

---

## ⏰ Automated Scheduling

### Option A: In-App Scheduler (Default)
Keep `npm start` running in the background. In the **Slack & Schedule** tab, choose your preferred daily check time (e.g., 08:00 AM). The built-in scheduler will run the check and route Slack alerts every day.

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

All snapshots, project workspaces, and configurations are saved locally in the `data/` folder:
```
data/
├── projects.json             # Projects and workspaces configuration
├── competitors.json          # Monitored sites registry & project associations
├── settings.json             # Global Slack webhook & scheduler config
├── history.json              # Audit log of all crawl runs
└── snapshots/
    └── [site_id]/
        ├── latest.json       # Previous baseline snapshot
        └── [timestamp].json  # Historical snapshot records (last 30 retained)
```
