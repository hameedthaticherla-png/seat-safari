const { get, query, getSetting } = require('../db');

function checkReportRateLimit(userId, spaceId) {
  const limitMinutes = Number(getSetting('report_rate_limit_minutes', 15));

  // Get user's most recent report for this space
  const recentReport = get(
    'SELECT created_at FROM reports WHERE user_id = ? AND space_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId, spaceId]
  );

  if (recentReport) {
    const reportTime = new Date(recentReport.created_at).getTime();
    const elapsedMinutes = (Date.now() - reportTime) / (60 * 1000);

    if (elapsedMinutes < limitMinutes) {
      const waitMinutes = Math.max(1, Math.ceil(limitMinutes - elapsedMinutes));
      return {
        allowed: false,
        message: `You recently spotted this space. Please wait ${waitMinutes} more minute${waitMinutes > 1 ? 's' : ''} before reporting again.`,
        waitMinutes
      };
    }
  }

  return { allowed: true };
}

function checkHoldLimits(userId) {
  // 1. Check for existing active or checked_in hold
  const activeHold = get(
    "SELECT id, room_id, status FROM holds WHERE user_id = ? AND status IN ('active', 'checked_in') LIMIT 1",
    [userId]
  );

  if (activeHold) {
    return {
      allowed: false,
      message: 'You already have an active room hold. Please release or complete it before requesting another.',
      activeHoldId: activeHold.id
    };
  }

  // 2. Check daily limit
  const dailyLimit = Number(getSetting('hold_daily_limit', 2));
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const userHolds = query(
    "SELECT created_at FROM holds WHERE user_id = ?",
    [userId]
  );

  const todaysCount = userHolds.filter(h => new Date(h.created_at).getTime() >= startOfDay.getTime()).length;

  if (todaysCount >= dailyLimit) {
    return {
      allowed: false,
      message: `Daily hold limit reached (${dailyLimit} per day). Opt-in rooms are shared community spaces.`
    };
  }

  return { allowed: true };
}

module.exports = {
  checkReportRateLimit,
  checkHoldLimits
};
