import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  LogOut,
  ArrowRight,
  ShieldCheck,
  Clock,
  QrCode,
  Calendar,
  XCircle,
  Plus,
  Building2,
  Users,
} from 'lucide-react';
import type { Hold, Space, SeatReservation } from '../types';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { DigitalTicketModal } from '../components/seating/DigitalTicketModal';

export const HoldsPage: React.FC = () => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<'seats' | 'rooms'>('seats');

  // Interactive Seat Reservations
  const [seatReservations, setSeatReservations] = useState<SeatReservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SeatReservation | null>(null);

  // Group Room Holds
  const [activeHold, setActiveHold] = useState<Hold | null>(null);
  const [optedInRooms, setOptedInRooms] = useState<Space[]>([]);
  const [loadingHolds, setLoadingHolds] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // Load interactive seat reservations
  const fetchSeatReservations = async () => {
    if (role !== 'student' && role !== 'staff') {
      setLoadingReservations(false);
      return;
    }
    try {
      setLoadingReservations(true);
      const res = await api.reservations.getMyReservations();
      setSeatReservations(res.reservations || []);
    } catch (err) {
      console.error('Failed to load seat reservations', err);
    } finally {
      setLoadingReservations(false);
    }
  };

  // Load group room holds
  const fetchHoldData = async () => {
    if (role !== 'student' && role !== 'staff') {
      setLoadingHolds(false);
      return;
    }
    try {
      setLoadingHolds(true);
      const [holdRes, spacesRes] = await Promise.all([
        api.holds.getMyActive(),
        api.spaces.find(),
      ]);

      if (holdRes.hold) {
        setActiveHold(holdRes.hold);
        setSecondsLeft(holdRes.hold.checkin_seconds_remaining || 0);
      } else {
        setActiveHold(null);
      }

      const rooms = spacesRes.spaces.filter((s) => s.hold_enabled);
      setOptedInRooms(rooms);
    } catch (err) {
      console.error('Failed to load room holds', err);
    } finally {
      setLoadingHolds(false);
    }
  };

  useEffect(() => {
    fetchSeatReservations();
    fetchHoldData();
  }, [role]);

  // Checkin countdown timer for room holds
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          fetchHoldData();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  // Room Hold Actions
  const handleRoomCheckIn = async () => {
    if (!activeHold) return;
    try {
      setActionLoading(true);
      const res = await api.holds.checkIn(activeHold.id);
      setMessage(res.message);
      await fetchHoldData();
    } catch (err: any) {
      alert(err.message || 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoomRelease = async () => {
    if (!activeHold) return;
    if (!confirm('Are you sure you want to release this room reservation early?')) return;
    try {
      setActionLoading(true);
      const res = await api.holds.release(activeHold.id);
      setMessage(res.message);
      await fetchHoldData();
    } catch (err: any) {
      alert(err.message || 'Release failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Seat Reservation Actions
  const handleSeatCheckIn = async (id: string) => {
    try {
      const res = await api.reservations.checkIn(id);
      setMessage(res.message);
      if (selectedTicket && selectedTicket.id === id) {
        setSelectedTicket(res.reservation);
      }
      fetchSeatReservations();
    } catch (err: any) {
      alert(err.message || 'Check-in failed');
    }
  };

  const handleSeatCancel = async (id: string) => {
    try {
      const res = await api.reservations.cancel(id);
      setMessage(res.message);
      setSelectedTicket(null);
      fetchSeatReservations();
    } catch (err: any) {
      alert(err.message || 'Cancellation failed');
    }
  };

  if (role === 'guest') {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Student Authentication Required"
        description="Seat reservations and room holds are available to registered campus students to ensure fair access to study spaces."
        action={
          <Link to="/login">
            <Button variant="primary" size="md">
              Sign In with Student Account
            </Button>
          </Link>
        }
        className="max-w-md mx-auto my-12"
      />
    );
  }

  const activeReservations = seatReservations.filter(
    (r) => r.lifecycle === 'upcoming' || r.lifecycle === 'active'
  );
  const pastReservations = seatReservations.filter(
    (r) => r.lifecycle === 'completed' || r.lifecycle === 'cancelled' || r.lifecycle === 'no_show'
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
            My Reservations & Holds
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage your BookMyShow-style seat passes and group room reservations
          </p>
        </div>

        <Link to="/book">
          <Button variant="primary" size="sm" className="gap-2 shadow-sm">
            <Plus className="w-4 h-4" />
            <span>Book New Seat</span>
          </Button>
        </Link>
      </div>

      {message && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-xs underline font-normal">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-[#33343B] gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('seats')}
          className={`pb-3 text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
            activeTab === 'seats'
              ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-500'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <span>Seat Reservations</span>
          {activeReservations.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-orange-500 text-white font-bold">
              {activeReservations.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rooms')}
          className={`pb-3 text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
            activeTab === 'rooms'
              ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-500'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <span>Group Room Holds</span>
          {activeHold && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-purple-500 text-white font-bold">
              1
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Seat Reservations */}
      {activeTab === 'seats' && (
        <div className="space-y-6">
          {/* Active & Upcoming */}
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
              Active & Upcoming Seats
            </h2>

            {loadingReservations ? (
              <div className="py-12 text-center text-zinc-400 text-xs">
                Loading your reserved seats...
              </div>
            ) : activeReservations.length === 0 ? (
              <Card className="p-8 text-center space-y-3">
                <Clock className="w-8 h-8 text-zinc-400 mx-auto" />
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    No Upcoming Seat Bookings
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    You haven't reserved any study seats yet. Choose a space and pick your seat!
                  </p>
                </div>
                <Link to="/book" className="inline-block mt-2">
                  <Button variant="primary" size="sm">
                    Open Seat Map
                  </Button>
                </Link>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeReservations.map((res) => {
                  const isCheckedIn = res.status === 'checked_in';

                  return (
                    <Card
                      key={res.id}
                      className="p-5 border border-zinc-200 dark:border-[#33343B] space-y-4 relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md">
                            {res.booking_reference}
                          </span>
                          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-2">
                            {res.space_name}
                          </h3>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                            <span>
                              {res.building_name} &bull; {res.floor_name}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-black text-orange-600 dark:text-orange-400">
                            Seat {res.seat_number}
                          </div>
                          {res.table_label && (
                            <span className="text-[11px] text-zinc-400 block">
                              {res.table_label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Time Window */}
                      <div className="p-3 bg-zinc-50 dark:bg-[#202127] rounded-xl border border-zinc-100 dark:border-[#33343B] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="font-medium text-zinc-700 dark:text-zinc-200">
                            {res.reservation_date}
                          </span>
                        </div>
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">
                          {res.start_time} – {res.end_time}
                        </div>
                      </div>

                      {/* Status & Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-[#33343B]">
                        <div>
                          {isCheckedIn ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Checked In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                              <Clock className="w-3.5 h-3.5" /> Awaiting Arrival
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {!isCheckedIn && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSeatCheckIn(res.id)}
                              className="text-xs font-semibold"
                            >
                              Check In
                            </Button>
                          )}
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setSelectedTicket(res)}
                            className="text-xs font-semibold gap-1.5"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Digital Ticket</span>
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past Reservations */}
          {pastReservations.length > 0 && (
            <div className="pt-4">
              <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                Past Reservations
              </h2>
              <div className="divide-y divide-zinc-200 dark:divide-[#33343B] border border-zinc-200 dark:border-[#33343B] rounded-2xl overflow-hidden bg-white dark:bg-[#202127]">
                {pastReservations.map((res) => (
                  <div
                    key={res.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-zinc-400">{res.booking_reference}</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          {res.space_name} (Seat {res.seat_number})
                        </span>
                      </div>
                      <div className="text-zinc-500 mt-0.5">
                        {res.reservation_date} &bull; {res.start_time} – {res.end_time}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-semibold text-[11px] ${
                          res.status === 'completed'
                            ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                            : res.status === 'cancelled'
                            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                            : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}
                      >
                        {res.status === 'completed'
                          ? 'Completed'
                          : res.status === 'cancelled'
                          ? 'Cancelled'
                          : 'No Show'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(res)}
                        className="text-orange-600 dark:text-orange-400 hover:underline font-semibold"
                      >
                        View Ticket
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Group Room Holds */}
      {activeTab === 'rooms' && (
        <div className="space-y-6">
          {activeHold ? (
            <Card className="p-5 sm:p-6 border-purple-200 dark:border-purple-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Active Room Hold
                </span>
                <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  {activeHold.status === 'checked_in' ? 'Checked In' : 'Awaiting Check-in'}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {activeHold.room_name}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{activeHold.room_location}</span>
                </p>
              </div>

              {activeHold.needs_checkin ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-semibold">
                      Physical check-in required within:
                    </span>
                  </div>

                  <div className="font-mono font-bold text-2xl text-amber-900 dark:text-amber-200 text-center py-1">
                    {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')}
                  </div>

                  <p className="text-[11px] text-amber-700 dark:text-amber-400/90 text-center">
                    Reservations automatically release after 15 minutes if not checked in to prevent vacant room blocking.
                  </p>

                  <div className="pt-2">
                    <Button
                      variant="success"
                      size="md"
                      disabled={actionLoading}
                      onClick={handleRoomCheckIn}
                      className="w-full gap-2"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      <span>Confirm Physical Arrival (Check In)</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <div className="text-xs text-emerald-900 dark:text-emerald-200">
                    <strong className="block font-semibold">Physical Check-In Confirmed</strong>
                    <span>
                      Reserved until{' '}
                      {new Date(activeHold.end_time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      .
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-zinc-200 dark:border-[#33343B]">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionLoading}
                  onClick={handleRoomRelease}
                  className="gap-1.5 text-rose-600 hover:text-rose-700 dark:text-rose-400"
                  icon={<LogOut className="w-3.5 h-3.5" />}
                >
                  <span>Release Room Early</span>
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center">
              <Clock className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                No Active Room Holds
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-1">
                Students may hold one opted-in group project room for up to 2 hours. Physical check-in is required within 15 minutes.
              </p>
            </Card>
          )}

          {/* Directory of Opted-in Rooms */}
          <div className="space-y-3 pt-2">
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Opted-In Group Study Rooms
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {optedInRooms.map((room) => (
                <Card key={room.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {room.name}
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {room.location} &bull; Whiteboard & AC Power
                    </p>
                  </div>

                  <Link to={`/spaces/${room.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      icon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      <span>View</span>
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ticket Modal */}
      <DigitalTicketModal
        reservation={selectedTicket}
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onCheckIn={handleSeatCheckIn}
        onCancel={handleSeatCancel}
      />
    </div>
  );
};
