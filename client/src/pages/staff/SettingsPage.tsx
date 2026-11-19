import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, Save } from 'lucide-react';
import { Link } from 'react-router-dom';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<{ [key: string]: { value: string; description: string } }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    api.staff.getSettings()
      .then(res => setSettings(res.settings))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string, val: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        value: val,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload: { [key: string]: string } = {};
      for (const [k, v] of Object.entries(settings)) {
        payload[k] = v.value;
      }
      const res = await api.staff.updateSettings(payload);
      setFeedback(res.message);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldLabels: Record<string, { label: string; unit: string }> = {
    report_expiry_minutes: { label: 'Report Expiration Window', unit: 'minutes' },
    report_rate_limit_minutes: { label: 'Report Rate Limit per Student', unit: 'minutes' },
    hold_max_hours: { label: 'Group Room Max Hold Duration', unit: 'hours' },
    hold_checkin_window_minutes: { label: 'Hold Check-In Window (Auto-Release)', unit: 'minutes' },
    hold_daily_limit: { label: 'Student Daily Hold Limit', unit: 'holds / student / day' },
    staleness_threshold_days: { label: 'Space Staleness Amber Warning Threshold', unit: 'days' },
    hold_retention_days: { label: 'Expired Hold Audit Retention Window', unit: 'days' },
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link
            to="/staff"
            className="text-xs font-medium text-[#737373] hover:text-[#171717] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5] flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5] tracking-tight">
          System Configuration & Defaults
        </h1>
        <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA] mt-0.5">
          Tune automated auto-release windows, report expiration intervals & data quality thresholds
        </p>
      </div>

      {feedback && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          {feedback}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-[#737373] dark:text-[#A1A1AA] font-medium">Loading system settings...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <Card className="divide-y divide-[#E5E5E5] dark:divide-[#33343B] p-5">
            {Object.entries(settings).map(([key, data]) => {
              const meta = fieldLabels[key] || { label: key, unit: '' };
              return (
                <div key={key} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#171717] dark:text-[#F5F5F5]">
                      {meta.label}
                    </label>
                    <span className="text-[11px] font-mono text-[#737373] dark:text-[#A1A1AA]">
                      {meta.unit}
                    </span>
                  </div>

                  <p className="text-xs text-[#737373] dark:text-[#A1A1AA] leading-normal">
                    {data.description}
                  </p>

                  <div className="pt-1">
                    <input
                      type="number"
                      value={data.value}
                      onChange={e => handleChange(key, e.target.value)}
                      className="w-32 h-8 px-2.5 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] text-[#171717] dark:text-[#F5F5F5] font-mono text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                      min="1"
                      required
                    />
                  </div>
                </div>
              );
            })}
          </Card>

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={saving}
            className="gap-2"
            icon={<Save className="w-4 h-4" />}
          >
            <span>Save Configuration Settings</span>
          </Button>
        </form>
      )}
    </div>
  );
};
