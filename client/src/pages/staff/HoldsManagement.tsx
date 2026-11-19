import React, { useState, useEffect } from 'react';
import type { Hold } from '../../types';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ArrowLeft, CalendarClock, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HoldsManagement: React.FC = () => {
  const [holds, setHolds] = useState<Hold[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchHolds = async () => {
    try {
      setLoading(true);
      const res = await api.staff.getHolds();
      setHolds(res.holds);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolds();
  }, []);

  const handleRelease = async (holdId: string) => {
    if (!confirm('Force release this room reservation?')) return;
    try {
      const res = await api.staff.releaseHold(holdId);
      setFeedback(res.message);
      await fetchHolds();
    } catch (err: any) {
      alert(err.message);
    }
  };

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
          Room Holds Oversight
        </h1>
        <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA] mt-0.5">
          Monitor active group room reservations & release vacant rooms if needed
        </p>
      </div>

      {feedback && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          {feedback}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-[#737373] dark:text-[#A1A1AA] font-medium">Loading holds...</div>
      ) : holds.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No Active or Recent Room Holds"
          description="Opted-in group room reservations will appear here with live check-in and release status."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E5E5E5] dark:border-[#33343B] bg-[#F8F8F8] dark:bg-[#111318]/50 text-[#737373] dark:text-[#A1A1AA] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Room Name</th>
                  <th className="py-3 px-4">Reservation Window</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5] dark:divide-[#33343B]">
                {holds.map(hold => {
                  const isActive = hold.status === 'active' || hold.status === 'checked_in';
                  return (
                    <tr key={hold.id} className="hover:bg-[#F8F8F8] dark:hover:bg-[#292A30] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#171717] dark:text-[#F5F5F5]">
                          {hold.room_name}
                        </div>
                        <span className="font-mono text-[10px] text-[#737373] dark:text-[#A1A1AA]">
                          Hold ID: {hold.id}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-[#171717] dark:text-[#F5F5F5]">
                        {new Date(hold.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(hold.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded ${
                            hold.status === 'checked_in'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : hold.status === 'active'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-[#F4F4F5] text-[#737373] dark:bg-[#292A30] dark:text-[#A1A1AA]'
                          }`}
                        >
                          {hold.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRelease(hold.id)}
                            className="h-7 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400"
                            icon={<LogOut className="w-3 h-3" />}
                          >
                            <span>Force Release</span>
                          </Button>
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
