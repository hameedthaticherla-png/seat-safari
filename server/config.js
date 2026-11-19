require('dotenv').config();

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production.');
}

module.exports = {
  PORT: process.env.PORT || 3001,
  // This fallback is only for local development. Production startup requires a unique secret.
  JWT_SECRET: process.env.JWT_SECRET || 'seat-safari-local-development-only',
  JWT_EXPIRES_IN: '7d',
  
  // Default values seeded into settings table if not present:
  DEFAULT_SETTINGS: {
    report_expiry_minutes: '30',
    report_rate_limit_minutes: '15',
    hold_max_hours: '2',
    hold_checkin_window_minutes: '15',
    hold_daily_limit: '2',
    staleness_threshold_days: '7',
    hold_retention_days: '30'
  }
};
