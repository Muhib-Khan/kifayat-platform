const User = require("../models/User");
const Session = require("../models/Session");
const { sendAdminNotification } = require("./email");

const FIFTEEN_MIN = 15 * 60 * 1000;

let reminderState = {
  zeroActive: { sentCount: 0, lastSentAt: null, complete: false },
  lowActive: { sentCount: 0, lastSentAt: null, complete: false },
};

function resetReminderState() {
  reminderState = {
    zeroActive: { sentCount: 0, lastSentAt: null, complete: false },
    lowActive: { sentCount: 0, lastSentAt: null, complete: false },
  };
}

async function getActiveUserCount() {
  const cutoff = new Date(Date.now() - FIFTEEN_MIN);
  return Session.countDocuments({ expiresAt: { $gt: new Date() } });
}

async function checkAndNotify() {
  try {
    const activeCount = await getActiveUserCount();

    const now = Date.now();

    // ── 0 active users ──────────────────────────────────────────────
    if (activeCount === 0) {
      const state = reminderState.zeroActive;

      if (!state.complete) {
        const canSend = !state.lastSentAt || (now - state.lastSentAt) >= 60_000;

        if (canSend && state.sentCount < 3) {
          await sendAdminNotification(
            "No Active Users — Time to Upload Product CSV",
            `Hello Admin,<br><br>` +
            `There are currently <strong>0 active users</strong> on Kifayat.<br><br>` +
            `This is the ideal time to upload a fresh product CSV to update your catalog.<br><br>` +
            `This is reminder <strong>${state.sentCount + 1} of 3</strong>. You will receive ${3 - state.sentCount - 1} more reminder${3 - state.sentCount - 1 === 1 ? '' : 's'} at 1-minute intervals.<br><br>` +
            `Please upload the CSV from the admin panel at your earliest convenience.<br><br>` +
            `Thank you,<br>Kifayat System`
          );
          state.sentCount++;
          state.lastSentAt = now;
          console.log(`[ActiveUserMonitor] 0 active users — sent email ${state.sentCount}/3`);
        }

        if (state.sentCount >= 3) {
          state.complete = true;
          console.log("[ActiveUserMonitor] 0 active users — all 3 reminders sent, stopping");
        }
      }
    } else {
      reminderState.zeroActive = { sentCount: 0, lastSentAt: null, complete: false };
    }

    // ── Less than 15 active users ────────────────────────────────────
    if (activeCount > 0 && activeCount < 15) {
      const state = reminderState.lowActive;

      if (!state.complete) {
        const canSend = !state.lastSentAt || (now - state.lastSentAt) >= 60_000;

        if (canSend && state.sentCount < 3) {
          await sendAdminNotification(
            "Low Traffic — Good Time to Upload Product CSV",
            `Hello Admin,<br><br>` +
            `There are currently <strong>${activeCount} active user${activeCount === 1 ? '' : 's'}</strong> on Kifayat, which is considered low traffic.<br><br>` +
            `This is a good opportunity to upload a fresh product CSV to update your catalog with minimal disruption.<br><br>` +
            `This is reminder <strong>${state.sentCount + 1} of 3</strong>. You will receive ${3 - state.sentCount - 1} more reminder${3 - state.sentCount - 1 === 1 ? '' : 's'} at 1-minute intervals.<br><br>` +
            `Please upload the CSV from the admin panel at your earliest convenience.<br><br>` +
            `Thank you,<br>Kifayat System`
          );
          state.sentCount++;
          state.lastSentAt = now;
          console.log(`[ActiveUserMonitor] ${activeCount} active users (low) — sent email ${state.sentCount}/3`);
        }

        if (state.sentCount >= 3) {
          state.complete = true;
          console.log("[ActiveUserMonitor] Low traffic — all 3 reminders sent, stopping");
        }
      }
    } else {
      reminderState.lowActive = { sentCount: 0, lastSentAt: null, complete: false };
    }
  } catch (err) {
    console.error("[ActiveUserMonitor] Error:", err);
  }
}

function startMonitor() {
  console.log("  👥 Active user monitor started (check every 2 minutes)");
  checkAndNotify();
  setInterval(() => checkAndNotify(), 2 * 60 * 1000);
}

module.exports = { startMonitor, resetReminderState };
