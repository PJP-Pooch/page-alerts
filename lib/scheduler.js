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

function initScheduler() {
  const settings = storage.getSettings();

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
  initScheduler();
}

function getSchedulerStatus() {
  const settings = storage.getSettings();
  return {
    enabled: settings.scheduleEnabled,
    hour: settings.dailyScheduleHour,
    minute: settings.dailyScheduleMinute,
    cronExpression: currentCronExpression,
    isRunning: Boolean(scheduledTask)
  };
}

module.exports = {
  initScheduler,
  reschedule,
  getSchedulerStatus
};
