import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ArrowLeft, EyeOff, ShieldCheck, Flag, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ReportsReview: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.staff.getReports();
      setReports(res.reports);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleHide = async (reportId: string) => {
    try {
      const res = await api.staff.hideReport(reportId);
      setFeedback(res.message);
      await fetchReports();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
          Availability Reports Moderation
        </h1>
        <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA] mt-0.5">
          Review and moderate crowdsourced space reports. Student identities are strictly omitted.
        </p>
      </div>

      {/* Privacy Notice */}
      <div className="p-3.5 rounded-xl border border-[#E5E5E5] dark:border-[#33343B] bg-[#F8F8F8] dark:bg-[#202127]/60 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-[#737373] dark:text-[#A1A1AA]">
          <strong>Privacy By Design:</strong> Student identities, account emails, and device IDs are excluded from moderation logs. Reports automatically retire after 30 minutes.
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          {feedback}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-[#737373] dark:text-[#A1A1AA] font-medium">Loading reports...</div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No Recent Availability Reports"
          description="Crowdsourced reports filed by students over the last 30 minutes will appear here for review."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E5E5E5] dark:border-[#33343B] bg-[#F8F8F8] dark:bg-[#111318]/50 text-[#737373] dark:text-[#A1A1AA] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Space</th>
                  <th className="py-3 px-4">Reported Status</th>
                  <th className="py-3 px-4">Age / Timestamp</th>
                  <th className="py-3 px-4">Flags</th>
                  <th className="py-3 px-4 text-right">Moderation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5] dark:divide-[#33343B]">
                {reports.map(rep => {
                  const ageMinutes = Math.floor((Date.now() - new Date(rep.created_at).getTime()) / (60 * 1000));
                  const isExpired = ageMinutes >= 30;

                  return (
                    <tr
                      key={rep.id}
                      className={`hover:bg-[#F8F8F8] dark:hover:bg-[#292A30] transition-colors ${
                        rep.hidden ? 'opacity-50 bg-[#F8F8F8]/40 dark:bg-[#202127]/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#171717] dark:text-[#F5F5F5]">
                          {rep.space_name}
                        </div>
                        <span className="font-mono text-[10px] text-[#737373] dark:text-[#A1A1AA]">
                          ID: {rep.id}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <StatusBadge
                          latestReport={{
                            id: rep.id,
                            status: rep.status,
                            created_at: rep.created_at,
                            age_minutes: ageMinutes,
                            age_text: `${ageMinutes}m ago`,
                          }}
                          size="sm"
                          showAge={false}
                        />
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono text-[#171717] dark:text-[#F5F5F5]">
                          {ageMinutes}m ago
                        </div>
                        <span className={`text-[10px] font-medium ${isExpired ? 'text-[#737373] dark:text-[#A1A1AA]' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {isExpired ? 'Expired' : 'Active'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {rep.flag_count > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                            <Flag className="w-3 h-3" />
                            <span>{rep.flag_count} flag{rep.flag_count > 1 ? 's' : ''}</span>
                          </span>
                        ) : (
                          <span className="text-[#737373] dark:text-[#A1A1AA] font-mono text-[11px]">0</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {!rep.hidden ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleHide(rep.id)}
                            className="h-7 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400"
                            icon={<EyeOff className="w-3 h-3" />}
                          >
                            <span>Hide Report</span>
                          </Button>
                        ) : (
                          <span className="text-xs text-[#737373] dark:text-[#A1A1AA] italic">Hidden</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
