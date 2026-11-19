import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  AlertTriangle, CheckCircle2, Clock, 
  CalendarClock, Flag, Settings, Printer, History, 
  Check, Building2, MessageSquare, ShieldCheck, Armchair, Ticket
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const StaffDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.staff.getDashboard();
      setData(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // One-tap confirm accuracy
  const handleConfirmSingle = async (spaceId: string) => {
    try {
      setConfirmingId(spaceId);
      const res = await api.staff.confirmAccurate(spaceId);
      setFeedback(res.message);
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message || 'Verification failed');
    } finally {
      setConfirmingId(null);
    }
  };

  // Bulk confirm accuracy for all stale spaces
  const handleBulkConfirmStale = async () => {
    if (!data || !data.stale_spaces || data.stale_spaces.length === 0) return;
    const ids = data.stale_spaces.map((s: any) => s.id);
    try {
      setBulkConfirming(true);
      const res = await api.staff.bulkConfirm(ids);
      setFeedback(res.message);
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message || 'Bulk confirm failed');
    } finally {
      setBulkConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-[#737373] dark:text-[#A1A1AA] font-medium">
        Loading staff operational metrics...
      </div>
    );
  }

  const metrics = data?.metrics || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5] tracking-tight">
            Staff Operations Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA] mt-0.5">
            Campus space facts verification, anonymous reports moderation & reservation oversight
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-[#F4F4F5] dark:bg-[#292A30] text-[#171717] dark:text-[#F5F5F5] border border-[#E5E5E5] dark:border-[#33343B]">
            Scope: {data?.user_scope || 'all'}
          </span>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-[#737373] hover:text-[#171717] cursor-pointer">✕</button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className={`p-4 sm:p-5 ${metrics.stale_spaces_count > 0 ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/20' : ''}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#737373] dark:text-[#A1A1AA]">
              Stale Spaces
            </span>
            <AlertTriangle className={`w-4 h-4 ${metrics.stale_spaces_count > 0 ? 'text-amber-600' : 'text-[#737373]'}`} />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#171717] dark:text-[#F5F5F5] mt-2">
            {metrics.stale_spaces_count}
          </div>
          <span className="text-[11px] text-[#737373] dark:text-[#A1A1AA] mt-1 block">
            Verification &gt;7 days old
          </span>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#737373] dark:text-[#A1A1AA]">
              Active Reports
            </span>
            <Clock className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#171717] dark:text-[#F5F5F5] mt-2">
            {metrics.active_reports_count}
          </div>
          <span className="text-[11px] text-[#737373] dark:text-[#A1A1AA] mt-1 block">
            Recent crowd updates (&lt;30m)
          </span>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#737373] dark:text-[#A1A1AA]">
              Room Holds
            </span>
            <CalendarClock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#171717] dark:text-[#F5F5F5] mt-2">
            {metrics.active_holds_count}
          </div>
          <span className="text-[11px] text-[#737373] dark:text-[#A1A1AA] mt-1 block">
            Active group reservations
          </span>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#737373] dark:text-[#A1A1AA]">
              Open Issues
            </span>
            <Flag className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#171717] dark:text-[#F5F5F5] mt-2">
            {metrics.pending_problems_count}
          </div>
          <span className="text-[11px] text-[#737373] dark:text-[#A1A1AA] mt-1 block">
            Facility maintenance notes
          </span>
        </Card>
      </div>

      {/* Stale Spaces Action Queue */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#171717] dark:text-[#F5F5F5] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Spaces Pending Staff Verification</span>
            </h2>
            <p className="text-xs text-[#737373] dark:text-[#A1A1AA] mt-0.5">
              Spaces with unverified facts for more than 7 days show an amber warning to students.
            </p>
          </div>

          {data?.stale_spaces?.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              disabled={bulkConfirming}
              onClick={handleBulkConfirmStale}
              className="self-start sm:self-auto"
            >
              {bulkConfirming ? 'Confirming...' : 'Bulk Confirm All Stale Spaces'}
            </Button>
          )}
        </div>

        {data?.stale_spaces?.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-emerald-200 dark:border-emerald-800 bg-emerald-50/20 text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto mb-1.5" />
            <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              All Study Space Facts are Current
            </h4>
            <p className="text-xs text-[#737373] dark:text-[#A1A1AA] mt-0.5">
              Every space in your scope has been verified within the last 7 days.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E5E5E5] dark:border-[#33343B] text-[#737373] dark:text-[#A1A1AA] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Space Name</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">Last Verified</th>
                  <th className="py-2.5 px-3 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5] dark:divide-[#33343B]">
                {data.stale_spaces.map((s: any) => (
                  <tr key={s.id} className="hover:bg-[#F8F8F8] dark:hover:bg-[#292A30] transition-colors">
                    <td className="py-3 px-3 font-semibold text-[#171717] dark:text-[#F5F5F5]">
                      {s.name}
                    </td>
                    <td className="py-3 px-3 text-[#737373] dark:text-[#A1A1AA]">
                      {s.location}
                    </td>
                    <td className="py-3 px-3 font-mono text-amber-700 dark:text-amber-400">
                      {s.last_checked_at.split('T')[0]}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={confirmingId === s.id}
                        onClick={() => handleConfirmSingle(s.id)}
                        className="gap-1.5"
                        icon={<Check className="w-3.5 h-3.5" />}
                      >
                        <span>{confirmingId === s.id ? 'Confirming...' : 'Confirm Still Accurate'}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Staff Administrative Navigation Grid */}
      <div>
        <h2 className="text-xs font-semibold text-[#737373] dark:text-[#A1A1AA] uppercase tracking-wider mb-3">
          Administrative Modules
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { to: '/staff/seating', label: 'Seat Layouts', icon: Armchair, desc: 'Visual maps & blocks' },
            { to: '/staff/reservations', label: 'All Reservations', icon: Ticket, desc: 'Audit & manual check-in' },
            { to: '/staff/spaces', label: 'Space Inventory', icon: Building2, desc: 'Add & edit spaces' },
            { to: '/staff/reports', label: 'Report Moderation', icon: MessageSquare, desc: 'Anonymized queue' },
            { to: '/staff/holds', label: 'Room Holds', icon: CalendarClock, desc: 'Reservation controls' },
            { to: '/staff/signs', label: 'QR Signage', icon: Printer, desc: 'Printable zone signs' },
            { to: '/staff/audit', label: 'Audit Logs', icon: History, desc: 'Traceability trail' },
            { to: '/staff/settings', label: 'Configuration', icon: Settings, desc: 'Numeric defaults' },
          ].map(module => {
            const Icon = module.icon;
            return (
              <Link key={module.to} to={module.to}>
                <Card interactive className="p-4 h-full flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-[#F4F4F5] dark:bg-[#292A30] flex items-center justify-center text-[#171717] dark:text-[#F5F5F5] mb-2">
                      <Icon className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                    </div>
                    <h3 className="font-semibold text-xs text-[#171717] dark:text-[#F5F5F5]">
                      {module.label}
                    </h3>
                    <p className="text-[11px] text-[#737373] dark:text-[#A1A1AA] mt-0.5">
                      {module.desc}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-[#EA580C] dark:text-[#F97316] mt-3 inline-flex items-center gap-1">
                    Open →
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Privacy Guarantee Note */}
      <div className="p-3.5 rounded-xl border border-[#E5E5E5] dark:border-[#33343B] bg-[#F4F4F5]/60 dark:bg-[#202127]/60 text-xs text-[#737373] dark:text-[#A1A1AA] flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span><strong>Student Privacy Enforced:</strong> Staff members cannot see student identities on availability reports or view individual telemetry data.</span>
      </div>
    </div>
  );
};
