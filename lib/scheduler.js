const cron = require('node-cron');
const storage = require('./storage');
const runner = require('./runner');

let scheduledTask = null;
let currentCronExpression = null;

function getCronExpression(hour, minute) {
  const h = Math.max(0, Math.min(23, parseInt(hour, 10) || 0));
  const m = Math.max(0, Math.min(59, parseInt(minute, 10) || 0));
  return `${m} ${h} * * *`;
}

async function initScheduler() {
  const settings = await storage.getSettings();

  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }

  if (!settings.scheduleEnabled) {
    console.log('[PageAlerts Scheduler] Daily automatic schedule is currently disabled in settings.');
    return;
  }

  const cronExpr = getCronExpression(settings.dailyScheduleHour, settings.dailyScheduleMinute);
  currentCronExpression = cronExpr;

  console.log(`[PageAlerts Scheduler] Initializing daily check at ${settings.dailyScheduleHour}:${String(settings.dailyScheduleMinute).padStart(2, '0')} (Cron: ${cronExpr})`);

  scheduledTask = cron.schedule(cronExpr, async () => {
    console.log('[PageAlerts Scheduler] Triggering daily scheduled competitor sitemap check...');
    try {
      await runner.runCheck({ trigger: 'scheduled', sendSlack: true });
    } catch (err) {
      console.error('[PageAlerts Scheduler] Daily check failed:', err);
    }
  });
}

function reschedule() {
  initScheduler().catch(err => console.error('Error rescheduling:', err));
}

function getSchedulerStatus(settings = {}) {
  return {
    enabled: settings.scheduleEnabled !== false,
    hour: settings.dailyScheduleHour ?? 8,
    minute: settings.dailyScheduleMinute ?? 0,
    cronExpression: currentCronExpression || '0 8 * * *',
    isRunning: Boolean(scheduledTask)
  };
}

module.exports = {
  initScheduler,
  reschedule,
  getSchedulerStatus
};
