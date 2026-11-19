import React, { useState, useEffect } from 'react';
import type { AuditLog } from '../../types';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ArrowLeft, History } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.staff.getAudit()
      .then(res => setLogs(res.logs))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
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
          System Audit Trail
        </h1>
        <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA] mt-0.5">
          Immutable historical audit log of staff verifications, space modifications & administrative overrides
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-[#737373] dark:text-[#A1A1AA] font-medium">Loading audit trail...</div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No Audit Records"
          description="Administrative actions and verification logs will be recorded here."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E5E5E5] dark:border-[#33343B] bg-[#F8F8F8] dark:bg-[#111318]/50 text-[#737373] dark:text-[#A1A1AA] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5] dark:divide-[#33343B] font-mono text-[11px]">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-[#F8F8F8] dark:hover:bg-[#292A30] transition-colors">
                    <td className="py-3 px-4 text-[#737373] dark:text-[#A1A1AA] whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    <td className="py-3 px-4 text-[#171717] dark:text-[#F5F5F5] whitespace-nowrap font-sans font-medium">
                      {log.actor} <span className="text-[10px] text-[#737373] dark:text-[#A1A1AA]">({log.actor_role})</span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-1.5 py-0.5 rounded bg-[#F4F4F5] dark:bg-[#292A30] text-[#171717] dark:text-[#F5F5F5] font-semibold text-[10px] uppercase border border-[#E5E5E5] dark:border-[#33343B]">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-sans font-medium text-[#171717] dark:text-[#F5F5F5]">
                      {log.target}
                    </td>

                    <td className="py-3 px-4 text-[#737373] dark:text-[#A1A1AA] max-w-xs truncate font-sans text-xs">
                      {log.details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
