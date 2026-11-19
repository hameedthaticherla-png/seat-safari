import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { SeatReservation } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export const ReservationsManagement: React.FC = () => {
  const { role } = useAuth();
  const [reservations, setReservations] = useState<SeatReservation[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');

  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const res = await api.staff.seating.getReservations({
        status: statusFilter === 'all' ? undefined : statusFilter,
        date: dateFilter || undefined,
      });
      setReservations(res.reservations || []);
    } catch (err: any) {
      console.error('Failed to load reservations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, [statusFilter, dateFilter]);

  const handleManualCheckIn = async (id: string) => {
    try {
      const res = await api.staff.seating.checkInReservation(id);
      setActionMessage(res.message);
      fetchReservations();
    } catch (err: any) {
      alert(err.message || 'Check-in failed');
    }
  };

  const handleForceCancel = async (id: string) => {
    const reason = prompt('Enter cancellation reason (e.g. Student no-show, emergency maintenance):');
    if (!reason) return;

    try {
      const res = await api.staff.seating.cancelReservation(id, reason);
      setActionMessage(res.message);
      fetchReservations();
    } catch (err: any) {
      alert(err.message || 'Cancellation failed');
    }
  };

  if (role !== 'staff') {
    return (
      <div className="p-8 text-center text-zinc-500">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Staff Access Required</h2>
      </div>
    );
  }

  const filtered = reservations.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.booking_reference.toLowerCase().includes(q) ||
      (r.space_name && r.space_name.toLowerCase().includes(q)) ||
      (r.seat_number && r.seat_number.toLowerCase().includes(q)) ||
      (r.student_name && r.student_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">
            Staff Facility Console
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Campus Seat Reservations Audit
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Monitor all active, completed, and no-show student reservations across university spaces
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchReservations}
          className="gap-1.5 text-xs font-semibold self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </Button>
      </div>

      {actionMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-xs underline font-normal">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-[#202127] border border-[#E5E5E5] dark:border-[#33343B] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737373] dark:text-[#A1A1AA]" />
          <input
            type="text"
            placeholder="Search reference, space, seat or student name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E5E5E5] dark:border-[#33343B] bg-[#F8F8F8] dark:bg-[#292A30] text-xs font-medium text-[#171717] dark:text-[#F5F5F5] focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 rounded-xl border border-[#E5E5E5] dark:border-[#33343B] bg-[#F8F8F8] dark:bg-[#292A30] text-xs font-medium text-[#171717] dark:text-[#F5F5F5]"
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>

          {/* Date Filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="py-2 px-3 rounded-xl border border-[#E5E5E5] dark:border-[#33343B] bg-[#F8F8F8] dark:bg-[#292A30] text-xs font-medium text-[#171717] dark:text-[#F5F5F5]"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-xs text-[#737373] hover:text-[#171717] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5] underline"
            >
              Clear Date
            </button>
          )}
        </div>
      </div>

      {/* Reservations Table */}
      <div className="bg-white dark:bg-[#202127] border border-[#E5E5E5] dark:border-[#33343B] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-zinc-400 text-xs">
            Loading campus reservations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 text-xs">
            No reservations found matching the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-[#292A30] border-b border-zinc-200 dark:border-[#33343B] text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Ref Code</th>
                  <th className="py-3 px-4">Space & Location</th>
                  <th className="py-3 px-4">Seat</th>
                  <th className="py-3 px-4">Date & Slot</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-[#33343B]">
                {filtered.map((r) => {
                  const isCheckedIn = r.status === 'checked_in';
                  const isConfirmed = r.status === 'confirmed';

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-zinc-50/50 dark:hover:bg-[#292A30]/50 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-orange-600 dark:text-orange-400">
                        {r.booking_reference}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {r.space_name}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {r.building_name} &bull; {r.floor_name}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-zinc-800 dark:text-zinc-200">
                        Seat {r.seat_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {r.reservation_date}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {r.start_time} – {r.end_time}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {r.student_name || 'Student User'}
                        </div>
                        <div className="text-[11px] text-zinc-400">{r.student_email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] ${
                            isCheckedIn
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : isConfirmed
                              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                              : r.status === 'completed'
                              ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                              : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                          }`}
                        >
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        {isConfirmed && (
                          <button
                            type="button"
                            onClick={() => handleManualCheckIn(r.id)}
                            className="px-2.5 py-1 rounded-lg border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Check In
                          </button>
                        )}
                        {(isConfirmed || isCheckedIn) && (
                          <button
                            type="button"
                            onClick={() => handleForceCancel(r.id)}
                            className="px-2.5 py-1 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Release
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
