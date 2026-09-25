/**
 * PageAlerts - Frontend Application Logic
 */

// State
let state = {
  stats: null,
  projects: [],
  currentProjectId: 'all',
  competitors: [],
  settings: null,
  activeTab: 'tab-dashboard',
  currentDiffData: null,
  currentDiffFilter: 'all',
  currentDiffSearch: ''
};

// DOM Elements
const elements = {
  // Navigation & Header
  navItems: document.querySelectorAll('.nav-item'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  pageTitle: document.getElementById('page-title'),
  pageSubtitle: document.getElementById('page-subtitle'),
  headerProjectSelect: document.getElementById('header-project-select'),
  sidebarCompCount: document.getElementById('sidebar-comp-count'),
  sidebarProjCount: document.getElementById('sidebar-proj-count'),
  schedulerBadgeText: document.getElementById('scheduler-badge-text'),

  // Top Actions
  btnRunAllCheck: document.getElementById('btn-run-all-check'),
  btnRunAllText: document.getElementById('btn-run-all-text'),
  btnQuickInspect: document.getElementById('btn-quick-inspect'),

  // Dashboard Stats
  statTotalCompetitors: document.getElementById('stat-total-competitors'),
  statActiveCompetitors: document.getElementById('stat-active-competitors'),
  statTotalUrls: document.getElementById('stat-total-urls'),
  statAddedToday: document.getElementById('stat-added-today'),
  statRemovedToday: document.getElementById('stat-removed-today'),
  slackMissingBanner: document.getElementById('slack-missing-banner'),
  btnBannerSlackSettings: document.getElementById('btn-banner-slack-settings'),
  dashCompetitorsTbody: document.getElementById('dash-competitors-tbody'),
  btnDashAddComp: document.getElementById('btn-dash-add-comp'),

  // Projects Tab
  projectsTbody: document.getElementById('projects-tbody'),
  btnOpenAddProjectModal: document.getElementById('btn-open-add-project-modal'),

  // Project Modal
  modalProject: document.getElementById('modal-project'),
  modalProjectTitle: document.getElementById('modal-project-title'),
  projectForm: document.getElementById('project-form'),
  projectIdInput: document.getElementById('project-id'),
  projectNameInput: document.getElementById('project-name'),
  projectTypeInput: document.getElementById('project-type'),
  projectDescriptionInput: document.getElementById('project-description'),
  projectSlackWebhookInput: document.getElementById('project-slack-webhook'),
  projectSlackChannelInput: document.getElementById('project-slack-channel'),
  btnCloseProjectModal: document.getElementById('btn-close-project-modal'),
  btnCancelProjectModal: document.getElementById('btn-cancel-project-modal'),

  // Competitors Tab
  competitorsTbody: document.getElementById('competitors-tbody'),
  btnOpenAddCompModal: document.getElementById('btn-open-add-comp-modal'),

  // Competitor Modal
  modalCompetitor: document.getElementById('modal-competitor'),
  modalCompTitle: document.getElementById('modal-comp-title'),
  competitorForm: document.getElementById('competitor-form'),
  compId: document.getElementById('comp-id'),
  compProjectId: document.getElementById('comp-project-id'),
  compSiteType: document.getElementById('comp-site-type'),
  compName: document.getElementById('comp-name'),
  compSitemapUrl: document.getElementById('comp-sitemap-url'),
  compTags: document.getElementById('comp-tags'),
  compActive: document.getElementById('comp-active'),
  btnModalTestSitemap: document.getElementById('btn-modal-test-sitemap'),
  modalSitemapTestResult: document.getElementById('modal-sitemap-test-result'),
  btnCloseCompModal: document.getElementById('btn-close-comp-modal'),
  btnCancelCompModal: document.getElementById('btn-cancel-comp-modal'),

  // Diff Explorer Tab
  diffSelectCompetitor: document.getElementById('diff-select-competitor'),
  diffSelectCategory: document.getElementById('diff-select-category'),
  diffSelectSnapA: document.getElementById('diff-select-snap-a'),
  diffSelectSnapB: document.getElementById('diff-select-snap-b'),
  btnFetchDiff: document.getElementById('btn-fetch-diff'),
  diffTotalUrls: document.getElementById('diff-total-urls'),
  diffAddedCount: document.getElementById('diff-added-count'),
  diffRemovedCount: document.getElementById('diff-removed-count'),
  btnCopyAddedUrls: document.getElementById('btn-copy-added-urls'),
  btnExportDiffCsv: document.getElementById('btn-export-diff-csv'),
  diffFilterTabs: document.querySelectorAll('.filter-tab'),
  diffSearchInput: document.getElementById('diff-search-input'),
  diffUrlsContainer: document.getElementById('diff-urls-container'),
  countFilterAll: document.getElementById('count-filter-all'),
  countFilterAdded: document.getElementById('count-filter-added'),
  countFilterRemoved: document.getElementById('count-filter-removed'),

  // History Tab
  historyTbody: document.getElementById('history-tbody'),
  btnRefreshHistory: document.getElementById('btn-refresh-history'),

  // Settings Tab
  slackSettingsForm: document.getElementById('slack-settings-form'),
  slackScopeBanner: document.getElementById('slack-scope-banner'),
  scheduleScopeBanner: document.getElementById('schedule-scope-banner'),
  btnSaveSlack: document.getElementById('btn-save-slack'),
  slackWebhookUrl: document.getElementById('slack-webhook-url'),
  btnToggleWebhookVis: document.getElementById('btn-toggle-webhook-vis'),
  slackChannel: document.getElementById('slack-channel'),
  slackNotifyOnlyChanges: document.getElementById('slack-notify-only-changes'),
  slackNotifyRemoved: document.getElementById('slack-notify-removed'),
  slackMaxUrls: document.getElementById('slack-max-urls'),
  btnTestSlack: document.getElementById('btn-test-slack'),

  crawlerSettingsForm: document.getElementById('crawler-settings-form'),
  scheduleEnabled: document.getElementById('schedule-enabled'),
  scheduleHour: document.getElementById('schedule-hour'),
  scheduleMinute: document.getElementById('schedule-minute'),
  crawlerUserAgent: document.getElementById('crawler-user-agent'),

  // Inspect Modal
  modalInspect: document.getElementById('modal-inspect'),
  btnCloseInspectModal: document.getElementById('btn-close-inspect-modal'),
  btnCancelInspectModal: document.getElementById('btn-cancel-inspect-modal'),
  inspectUrlInput: document.getElementById('inspect-url-input'),
  btnRunInspect: document.getElementById('btn-run-inspect'),
  inspectResultsView: document.getElementById('inspect-results-view'),

  // Toasts
  toastContainer: document.getElementById('toast-container')
};

// ================= Utility Functions =================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';

  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatDate(isoStr) {
  if (!isoStr) return 'Never';
  const d = new Date(isoStr);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();

    const authOverlay = document.getElementById('auth-overlay');
    const sidebarUserBox = document.getElementById('sidebar-user-box');
    const authDomainMsg = document.getElementById('auth-domain-msg');

    if (data.allowedDomain && authDomainMsg) {
      const domains = data.allowedDomain.split(',').map(d => '@' + d.trim().replace(/^@/, ''));
      authDomainMsg.textContent = `Sign in with your ${domains.join(' or ')} Google Workspace account to access competitor change alerts.`;
    }

    if (data.authConfigured && !data.authenticated) {
      // Show Google login overlay
      if (authOverlay) authOverlay.style.display = 'flex';
      if (sidebarUserBox) sidebarUserBox.style.display = 'none';
      return false;
    } else {
      if (authOverlay) authOverlay.style.display = 'none';
      if (data.authenticated && data.user && sidebarUserBox) {
        sidebarUserBox.style.display = 'flex';
        document.getElementById('user-name').textContent = data.user.name || 'User';
        document.getElementById('user-email').textContent = data.user.email || '';

        const avatarImg = document.getElementById('user-avatar');
        const avatarInitials = document.getElementById('user-avatar-initials');
        if (data.user.picture) {
          avatarImg.src = data.user.picture;
          avatarImg.style.display = 'block';
          avatarInitials.style.display = 'none';
        } else {
          avatarImg.style.display = 'none';
          avatarInitials.style.display = 'flex';
          avatarInitials.textContent = (data.user.name || 'U').charAt(0).toUpperCase();
        }
      }
      return true;
    }
  } catch (err) {
    console.warn('Auth check error:', err);
    return true;
  }
}

// ================= Initialization =================

async function init() {
  populateHoursDropdown();
  setupNavigation();
  setupModals();
  setupEventListeners();

  const isAuthed = await checkAuthStatus();
  if (!isAuthed) return;

  await loadProjects();
  await Promise.all([
    loadStats(),
    loadCompetitors(),
    loadSettings()
  ]);

  // Periodic status poll every 20 seconds
  setInterval(loadStats, 20000);
}

function populateHoursDropdown() {
  elements.scheduleHour.innerHTML = '';
  for (let i = 0; i < 24; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${String(i).padStart(2, '0')}:00 (${i < 12 ? (i === 0 ? 12 : i) + ' AM' : (i === 12 ? 12 : i - 12) + ' PM'})`;
    elements.scheduleHour.appendChild(opt);
  }
}

function setupNavigation() {
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  elements.btnBannerSlackSettings.addEventListener('click', () => {
    switchTab('tab-settings');
  });

  elements.btnDashAddComp.addEventListener('click', () => {
    openCompetitorModal();
  });

  elements.btnOpenAddCompModal.addEventListener('click', () => {
    openCompetitorModal();
  });

  elements.btnOpenAddProjectModal?.addEventListener('click', () => {
    openProjectModal();
  });

  // Header project filter selector
  elements.headerProjectSelect?.addEventListener('change', async () => {
    state.currentProjectId = elements.headerProjectSelect.value;
    await Promise.all([loadStats(), loadCompetitors()]);

    if (state.activeTab === 'tab-projects') {
      renderProjectsTable(state.projects);
    } else if (state.activeTab === 'tab-diff') {
      await setupDiffExplorer();
    } else if (state.activeTab === 'tab-history') {
      await loadHistory();
    } else if (state.activeTab === 'tab-settings') {
      await loadSettings();
    }
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;

  elements.navItems.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  elements.tabPanes.forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  // Update header text and sync tab data
  if (tabId === 'tab-dashboard') {
    elements.pageTitle.textContent = 'Dashboard Overview';
    elements.pageSubtitle.textContent = 'Tracking new & removed pages across competitor & internal sitemaps';
    loadStats();
    loadCompetitors();
  } else if (tabId === 'tab-projects') {
    elements.pageTitle.textContent = 'Projects & Workspaces';
    elements.pageSubtitle.textContent = 'Organize monitored sites into client websites or own internal sites';
    loadProjects();
  } else if (tabId === 'tab-competitors') {
    elements.pageTitle.textContent = 'Monitored Sites';
    elements.pageSubtitle.textContent = 'Add, inspect, and configure competitor & own XML sitemaps to monitor';
    loadCompetitors();
  } else if (tabId === 'tab-diff') {
    elements.pageTitle.textContent = 'Changes & Diffs Explorer';
    elements.pageSubtitle.textContent = 'Analyze newly published and removed sitemap URLs';
    setupDiffExplorer();
  } else if (tabId === 'tab-history') {
    elements.pageTitle.textContent = 'Crawl History & Audit';
    elements.pageSubtitle.textContent = 'Logs of automated daily checks and Slack alerts';
    loadHistory();
  } else if (tabId === 'tab-settings') {
    elements.pageTitle.textContent = 'Slack & Scheduler Settings';
    elements.pageSubtitle.textContent = 'Configure Slack alerts, crawl frequency, and bot options';
    loadSettings();
  }
}

// ================= API Calls & Data Loaders =================

async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    const projects = await res.json();
    state.projects = projects;

    if (elements.sidebarProjCount) {
      elements.sidebarProjCount.textContent = projects.length;
    }

    // Populate header project selector
    const currentVal = state.currentProjectId || 'all';
    elements.headerProjectSelect.innerHTML = '<option value="all">🌐 All Projects</option>';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      const icon = p.type === 'own_site' ? '🏠' : '🎯';
      opt.textContent = `${icon} ${p.name}`;
      if (p.id === currentVal) opt.selected = true;
      elements.headerProjectSelect.appendChild(opt);
    });

    // Populate comp modal project dropdown
    if (elements.compProjectId) {
      elements.compProjectId.innerHTML = '';
      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        const icon = p.type === 'own_site' ? '🏠' : '🎯';
        opt.textContent = `${icon} ${p.name}`;
        elements.compProjectId.appendChild(opt);
      });
    }

    renderProjectsTable(projects);
  } catch (err) {
    console.error('Failed to load projects:', err);
  }
}

function renderProjectsTable(projects) {
  if (!elements.projectsTbody) return;

  if (projects.length === 0) {
    elements.projectsTbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center empty-state">No projects created yet. Click "Create Project" above!</td>
      </tr>
    `;
    return;
  }

  let html = '';
  projects.forEach(p => {
    const isOwn = p.type === 'own_site';
    const typeBadge = isOwn
      ? '<span class="pill pill-cyan">🏠 Own Site</span>'
      : '<span class="pill pill-purple">🎯 Competitor</span>';

    const sitesCount = state.competitors.filter(c => c.projectId === p.id).length;
    const slackRouting = p.slackWebhookUrl
      ? `<span class="pill pill-green" title="${escapeHtml(p.slackChannel || 'Custom Webhook')}">Dedicated Slack ✅</span>`
      : '<span class="pill pill-gray">Global Default</span>';

    html += `
      <tr>
        <td>${typeBadge}</td>
        <td>
          <strong>${escapeHtml(p.name)}</strong>
          ${state.currentProjectId === p.id ? '<span class="pill pill-cyan" style="margin-left: 6px;">Active Filter</span>' : ''}
        </td>
        <td>${escapeHtml(p.description || '-')}</td>
        <td>
          <strong>${sitesCount}</strong> site(s)
          <button class="btn btn-secondary btn-xs btn-filter-project" data-id="${p.id}" style="margin-left: 8px;">View Sites</button>
        </td>
        <td>${slackRouting}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-xs btn-edit-project" data-id="${p.id}" title="Edit project">Edit</button>
            <button class="btn btn-danger-outline btn-xs btn-delete-project" data-id="${p.id}" title="Delete project">Delete</button>
          </div>
        </td>
      </tr>
    `;
  });

  elements.projectsTbody.innerHTML = html;

  elements.projectsTbody.querySelectorAll('.btn-filter-project').forEach(btn => {
    btn.addEventListener('click', () => {
      const pId = btn.getAttribute('data-id');
      elements.headerProjectSelect.value = pId;
      state.currentProjectId = pId;
      switchTab('tab-competitors');
      loadStats();
      loadCompetitors();
    });
  });

  elements.projectsTbody.querySelectorAll('.btn-edit-project').forEach(btn => {
    btn.addEventListener('click', () => {
      const pId = btn.getAttribute('data-id');
      const proj = state.projects.find(p => p.id === pId);
      if (proj) openProjectModal(proj);
    });
  });

  elements.projectsTbody.querySelectorAll('.btn-delete-project').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteProject(btn.getAttribute('data-id'));
    });
  });
}

async function loadStats() {
  try {
    const q = state.currentProjectId && state.currentProjectId !== 'all' ? `?projectId=${encodeURIComponent(state.currentProjectId)}` : '';
    const res = await fetch(`/api/stats${q}`);
    const data = await res.json();
    state.stats = data;

    elements.statTotalCompetitors.textContent = data.totalCompetitors;
    elements.statActiveCompetitors.textContent = `${data.activeCompetitors} Active`;
    elements.statTotalUrls.textContent = data.totalUrls.toLocaleString();
    elements.statAddedToday.textContent = `+${data.totalAddedToday}`;
    elements.statRemovedToday.textContent = `-${data.totalRemovedToday}`;
    elements.sidebarCompCount.textContent = data.totalCompetitors;

    // Slack missing banner
    elements.slackMissingBanner.style.display = data.slackConfigured ? 'none' : 'flex';

    // Scheduler badge
    if (data.scheduler?.enabled) {
      const h = String(data.scheduler.hour).padStart(2, '0');
      const m = String(data.scheduler.minute).padStart(2, '0');
      elements.schedulerBadgeText.textContent = `Daily @ ${h}:${m}`;
    } else {
      elements.schedulerBadgeText.textContent = 'Disabled';
    }

    // Check button state
    if (data.isCheckRunning) {
      elements.btnRunAllCheck.disabled = true;
      elements.btnRunAllText.textContent = 'Crawl in progress...';
    } else {
      elements.btnRunAllCheck.disabled = false;
      elements.btnRunAllText.textContent = 'Run Check Now';
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

async function loadCompetitors() {
  try {
    const q = state.currentProjectId && state.currentProjectId !== 'all' ? `?projectId=${encodeURIComponent(state.currentProjectId)}` : '';
    const res = await fetch(`/api/competitors${q}`);
    const competitors = await res.json();
    state.competitors = competitors;

    renderDashboardCompetitors(competitors);
    renderCompetitorsList(competitors);
    elements.sidebarCompCount.textContent = competitors.length;
    if (state.activeTab === 'tab-projects') {
      renderProjectsTable(state.projects);
    }
  } catch (err) {
    console.error('Failed to load competitors:', err);
  }
}

function renderDashboardCompetitors(competitors) {
  if (competitors.length === 0) {
    elements.dashCompetitorsTbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center empty-state">
          No sites found for this view. Click <strong>"Add Site"</strong> to start tracking sitemaps.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  competitors.forEach(c => {
    let diffBadge = '<span class="pill pill-gray">No Diff Yet</span>';
    if (c.lastDiff) {
      const add = c.lastDiff.added?.length || 0;
      const rem = c.lastDiff.removed?.length || 0;
      if (c.lastDiff.isFirstRun) {
        diffBadge = `<span class="pill pill-cyan">🌱 Baseline (${c.totalUrls.toLocaleString()})</span>`;
      } else if (add > 0 || rem > 0) {
        diffBadge = `
          <span class="pill pill-green">+${add}</span>
          <span class="pill pill-red">-${rem}</span>
        `;
      } else {
        diffBadge = '<span class="pill pill-gray">0 Changes</span>';
      }
    }

    const compProj = state.projects.find(p => p.id === c.projectId);
    const isOwn = c.siteType === 'own_site' || compProj?.type === 'own_site';
    const typeBadge = isOwn
      ? '<span class="pill pill-cyan">🏠 Own</span>'
      : '';
    const projLabel = compProj ? `<span class="pill pill-gray" style="font-size: 0.7rem;">📁 ${escapeHtml(compProj.name)}</span>` : '';

    html += `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            ${typeBadge}
            ${projLabel}
            <strong>${escapeHtml(c.name)}</strong>
            ${c.active === false ? '<span class="pill pill-gray" style="margin-left: 6px;">Paused</span>' : ''}
          </div>
        </td>
        <td>
          <a href="${escapeHtml(c.sitemapUrl)}" target="_blank" rel="noopener">
            ${escapeHtml(c.sitemapUrl.length > 40 ? c.sitemapUrl.slice(0, 40) + '...' : c.sitemapUrl)}
          </a>
        </td>
        <td><strong>${(c.totalUrls || 0).toLocaleString()}</strong></td>
        <td>${diffBadge}</td>
        <td>${formatDate(c.lastCheck)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-xs btn-check-single" data-id="${c.id}" title="Run crawl now">
              Check
            </button>
            <button class="btn btn-secondary btn-xs btn-view-diff-shortcut" data-id="${c.id}" title="View diff">
              Diff
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  elements.dashCompetitorsTbody.innerHTML = html;

  // Bind inline action buttons
  elements.dashCompetitorsTbody.querySelectorAll('.btn-check-single').forEach(btn => {
    btn.addEventListener('click', () => runSingleCheck(btn.getAttribute('data-id')));
  });
  elements.dashCompetitorsTbody.querySelectorAll('.btn-view-diff-shortcut').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab('tab-diff');
      elements.diffSelectCompetitor.value = btn.getAttribute('data-id');
      loadCompetitorSnapshots(btn.getAttribute('data-id'));
    });
  });
}

function renderCompetitorsList(competitors) {
  if (competitors.length === 0) {
    elements.competitorsTbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center empty-state">
          No sites configured in this project view yet. Add your first XML sitemap above!
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  competitors.forEach(c => {
    let diffBadge = '<span class="pill pill-gray">No Diff</span>';
    if (c.lastDiff) {
      const add = c.lastDiff.added?.length || 0;
      const rem = c.lastDiff.removed?.length || 0;
      if (c.lastDiff.isFirstRun) {
        diffBadge = `<span class="pill pill-cyan">🌱 Baseline</span>`;
      } else if (add > 0 || rem > 0) {
        diffBadge = `
          <span class="pill pill-green">+${add}</span>
          <span class="pill pill-red">-${rem}</span>
        `;
      } else {
        diffBadge = '<span class="pill pill-gray">0 Changes</span>';
      }
    }

    const tagsHtml = (c.tags || []).map(t => `<span class="pill pill-gray">${escapeHtml(t)}</span>`).join(' ');
    const compProj = state.projects.find(p => p.id === c.projectId);
    const isOwn = c.siteType === 'own_site' || compProj?.type === 'own_site';
    const projLabel = compProj ? `<span class="pill pill-gray" style="margin-top: 4px; display: inline-flex;">📁 ${escapeHtml(compProj.name)}</span>` : '';

    html += `
      <tr>
        <td>
          <span class="pill ${c.active !== false ? 'pill-green' : 'pill-gray'}">
            ${c.active !== false ? 'Active' : 'Paused'}
          </span>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <strong>${escapeHtml(c.name)}</strong>
            ${isOwn ? '<span class="pill pill-cyan" style="font-size: 0.72rem; padding: 2px 7px;">🏠 Own Site</span>' : ''}
          </div>
          ${projLabel ? `<div>${projLabel}</div>` : ''}
        </td>
        <td>
          <a href="${escapeHtml(c.sitemapUrl)}" target="_blank" rel="noopener" title="${escapeHtml(c.sitemapUrl)}">
            ${escapeHtml(c.sitemapUrl)}
          </a>
        </td>
        <td>${tagsHtml || '-'}</td>
        <td><strong>${(c.totalUrls || 0).toLocaleString()}</strong></td>
        <td>${diffBadge}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-xs btn-check-single" data-id="${c.id}" title="Run immediate check">
              Check
            </button>
            <button class="btn btn-secondary btn-xs btn-inspect-comp" data-url="${escapeHtml(c.sitemapUrl)}" title="Inspect sitemap">
              Inspect
            </button>
            <button class="btn btn-secondary btn-xs btn-edit-comp" data-id="${c.id}" title="Edit competitor">
              Edit
            </button>
            <button class="btn btn-danger-outline btn-xs btn-delete-comp" data-id="${c.id}" title="Delete competitor">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  elements.competitorsTbody.innerHTML = html;

  // Bind competitor table buttons
  elements.competitorsTbody.querySelectorAll('.btn-check-single').forEach(btn => {
    btn.addEventListener('click', () => runSingleCheck(btn.getAttribute('data-id')));
  });
  elements.competitorsTbody.querySelectorAll('.btn-inspect-comp').forEach(btn => {
    btn.addEventListener('click', () => openInspectModal(btn.getAttribute('data-url')));
  });
  elements.competitorsTbody.querySelectorAll('.btn-edit-comp').forEach(btn => {
    btn.addEventListener('click', () => editCompetitor(btn.getAttribute('data-id')));
  });
  elements.competitorsTbody.querySelectorAll('.btn-delete-comp').forEach(btn => {
    btn.addEventListener('click', () => deleteCompetitor(btn.getAttribute('data-id')));
  });
}

// ================= Diff Explorer Tab Logic =================

async function setupDiffExplorer() {
  elements.diffSelectCompetitor.innerHTML = '';

  let comps = state.competitors;
  if (state.currentProjectId && state.currentProjectId !== 'all') {
    comps = comps.filter(c => c.projectId === state.currentProjectId);
  }

  if (comps.length === 0) {
    const curProj = state.projects.find(p => p.id === state.currentProjectId);
    const emptyMsg = curProj 
      ? `No monitored sites in project "${escapeHtml(curProj.name)}"` 
      : 'No competitors available';
    elements.diffSelectCompetitor.innerHTML = `<option value="">${emptyMsg}</option>`;
    elements.diffUrlsContainer.innerHTML = `<div class="empty-state">${emptyMsg}. Select another project or add a sitemap.</div>`;
    elements.diffTotalUrls.textContent = '0';
    elements.diffAddedCount.textContent = '+0';
    elements.diffRemovedCount.textContent = '-0';
    elements.countFilterAll.textContent = '0';
    elements.countFilterAdded.textContent = '0';
    elements.countFilterRemoved.textContent = '0';
    elements.diffSelectSnapA.innerHTML = '<option value="">No snapshots</option>';
    elements.diffSelectSnapB.innerHTML = '<option value="">No snapshots</option>';
    return;
  }

  const prevCompId = elements.diffSelectCompetitor.value;
  comps.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.totalUrls || 0} URLs)`;
    elements.diffSelectCompetitor.appendChild(opt);
  });

  const selectedCompId = comps.some(c => c.id === prevCompId) ? prevCompId : comps[0].id;
  elements.diffSelectCompetitor.value = selectedCompId;
  await loadCompetitorSnapshots(selectedCompId);
}

async function loadCompetitorSnapshots(competitorId) {
  if (!competitorId) return;

  try {
    const res = await fetch(`/api/competitors/${competitorId}/snapshots`);
    const snapshots = await res.json();

    elements.diffSelectSnapA.innerHTML = '<option value="latest">Latest Snapshot (Current)</option>';
    elements.diffSelectSnapB.innerHTML = '<option value="previous">Previous Snapshot (Yesterday / Baseline)</option>';

    snapshots.forEach((snap, idx) => {
      const dateText = formatDate(snap.createdAt);

      const optA = document.createElement('option');
      optA.value = snap.filename;
      optA.textContent = `${dateText} (${snap.filename})`;
      elements.diffSelectSnapA.appendChild(optA);

      const optB = document.createElement('option');
      optB.value = snap.filename;
      optB.textContent = `${dateText} (${snap.filename})`;
      if (idx === 1) optB.selected = true;
      elements.diffSelectSnapB.appendChild(optB);
    });

    await fetchAndRenderDiff(competitorId, elements.diffSelectSnapA.value, elements.diffSelectSnapB.value);
  } catch (err) {
    console.error('Failed to load snapshots:', err);
  }
}

async function fetchAndRenderDiff(compId, snapA, snapB) {
  elements.diffUrlsContainer.innerHTML = '<div class="empty-state">Computing difference...</div>';

  try {
    const url = `/api/competitors/${compId}/diff?snapA=${encodeURIComponent(snapA)}&snapB=${encodeURIComponent(snapB)}`;
    const res = await fetch(url);
    const data = await res.json();
    state.currentDiffData = data;

    const diff = data.diff;
    const addedCount = diff.added?.length || 0;
    const removedCount = diff.removed?.length || 0;
    const totalCurrent = data.currentSnapshotMeta?.totalUrls || 0;

    elements.diffTotalUrls.textContent = totalCurrent.toLocaleString();
    elements.diffAddedCount.textContent = `+${addedCount}`;
    elements.diffRemovedCount.textContent = `-${removedCount}`;

    elements.countFilterAll.textContent = addedCount + removedCount;
    elements.countFilterAdded.textContent = addedCount;
    elements.countFilterRemoved.textContent = removedCount;

    // Populate category dropdown
    const categories = new Set();
    if (diff.added) {
      diff.added.forEach(item => {
        if (typeof item === 'object' && item.category) categories.add(item.category);
      });
    }
    if (diff.removed) {
      diff.removed.forEach(item => {
        if (typeof item === 'object' && item.category) categories.add(item.category);
      });
    }

    elements.diffSelectCategory.innerHTML = '<option value="all">All Page Types</option>';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      elements.diffSelectCategory.appendChild(opt);
    });

    renderDiffList();
  } catch (err) {
    console.error('Failed to fetch diff:', err);
    elements.diffUrlsContainer.innerHTML = `<div class="empty-state text-red">Error calculating diff: ${err.message}</div>`;
  }
}

function renderDiffList() {
  if (!state.currentDiffData || !state.currentDiffData.diff) {
    elements.diffUrlsContainer.innerHTML = '<div class="empty-state">No diff data loaded.</div>';
    return;
  }

  const diff = state.currentDiffData.diff;
  if (diff.isFirstRun) {
    elements.diffUrlsContainer.innerHTML = `
      <div class="empty-state">
        🌱 <strong>Initial Baseline Snapshot</strong><br>
        All ${state.currentDiffData.currentSnapshotMeta.totalUrls.toLocaleString()} URLs were indexed across sub-sitemaps as the starting baseline.
        Future daily checks will detect additions and removals against this version!
      </div>
    `;
    return;
  }

  let items = [];
  diff.added.forEach(u => {
    const urlStr = typeof u === 'string' ? u : u.url;
    const category = typeof u === 'object' ? u.category : 'General';
    items.push({ url: urlStr, category, type: 'added' });
  });
  diff.removed.forEach(u => {
    const urlStr = typeof u === 'string' ? u : u.url;
    const category = typeof u === 'object' ? u.category : 'General';
    items.push({ url: urlStr, category, type: 'removed' });
  });

  // Apply Action Filter (added / removed / all)
  if (state.currentDiffFilter === 'added') {
    items = items.filter(i => i.type === 'added');
  } else if (state.currentDiffFilter === 'removed') {
    items = items.filter(i => i.type === 'removed');
  }

  // Apply Category Filter
  const selectedCat = elements.diffSelectCategory.value;
  if (selectedCat && selectedCat !== 'all') {
    items = items.filter(i => i.category === selectedCat);
  }

  // Apply Search
  const query = state.currentDiffSearch.toLowerCase().trim();
  if (query) {
    items = items.filter(i => i.url.toLowerCase().includes(query));
  }

  if (items.length === 0) {
    elements.diffUrlsContainer.innerHTML = `
      <div class="empty-state">
        ${diff.added.length === 0 && diff.removed.length === 0 ? '✅ No changes detected between these two snapshots. Sitemaps are identical!' : 'No URLs match the current filter or search query.'}
      </div>
    `;
    return;
  }

  let html = '';
  items.forEach(item => {
    const isAdded = item.type === 'added';
    html += `
      <div class="diff-url-card ${item.type}">
        <span class="diff-tag ${item.type}">${isAdded ? '+ ADDED' : '- REMOVED'}</span>
        ${item.category && item.category !== 'General' ? `<span class="badge-category">${escapeHtml(item.category)}</span>` : ''}
        <span class="diff-url-text" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</span>
        <div class="diff-url-actions">
          <button class="btn btn-secondary btn-xs btn-copy-single-url" data-url="${escapeHtml(item.url)}" title="Copy URL">
            Copy
          </button>
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-xs" title="Open page">
            Open ↗
          </a>
        </div>
      </div>
    `;
  });

  elements.diffUrlsContainer.innerHTML = html;

  elements.diffUrlsContainer.querySelectorAll('.btn-copy-single-url').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = btn.getAttribute('data-url');
      navigator.clipboard.writeText(u);
      showToast('URL copied to clipboard', 'success');
    });
  });
}

// Copy Added URLs & CSV Export
function copyAddedUrlsToClipboard() {
  if (!state.currentDiffData?.diff?.added) {
    showToast('No diff data available', 'error');
    return;
  }
  const added = state.currentDiffData.diff.added;
  if (added.length === 0) {
    showToast('No added URLs to copy', 'info');
    return;
  }

  navigator.clipboard.writeText(added.join('\n'));
  showToast(`Copied ${added.length} added URLs to clipboard!`, 'success');
}

function exportDiffCsv() {
  if (!state.currentDiffData?.diff) {
    showToast('No diff data available', 'error');
    return;
  }

  const diff = state.currentDiffData.diff;
  let csvContent = 'Type,URL,Competitor\n';

  const compName = elements.diffSelectCompetitor.options[elements.diffSelectCompetitor.selectedIndex]?.text || 'Competitor';

  diff.added.forEach(u => {
    csvContent += `Added,"${u.replace(/"/g, '""')}","${compName.replace(/"/g, '""')}"\n`;
  });
  diff.removed.forEach(u => {
    csvContent += `Removed,"${u.replace(/"/g, '""')}","${compName.replace(/"/g, '""')}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `page_alerts_diff_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Exported CSV successfully', 'success');
}

// ================= History Tab =================

async function loadHistory() {
  try {
    const q = state.currentProjectId && state.currentProjectId !== 'all' 
      ? `?projectId=${encodeURIComponent(state.currentProjectId)}` 
      : '';
    const res = await fetch(`/api/history${q}`);
    const history = await res.json();

    if (history.length === 0) {
      const curProj = state.projects.find(p => p.id === state.currentProjectId);
      const emptyMsg = curProj 
        ? `No crawl runs recorded for project "${escapeHtml(curProj.name)}" yet. Click "Run Check Now" to test!`
        : 'No crawl runs recorded yet. Click "Run Check Now" to test!';
      elements.historyTbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center empty-state">${emptyMsg}</td>
        </tr>
      `;
      return;
    }

    let html = '';
    history.forEach(item => {
      let slackBadge = '<span class="pill pill-gray">Skipped</span>';
      if (item.slackSent) {
        slackBadge = '<span class="pill pill-green">Sent ✅</span>';
      } else if (item.slackError) {
        slackBadge = `<span class="pill pill-red" title="${escapeHtml(item.slackError)}">Failed ❌</span>`;
      }

      const pName = item.projectName || (item.projectId && item.projectId !== 'all' ? item.projectId : 'All Projects');
      const isAll = item.projectId === 'all' || !item.projectId;
      const projectBadge = `<span class="pill ${isAll ? 'pill-gray' : 'pill-cyan'}">${escapeHtml(pName)}</span>`;

      html += `
        <tr>
          <td><strong>${formatDate(item.timestamp)}</strong></td>
          <td>${projectBadge}</td>
          <td><span class="pill pill-cyan">${item.trigger || 'manual'}</span></td>
          <td>${item.competitorsCount} checked</td>
          <td><span class="pill pill-green">+${item.totalAdded || 0}</span></td>
          <td><span class="pill pill-red">-${item.totalRemoved || 0}</span></td>
          <td>${((item.durationMs || 0) / 1000).toFixed(1)}s</td>
          <td>${slackBadge}</td>
        </tr>
      `;
    });

    elements.historyTbody.innerHTML = html;
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

// ================= Settings Tab =================

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const settings = await res.json();
    state.settings = settings;

    const curProj = state.currentProjectId && state.currentProjectId !== 'all' 
      ? state.projects.find(p => p.id === state.currentProjectId) 
      : null;

    if (curProj && elements.slackScopeBanner) {
      elements.slackScopeBanner.style.display = 'block';
      elements.slackScopeBanner.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
          <div>
            <h4 style="margin: 0; font-size: 0.9rem; color: #67e8f9;">📁 Custom Slack Webhook: <strong>${escapeHtml(curProj.name)}</strong></h4>
            <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--text-muted);">
              Alerts for sites in this project will be routed here. If left blank, Page Alerts falls back to the global webhook.
            </p>
          </div>
          <span class="pill pill-cyan">Project Scope</span>
        </div>
      `;
      elements.slackWebhookUrl.value = curProj.slackWebhookUrl || '';
      elements.slackChannel.value = curProj.slackChannel || '';
      if (elements.btnSaveSlack) elements.btnSaveSlack.textContent = `Save ${curProj.name} Slack Settings`;

      if (elements.scheduleScopeBanner) {
        elements.scheduleScopeBanner.style.display = 'block';
        elements.scheduleScopeBanner.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
            <div>
              <h4 style="margin: 0; font-size: 0.88rem; color: #e2e8f0;">⏰ Automated Crawler Schedule</h4>
              <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--text-muted);">
                The daily crawl schedule below applies system-wide across <strong>all active projects</strong> (including <strong>${escapeHtml(curProj.name)}</strong>).
              </p>
            </div>
            <span class="pill pill-gray">Global System</span>
          </div>
        `;
      }
    } else {
      if (elements.slackScopeBanner) {
        elements.slackScopeBanner.style.display = 'block';
        elements.slackScopeBanner.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
            <div>
              <h4 style="margin: 0; font-size: 0.9rem; color: #f1f5f9;">🌐 Global Default Slack Webhook</h4>
              <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--text-muted);">
                Fallback Slack notification webhook used for any project that does not specify its own custom webhook.
              </p>
            </div>
            <span class="pill pill-gray">Global Fallback</span>
          </div>
        `;
      }
      elements.slackWebhookUrl.value = settings.slackWebhookUrl || '';
      elements.slackChannel.value = settings.slackChannel || '#seo-page-alerts';
      if (elements.btnSaveSlack) elements.btnSaveSlack.textContent = 'Save Global Settings';

      if (elements.scheduleScopeBanner) {
        elements.scheduleScopeBanner.style.display = 'none';
      }
    }

    elements.slackNotifyOnlyChanges.checked = settings.notifyOnlyIfChanges !== false;
    elements.slackNotifyRemoved.checked = settings.notifyOnRemoved !== false;
    elements.slackMaxUrls.value = settings.maxUrlsInSlack || 8;

    elements.scheduleEnabled.checked = settings.scheduleEnabled !== false;
    elements.scheduleHour.value = settings.dailyScheduleHour || 8;
    elements.scheduleMinute.value = settings.dailyScheduleMinute || 0;
    elements.crawlerUserAgent.value = settings.userAgent || '';
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function saveSlackSettings(e) {
  e.preventDefault();
  const curProj = state.currentProjectId && state.currentProjectId !== 'all' 
    ? state.projects.find(p => p.id === state.currentProjectId) 
    : null;

  if (curProj) {
    try {
      const projRes = await fetch(`/api/projects/${curProj.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slackWebhookUrl: elements.slackWebhookUrl.value.trim(),
          slackChannel: elements.slackChannel.value.trim()
        })
      });
      if (!projRes.ok) throw new Error('Failed to save project Slack settings');
      const updatedProj = await projRes.json();
      const idx = state.projects.findIndex(p => p.id === updatedProj.id);
      if (idx !== -1) state.projects[idx] = updatedProj;

      // Also persist general alert notification preferences
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifyOnlyIfChanges: elements.slackNotifyOnlyChanges.checked,
          notifyOnRemoved: elements.slackNotifyRemoved.checked,
          maxUrlsInSlack: parseInt(elements.slackMaxUrls.value, 10) || 8
        })
      });

      showToast(`Slack settings saved for project "${curProj.name}"!`, 'success');
      loadStats();
      return;
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  }

  const updates = {
    slackWebhookUrl: elements.slackWebhookUrl.value.trim(),
    slackChannel: elements.slackChannel.value.trim(),
    notifyOnlyIfChanges: elements.slackNotifyOnlyChanges.checked,
    notifyOnRemoved: elements.slackNotifyRemoved.checked,
    maxUrlsInSlack: parseInt(elements.slackMaxUrls.value, 10) || 8
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to save settings');
    showToast('Slack settings saved successfully!', 'success');
    loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveCrawlerSettings(e) {
  e.preventDefault();
  const updates = {
    scheduleEnabled: elements.scheduleEnabled.checked,
    dailyScheduleHour: parseInt(elements.scheduleHour.value, 10),
    dailyScheduleMinute: parseInt(elements.scheduleMinute.value, 10),
    userAgent: elements.crawlerUserAgent.value.trim()
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to save scheduler');
    showToast('Automation schedule updated!', 'success');
    loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function testSlackWebhook() {
  let webhookUrl = elements.slackWebhookUrl.value.trim();
  let channel = elements.slackChannel.value.trim();

  // If testing in project view and the webhook input is blank, fallback to global webhook
  if (!webhookUrl && state.settings?.slackWebhookUrl) {
    webhookUrl = state.settings.slackWebhookUrl;
    channel = channel || state.settings.slackChannel || '#seo-page-alerts';
    showToast('Using global fallback webhook for this test...', 'info');
  }

  if (!webhookUrl) {
    showToast('Please enter a Slack Webhook URL first.', 'error');
    return;
  }

  elements.btnTestSlack.disabled = true;
  elements.btnTestSlack.textContent = 'Sending...';

  try {
    const res = await fetch('/api/slack/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl, channel })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send test ping');
    showToast('Test ping sent to Slack successfully!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    elements.btnTestSlack.disabled = false;
    elements.btnTestSlack.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      <span>Send Test Slack Ping</span>
    `;
  }
}

// ================= Crawl Execution =================

async function runAllCheck() {
  if (elements.btnRunAllCheck.disabled) return;

  const curProj = state.currentProjectId !== 'all' ? state.projects.find(p => p.id === state.currentProjectId) : null;
  const targetLabel = curProj ? `project "${curProj.name}"` : 'all monitored sitemaps';

  elements.btnRunAllCheck.disabled = true;
  elements.btnRunAllText.textContent = 'Crawling & Diffing...';
  showToast(`Starting crawl for ${targetLabel} (no Slack alert)...`, 'info');

  try {
    const payload = { sendSlack: false };
    if (state.currentProjectId && state.currentProjectId !== 'all') {
      payload.projectId = state.currentProjectId;
    }
    const res = await fetch('/api/check/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Crawl failed');

    const added = data.totalAdded || 0;
    const removed = data.totalRemoved || 0;
    showToast(`Check finished for ${targetLabel}: +${added} added, -${removed} removed!`, 'success');

    await Promise.all([
      loadStats(),
      loadCompetitors(),
      loadHistory()
    ]);
  } catch (err) {
    showToast(`Crawl error: ${err.message}`, 'error');
  } finally {
    elements.btnRunAllCheck.disabled = false;
    elements.btnRunAllText.textContent = 'Run Check Now';
  }
}

async function runSingleCheck(competitorId) {
  showToast('Crawling competitor sitemap (no Slack alert)...', 'info');
  try {
    const res = await fetch('/api/check/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitorId, sendSlack: false })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Check failed');

    showToast(`Finished: +${data.totalAdded} added, -${data.totalRemoved} removed!`, 'success');
    await Promise.all([loadStats(), loadCompetitors()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================= Modals Logic =================

function setupModals() {
  // Project Modal
  elements.btnCloseProjectModal?.addEventListener('click', () => {
    elements.modalProject.style.display = 'none';
  });
  elements.btnCancelProjectModal?.addEventListener('click', () => {
    elements.modalProject.style.display = 'none';
  });
  elements.projectForm?.addEventListener('submit', handleSaveProject);

  // Competitor Modal
  elements.btnCloseCompModal.addEventListener('click', () => {
    elements.modalCompetitor.style.display = 'none';
  });
  elements.btnCancelCompModal.addEventListener('click', () => {
    elements.modalCompetitor.style.display = 'none';
  });
  elements.competitorForm.addEventListener('submit', handleSaveCompetitor);
  elements.btnModalTestSitemap.addEventListener('click', handleModalTestSitemap);

  // Auto-sync site classification when assigning project
  elements.compProjectId?.addEventListener('change', () => {
    const selProj = state.projects.find(p => p.id === elements.compProjectId.value);
    if (selProj && elements.compSiteType) {
      elements.compSiteType.value = selProj.type === 'own_site' ? 'own_site' : 'competitor';
    }
  });

  // Inspect Modal
  elements.btnCloseInspectModal.addEventListener('click', () => {
    elements.modalInspect.style.display = 'none';
  });
  elements.btnCancelInspectModal.addEventListener('click', () => {
    elements.modalInspect.style.display = 'none';
  });
  elements.btnQuickInspect.addEventListener('click', () => openInspectModal());
  elements.btnRunInspect.addEventListener('click', runInspectFromModal);
}

function openProjectModal(proj = null) {
  if (proj) {
    elements.modalProjectTitle.textContent = 'Edit Project';
    elements.projectIdInput.value = proj.id;
    elements.projectNameInput.value = proj.name;
    elements.projectTypeInput.value = proj.type || 'competitor';
    elements.projectDescriptionInput.value = proj.description || '';
    elements.projectSlackWebhookInput.value = proj.slackWebhookUrl || '';
    elements.projectSlackChannelInput.value = proj.slackChannel || '';
  } else {
    elements.modalProjectTitle.textContent = 'Create New Project';
    elements.projectIdInput.value = '';
    elements.projectForm.reset();
  }
  elements.modalProject.style.display = 'flex';
}

async function handleSaveProject(e) {
  e.preventDefault();
  const id = elements.projectIdInput.value;
  const payload = {
    name: elements.projectNameInput.value.trim(),
    type: elements.projectTypeInput.value,
    description: elements.projectDescriptionInput.value.trim(),
    slackWebhookUrl: elements.projectSlackWebhookInput.value.trim(),
    slackChannel: elements.projectSlackChannelInput.value.trim()
  };

  if (!payload.name) {
    showToast('Project name is required', 'error');
    return;
  }

  try {
    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `/api/projects/${id}` : '/api/projects';

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save project');

    elements.modalProject.style.display = 'none';
    showToast(`Project "${payload.name}" saved!`, 'success');

    await loadProjects();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteProject(id) {
  const proj = state.projects.find(p => p.id === id);
  if (!proj) return;

  if (state.projects.length <= 1) {
    showToast('Cannot delete the last remaining project.', 'error');
    return;
  }

  if (!confirm(`Are you sure you want to delete project "${proj.name}"? Monitored sites will be reassigned to the default project.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete project');

    showToast(`Project "${proj.name}" deleted.`, 'info');
    if (state.currentProjectId === id) {
      state.currentProjectId = 'all';
      elements.headerProjectSelect.value = 'all';
    }
    await Promise.all([loadProjects(), loadCompetitors(), loadStats()]);
    if (state.activeTab === 'tab-diff') setupDiffExplorer();
    if (state.activeTab === 'tab-history') loadHistory();
    if (state.activeTab === 'tab-settings') loadSettings();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openCompetitorModal(comp = null) {
  elements.modalSitemapTestResult.style.display = 'none';
  elements.modalSitemapTestResult.innerHTML = '';

  // Populate project options
  if (elements.compProjectId && state.projects.length > 0) {
    elements.compProjectId.innerHTML = '';
    state.projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      const icon = p.type === 'own_site' ? '🏠' : '🎯';
      opt.textContent = `${icon} ${p.name}`;
      elements.compProjectId.appendChild(opt);
    });
  }

  if (comp) {
    elements.modalCompTitle.textContent = 'Edit Monitored Site';
    elements.compId.value = comp.id;
    if (elements.compProjectId) elements.compProjectId.value = comp.projectId || 'proj_default';
    if (elements.compSiteType) elements.compSiteType.value = comp.siteType || 'competitor';
    elements.compName.value = comp.name;
    elements.compSitemapUrl.value = comp.sitemapUrl;
    elements.compTags.value = (comp.tags || []).join(', ');
    elements.compActive.checked = comp.active !== false;
  } else {
    elements.modalCompTitle.textContent = 'Add Monitored Site';
    elements.compId.value = '';
    elements.competitorForm.reset();
    if (elements.compProjectId) {
      elements.compProjectId.value = state.currentProjectId !== 'all' ? state.currentProjectId : (state.projects[0]?.id || 'proj_default');
    }
    if (elements.compSiteType) {
      const selectedProj = state.projects.find(p => p.id === elements.compProjectId?.value);
      elements.compSiteType.value = selectedProj?.type === 'own_site' ? 'own_site' : 'competitor';
    }
    elements.compActive.checked = true;
  }

  elements.modalCompetitor.style.display = 'flex';
}

async function handleModalTestSitemap() {
  const url = elements.compSitemapUrl.value.trim();
  if (!url) {
    showToast('Please enter a sitemap URL to test', 'error');
    return;
  }

  elements.btnModalTestSitemap.disabled = true;
  elements.btnModalTestSitemap.textContent = 'Testing...';
  elements.modalSitemapTestResult.style.display = 'block';
  elements.modalSitemapTestResult.innerHTML = 'Testing URL connection and parsing XML...';

  try {
    const res = await fetch('/api/sitemap/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const info = await res.json();
    if (!res.ok) throw new Error(info.error || 'Failed to parse sitemap');

    if (info.type === 'sitemapindex') {
      elements.modalSitemapTestResult.innerHTML = `
        <div style="color: var(--accent-green); font-weight: 600; margin-bottom: 4px;">✅ Valid Sitemap Index Detected</div>
        <div>Contains <strong>${info.childSitemapsCount}</strong> sub-sitemaps. PageAlerts will recursively monitor all child sitemaps.</div>
      `;
    } else {
      elements.modalSitemapTestResult.innerHTML = `
        <div style="color: var(--accent-green); font-weight: 600; margin-bottom: 4px;">✅ Valid XML Sitemap Detected</div>
        <div>Found <strong>${info.totalUrlsFound}</strong> page URLs. Ready to monitor.</div>
      `;
    }
  } catch (err) {
    elements.modalSitemapTestResult.innerHTML = `
      <div style="color: var(--accent-red); font-weight: 600; margin-bottom: 4px;">❌ Sitemap Validation Failed</div>
      <div>${escapeHtml(err.message)}</div>
    `;
  } finally {
    elements.btnModalTestSitemap.disabled = false;
    elements.btnModalTestSitemap.textContent = 'Test URL';
  }
}

async function handleSaveCompetitor(e) {
  e.preventDefault();
  const id = elements.compId.value;
  const payload = {
    projectId: elements.compProjectId ? elements.compProjectId.value : 'proj_default',
    siteType: elements.compSiteType ? elements.compSiteType.value : 'competitor',
    name: elements.compName.value.trim(),
    sitemapUrl: elements.compSitemapUrl.value.trim(),
    tags: elements.compTags.value.trim(),
    active: elements.compActive.checked
  };

  try {
    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `/api/competitors/${id}` : '/api/competitors';

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save');

    elements.modalCompetitor.style.display = 'none';
    showToast(`Site "${payload.name}" saved!`, 'success');

    await Promise.all([loadStats(), loadCompetitors()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function editCompetitor(id) {
  const comp = state.competitors.find(c => c.id === id);
  if (comp) {
    openCompetitorModal(comp);
  }
}

async function deleteCompetitor(id) {
  const comp = state.competitors.find(c => c.id === id);
  if (!comp) return;

  if (!confirm(`Are you sure you want to remove "${comp.name}" and delete its snapshots?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/competitors/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete competitor');
    showToast(`Competitor "${comp.name}" removed.`, 'info');
    await Promise.all([loadStats(), loadCompetitors()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Inspect Modal
function openInspectModal(initialUrl = '') {
  elements.inspectUrlInput.value = initialUrl;
  elements.inspectResultsView.style.display = 'none';
  elements.inspectResultsView.innerHTML = '';
  elements.modalInspect.style.display = 'flex';

  if (initialUrl) {
    runInspectFromModal();
  }
}

async function runInspectFromModal() {
  const url = elements.inspectUrlInput.value.trim();
  if (!url) {
    showToast('Please enter a sitemap URL to inspect', 'error');
    return;
  }

  elements.btnRunInspect.disabled = true;
  elements.btnRunInspect.textContent = 'Inspecting...';
  elements.inspectResultsView.style.display = 'block';
  elements.inspectResultsView.innerHTML = 'Connecting and fetching XML...';

  try {
    const res = await fetch('/api/sitemap/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const info = await res.json();
    if (!res.ok) throw new Error(info.error || 'Inspection failed');

    let html = `
      <div style="margin-bottom: 12px;">
        <span class="pill pill-green">Valid Sitemap Format</span>
        <span class="pill pill-cyan">${info.type}</span>
      </div>
    `;

    if (info.type === 'sitemapindex') {
      html += `
        <p><strong>Child Sitemaps Count:</strong> ${info.childSitemapsCount}</p>
        <p style="margin-top: 10px; font-weight: 600;">Sample Sub-Sitemaps:</p>
        <ul style="margin-left: 20px; font-size: 0.84rem; margin-top: 6px;">
          ${info.sampleChildSitemaps.map(s => `<li><a href="${escapeHtml(s.loc)}" target="_blank">${escapeHtml(s.loc)}</a></li>`).join('')}
        </ul>
      `;
    } else {
      html += `
        <p><strong>Total URLs Found:</strong> ${info.totalUrlsFound}</p>
        <p style="margin-top: 10px; font-weight: 600;">Sample URLs:</p>
        <ul style="margin-left: 20px; font-size: 0.84rem; margin-top: 6px;">
          ${info.sampleUrls.map(u => `<li><a href="${escapeHtml(u)}" target="_blank">${escapeHtml(u)}</a></li>`).join('')}
        </ul>
      `;
    }

    elements.inspectResultsView.innerHTML = html;
  } catch (err) {
    elements.inspectResultsView.innerHTML = `
      <div style="color: var(--accent-red); font-weight: 600;">Inspection Error:</div>
      <p style="font-size: 0.85rem; margin-top: 4px;">${escapeHtml(err.message)}</p>
    `;
  } finally {
    elements.btnRunInspect.disabled = false;
    elements.btnRunInspect.textContent = 'Inspect';
  }
}

// ================= Event Listeners =================

function setupEventListeners() {
  elements.btnRunAllCheck.addEventListener('click', runAllCheck);
  elements.slackSettingsForm.addEventListener('submit', saveSlackSettings);
  elements.crawlerSettingsForm.addEventListener('submit', saveCrawlerSettings);
  elements.btnTestSlack.addEventListener('click', testSlackWebhook);
  elements.btnRefreshHistory.addEventListener('click', loadHistory);

  // Toggle Webhook password visibility
  elements.btnToggleWebhookVis.addEventListener('click', () => {
    if (elements.slackWebhookUrl.type === 'password') {
      elements.slackWebhookUrl.type = 'text';
      elements.btnToggleWebhookVis.textContent = 'Hide';
    } else {
      elements.slackWebhookUrl.type = 'password';
      elements.btnToggleWebhookVis.textContent = 'Show';
    }
  });

  // Diff Explorer Controls
  elements.diffSelectCompetitor.addEventListener('change', () => {
    loadCompetitorSnapshots(elements.diffSelectCompetitor.value);
  });

  elements.btnFetchDiff.addEventListener('click', () => {
    fetchAndRenderDiff(
      elements.diffSelectCompetitor.value,
      elements.diffSelectSnapA.value,
      elements.diffSelectSnapB.value
    );
  });

  elements.diffSelectCategory.addEventListener('change', renderDiffList);
  elements.btnCopyAddedUrls.addEventListener('click', copyAddedUrlsToClipboard);
  elements.btnExportDiffCsv.addEventListener('click', exportDiffCsv);

  // Filter tabs in Diff Explorer
  elements.diffFilterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.diffFilterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentDiffFilter = tab.getAttribute('data-filter');
      renderDiffList();
    });
  });

  elements.diffSearchInput.addEventListener('input', e => {
    state.currentDiffSearch = e.target.value;
    renderDiffList();
  });

  // Copy code snippet buttons
  document.querySelectorAll('.btn-copy-code').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-code');
      navigator.clipboard.writeText(code);
      showToast('Command copied to clipboard!', 'success');
    });
  });
}

// Kickoff
document.addEventListener('DOMContentLoaded', init);
