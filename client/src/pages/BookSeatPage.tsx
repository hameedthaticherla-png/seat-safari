import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  LogIn,
  Layers,
  ChevronRight,
  Info,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Building, Floor, Space, Seat, SpaceTable, SeatReservation } from '../types';
import { SeatMap } from '../components/seating/SeatMap';
import { BookingSummaryDrawer } from '../components/seating/BookingSummaryDrawer';
import { DigitalTicketModal } from '../components/seating/DigitalTicketModal';
import { ZoneBadge } from '../components/ZoneBadge';

const TIME_SLOTS = [
  { label: '09:00 AM – 11:00 AM', start: '09:00', end: '11:00' },
  { label: '11:00 AM – 01:00 PM', start: '11:00', end: '13:00' },
  { label: '01:00 PM – 03:00 PM', start: '13:00', end: '15:00' },
  { label: '03:00 PM – 05:00 PM', start: '15:00', end: '17:00' },
  { label: '05:00 PM – 07:00 PM', start: '17:00', end: '19:00' },
  { label: '07:00 PM – 09:00 PM', start: '19:00', end: '21:00' },
];

export const BookSeatPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  // Hierarchy Data
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loadingHierarchy, setLoadingHierarchy] = useState(true);

  // Selection state
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');

  // Date and Time state
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(1); // Default to 11:00-13:00

  // Seating & Layout Data
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [tables, setTables] = useState<SpaceTable[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [frontLabel, setFrontLabel] = useState<string>('FRONT / PRESENTATION WALL');
  const [layoutType, setLayoutType] = useState<string>('grid');

  // Active Seat Selection & Hold
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [activeHoldId, setActiveHoldId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);

  // Modals & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedReservation, setConfirmedReservation] = useState<SeatReservation | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Current selected objects
  const currentBuilding = buildings.find((b) => b.id === selectedBuildingId) || null;
  const currentFloor = currentBuilding?.floors?.find((f) => f.id === selectedFloorId) || null;
  const currentSpace = currentFloor?.spaces?.find((s) => s.id === selectedSpaceId) || null;
  const currentSlot = TIME_SLOTS[selectedSlotIndex];

  // 1. Fetch Hierarchy on Mount
  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        setLoadingHierarchy(true);
        const data = await api.reservations.getHierarchy();
        setBuildings(data.buildings || []);

        const paramSpaceId = searchParams.get('spaceId');
        let matched = false;

        if (paramSpaceId && data.buildings) {
          for (const b of data.buildings) {
            for (const f of b.floors || []) {
              const sp = (f.spaces || []).find((s) => s.id === paramSpaceId);
              if (sp) {
                setSelectedBuildingId(b.id);
                setSelectedFloorId(f.id);
                setSelectedSpaceId(sp.id);
                matched = true;
                break;
              }
            }
            if (matched) break;
          }
        }

        if (!matched && data.buildings && data.buildings.length > 0) {
          const firstBld = data.buildings[0];
          setSelectedBuildingId(firstBld.id);
          if (firstBld.floors && firstBld.floors.length > 0) {
            const firstFlr = firstBld.floors[0];
            setSelectedFloorId(firstFlr.id);
            if (firstFlr.spaces && firstFlr.spaces.length > 0) {
              setSelectedSpaceId(firstFlr.spaces[0].id);
            }
          }
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to load campus locations');
      } finally {
        setLoadingHierarchy(false);
      }
    };

    fetchHierarchy();
  }, []);

  // Update floors when building changes
  const handleSelectBuilding = (bldId: string) => {
    setSelectedBuildingId(bldId);
    setSelectedSeat(null);
    const bld = buildings.find((b) => b.id === bldId);
    if (bld && bld.floors && bld.floors.length > 0) {
      const flr = bld.floors[0];
      setSelectedFloorId(flr.id);
      if (flr.spaces && flr.spaces.length > 0) {
        setSelectedSpaceId(flr.spaces[0].id);
      } else {
        setSelectedSpaceId('');
      }
    } else {
      setSelectedFloorId('');
      setSelectedSpaceId('');
    }
  };

  // Update space when floor changes
  const handleSelectFloor = (floorId: string) => {
    setSelectedFloorId(floorId);
    setSelectedSeat(null);
    const flr = currentBuilding?.floors?.find((f) => f.id === floorId);
    if (flr && flr.spaces && flr.spaces.length > 0) {
      setSelectedSpaceId(flr.spaces[0].id);
    } else {
      setSelectedSpaceId('');
    }
  };

  // Fetch Layout and Availability for the selected space & time window
  const fetchAvailability = useCallback(async () => {
    if (!selectedSpaceId) return;

    try {
      setLayoutLoading(true);
      setErrorMessage(null);

      // Fetch Layout (tables, orientation, layout_type)
      const layoutData = await api.reservations.getLayout(selectedSpaceId);
      setTables(layoutData.tables || []);
      setFrontLabel(layoutData.front_label || 'FRONT OF ROOM / PRESENTATION WALL');
      setLayoutType(layoutData.layout_type || 'grid');

      // Fetch dynamic availability
      const availData = await api.reservations.getAvailability(selectedSpaceId, {
        date: selectedDate,
        start_time: currentSlot.start,
        end_time: currentSlot.end,
      });

      setSeats(availData.seats || []);

      // If user had a selected seat that became unavailable, clear selection
      if (selectedSeat) {
        const updated = (availData.seats || []).find((s) => s.id === selectedSeat.id);
        if (!updated || updated.status === 'booked' || updated.is_blocked) {
          setSelectedSeat(null);
          setActiveHoldId(null);
        }
      }
    } catch (err: any) {
      console.error('Failed to load space seating availability', err);
      setErrorMessage(err.message || 'Could not load seating map');
    } finally {
      setLayoutLoading(false);
    }
  }, [selectedSpaceId, selectedDate, currentSlot, selectedSeat]);

  useEffect(() => {
    fetchAvailability();
  }, [selectedSpaceId, selectedDate, selectedSlotIndex]);

  // Handle Seat Click (with temporary backend hold)
  const handleSeatClick = async (seat: Seat) => {
    // If guest, prompt login
    if (role === 'guest') {
      setSelectedSeat(seat);
      setShowLoginPrompt(true);
      return;
    }

    // If deselecting currently selected seat
    if (selectedSeat?.id === seat.id) {
      if (activeHoldId) {
        try {
          await api.reservations.releaseHold({ reservation_id: activeHoldId });
        } catch (e) {
          console.warn('Could not release hold', e);
        }
      }
      setSelectedSeat(null);
      setActiveHoldId(null);
      setHoldExpiresAt(null);
      return;
    }

    // Release any previous hold if switching seat
    if (activeHoldId) {
      try {
        await api.reservations.releaseHold({ reservation_id: activeHoldId });
      } catch (e) {
        console.warn('Could not release previous hold', e);
      }
    }

    try {
      setErrorMessage(null);
      // Place a temporary atomic hold on the backend
      const holdRes = await api.reservations.holdSeat({
        seat_id: seat.id,
        space_id: selectedSpaceId,
        date: selectedDate,
        start_time: currentSlot.start,
        end_time: currentSlot.end,
      });

      setSelectedSeat(seat);
      setActiveHoldId(holdRes.reservation.id);
      setHoldExpiresAt(holdRes.reservation.held_until);

      // Refresh seats to reflect hold
      setSeats((prev) =>
        prev.map((s) =>
          s.id === seat.id
            ? { ...s, status: 'held', held_by_me: true, held_seconds_remaining: holdRes.reservation.expires_in_seconds }
            : s
        )
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Seat is no longer available. Please select another.');
      fetchAvailability();
    }
  };

  // Confirm Reservation
  const handleConfirmReservation = async () => {
    if (!selectedSeat || !selectedSpaceId) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const res = await api.reservations.book({
        reservation_id: activeHoldId || undefined,
        seat_id: selectedSeat.id,
        space_id: selectedSpaceId,
        date: selectedDate,
        start_time: currentSlot.start,
        end_time: currentSlot.end,
      });

      setConfirmedReservation(res.reservation);
      setShowTicketModal(true);
      setSelectedSeat(null);
      setActiveHoldId(null);
      setHoldExpiresAt(null);

      // Refresh seat layout
      fetchAvailability();
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not complete reservation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check in action from modal
  const handleCheckIn = async (id: string) => {
    try {
      const res = await api.reservations.checkIn(id);
      setConfirmedReservation(res.reservation);
      fetchAvailability();
    } catch (err: any) {
      alert(err.message || 'Check in failed');
    }
  };

  // Cancel action from modal
  const handleCancelReservation = async (id: string) => {
    try {
      await api.reservations.cancel(id);
      setShowTicketModal(false);
      setConfirmedReservation(null);
      fetchAvailability();
    } catch (err: any) {
      alert(err.message || 'Cancellation failed');
    }
  };

  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  return (
    <div className="min-h-screen pb-32 pt-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            Live Seat Reservation
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            Reserve a Seat
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            BookMyShow-style interactive visual seating across campus libraries and study halls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/holds"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-[#33343B] bg-white dark:bg-[#202127] text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:border-orange-500 hover:text-orange-500 transition-colors shadow-sm"
          >
            <Clock className="w-4 h-4 text-orange-500" />
            <span>My Reservations</span>
          </Link>
          <button
            type="button"
            onClick={fetchAvailability}
            title="Refresh availability"
            className="p-2 rounded-xl border border-zinc-200 dark:border-[#33343B] bg-white dark:bg-[#202127] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${layoutLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs underline hover:no-underline font-semibold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Location Hierarchy Navigator */}
      <div className="bg-white dark:bg-[#202127] border border-[#E5E5E5] dark:border-[#33343B] rounded-2xl p-5 mb-6 shadow-sm space-y-5">
        {/* Step 1: Building Selector */}
        <div>
          <div className="text-xs font-semibold text-[#737373] dark:text-[#A1A1AA] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-orange-500" />
            <span>1. Choose Building</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {buildings.map((b) => {
              const isSelected = b.id === selectedBuildingId;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleSelectBuilding(b.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-orange-500/10 border-orange-500 text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-orange-500'
                      : 'bg-[#F8F8F8] dark:bg-[#292A30]/50 border-[#E5E5E5] dark:border-[#33343B] text-[#171717] dark:text-[#F5F5F5] hover:border-zinc-400 dark:hover:border-zinc-500'
                  }`}
                >
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#737373] dark:text-[#A1A1AA]">
                    {b.code}
                  </div>
                  <div className="font-bold text-xs sm:text-sm mt-0.5 line-clamp-1">{b.name}</div>
                  <div className="text-[10px] text-[#737373] dark:text-[#A1A1AA] mt-1 line-clamp-1">{b.hours}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Floor Selector */}
        {currentBuilding?.floors && currentBuilding.floors.length > 0 && (
          <div className="pt-3 border-t border-[#E5E5E5] dark:border-[#292A30]">
            <div className="text-xs font-semibold text-[#737373] dark:text-[#A1A1AA] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-orange-500" />
              <span>2. Select Floor</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentBuilding.floors.map((flr) => {
                const isSelected = flr.id === selectedFloorId;
                return (
                  <button
                    key={flr.id}
                    type="button"
                    onClick={() => handleSelectFloor(flr.id)}
                    className={`px-3.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-orange-500 text-white border-orange-500 font-semibold shadow-sm'
                        : 'bg-[#F8F8F8] dark:bg-[#292A30]/50 border-[#E5E5E5] dark:border-[#33343B] text-[#737373] dark:text-[#A1A1AA] hover:bg-zinc-100 dark:hover:bg-[#292A30]'
                    }`}
                  >
                    {flr.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Space / Room Selector */}
        {currentFloor?.spaces && currentFloor.spaces.length > 0 && (
          <div className="pt-3 border-t border-[#E5E5E5] dark:border-[#292A30]">
            <div className="text-xs font-semibold text-[#737373] dark:text-[#A1A1AA] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-orange-500" />
              <span>3. Select Study Space / Room</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentFloor.spaces.map((sp) => {
                const isSelected = sp.id === selectedSpaceId;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => {
                      setSelectedSpaceId(sp.id);
                      setSelectedSeat(null);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-orange-500/10 border-orange-500 text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-orange-500'
                        : 'bg-[#F8F8F8] dark:bg-[#292A30]/50 border-[#E5E5E5] dark:border-[#33343B] text-[#171717] dark:text-[#F5F5F5] hover:border-zinc-400'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-xs sm:text-sm line-clamp-1">{sp.name}</span>
                        <ZoneBadge zone={sp.zone_type} />
                      </div>
                      <p className="text-[11px] text-[#737373] dark:text-[#A1A1AA] line-clamp-1">
                        {sp.zone_rule}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-[#E5E5E5]/60 dark:border-[#33343B]/60 flex items-center justify-between text-[11px] text-[#737373] dark:text-[#A1A1AA]">
                      <span>{sp.layout_type === 'group_room' ? 'Whole Room' : 'Interactive Map'}</span>
                      <span className="text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-1">
                        View Seats <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Date & Slot Selector Controls (BookMyShow style) */}
      <div className="bg-white dark:bg-[#202127] border border-[#E5E5E5] dark:border-[#33343B] rounded-2xl p-5 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Date Picker Buttons */}
          <div className="md:col-span-5 space-y-2">
            <div className="text-xs font-semibold text-[#737373] dark:text-[#A1A1AA] uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-orange-500" />
              <span>4. Reservation Date</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  selectedDate === todayStr
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-[#F8F8F8] dark:bg-[#292A30] border-[#E5E5E5] dark:border-[#33343B] text-[#171717] dark:text-[#F5F5F5]'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(getTomorrowStr())}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  selectedDate === getTomorrowStr()
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-[#F8F8F8] dark:bg-[#292A30] border-[#E5E5E5] dark:border-[#33343B] text-[#171717] dark:text-[#F5F5F5]'
                }`}
              >
                Tomorrow
              </button>
              <input
                type="date"
                min={todayStr}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="py-2 px-3 rounded-xl border border-[#E5E5E5] dark:border-[#33343B] bg-[#F8F8F8] dark:bg-[#292A30] text-xs font-medium text-[#171717] dark:text-[#F5F5F5] focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Time Slot Buttons */}
          <div className="md:col-span-7 space-y-2">
            <div className="text-xs font-semibold text-[#737373] dark:text-[#A1A1AA] uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-orange-500" />
              <span>5. Time Window (2 Hours)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TIME_SLOTS.map((slot, idx) => {
                const isSelected = selectedSlotIndex === idx;
                return (
                  <button
                    key={slot.label}
                    type="button"
                    onClick={() => {
                      setSelectedSlotIndex(idx);
                      setSelectedSeat(null);
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-orange-500 text-white border-orange-500 font-bold shadow-sm'
                        : 'bg-[#F8F8F8] dark:bg-[#292A30] border-[#E5E5E5] dark:border-[#33343B] text-[#737373] dark:text-[#A1A1AA] hover:border-zinc-400 text-xs font-medium'
                    }`}
                  >
                    <span className="text-[11px] block leading-tight">{slot.start} – {slot.end}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Visual Seat Map */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-orange-500" />
            <span>6. Select Available Seat</span>
          </div>

          <div className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            <span>Seats are held for 5 minutes once clicked</span>
          </div>
        </div>

        <SeatMap
          seats={seats}
          tables={tables}
          selectedSeatId={selectedSeat?.id || null}
          onSelectSeat={handleSeatClick}
          frontLabel={frontLabel}
          layoutType={layoutType}
          isLoading={layoutLoading}
        />
      </div>

      {/* Guest Login Alert Prompt Modal */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1A1C23] border border-zinc-200 dark:border-[#33343B] rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto">
              <LogIn className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                Student Sign-In Required
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                You are browsing as a Guest. To hold and reserve seats, please sign in with your student campus account.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowLoginPrompt(false)}
                className="flex-1 py-2 rounded-xl border border-zinc-200 dark:border-[#33343B] text-xs font-semibold"
              >
                Continue Browsing
              </button>
              <button
                type="button"
                onClick={() => navigate('/login?redirect=/book')}
                className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-md"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Booking Summary Drawer */}
      <BookingSummaryDrawer
        selectedSeat={selectedSeat}
        space={currentSpace}
        building={currentBuilding}
        floor={currentFloor}
        date={selectedDate}
        startTime={currentSlot.start}
        endTime={currentSlot.end}
        holdExpiresAt={holdExpiresAt}
        onProceed={handleConfirmReservation}
        onClearSeat={() => {
          if (activeHoldId) {
            api.reservations.releaseHold({ reservation_id: activeHoldId }).catch(() => {});
          }
          setSelectedSeat(null);
          setActiveHoldId(null);
          setHoldExpiresAt(null);
        }}
        isSubmitting={isSubmitting}
      />

      {/* Digital Boarding Pass Ticket Modal */}
      <DigitalTicketModal
        reservation={confirmedReservation}
        isOpen={showTicketModal}
        onClose={() => {
          setShowTicketModal(false);
          setConfirmedReservation(null);
        }}
        onCheckIn={handleCheckIn}
        onCancel={handleCancelReservation}
      />
    </div>
  );
};
