import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Armchair, Check, CheckCircle2, LoaderCircle, MessageSquareText, Moon, Printer, RefreshCw, Send, Sun, Wifi, X } from 'lucide-react';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import type { Seat } from '../types';
import { QRCodeSVG } from 'qrcode.react';

type Space = {
  id: string;
  name: string;
  description?: string;
  hours: string;
  facilities: string[];
  total_seats: number;
  occupied_seats: number;
  seats: Seat[];
};
type Floor = { id: string; building_id: string; floor_number: number; name: string; description?: string; spaces: Space[] };
type Building = { id: string; name: string; campus: string; hours: string; floors: Floor[] };
type ActiveOccupancy = { seatId: string; deviceToken: string; since: number };
type FeedbackCategory = 'suggestion' | 'complaint' | 'issue' | 'feedback';
const feedbackCategories: Array<{ id: FeedbackCategory; label: string }> = [
  { id: 'suggestion', label: 'Suggestion' },
  { id: 'complaint', label: 'Complaint' },
  { id: 'issue', label: 'Technical issue' },
  { id: 'feedback', label: 'Other feedback' },
];

const ACTIVE_OCCUPANCY_KEY = 'safari_active_occupancy';
const CHECK_IN_REMINDER_MS = 90 * 60 * 1000;

function readActiveOccupancy(): ActiveOccupancy | null {
  try {
    const saved = localStorage.getItem(ACTIVE_OCCUPANCY_KEY);
    if (!saved) return null;
    const value = JSON.parse(saved) as ActiveOccupancy;
    if (typeof value.seatId === 'string' && typeof value.deviceToken === 'string' && Number.isFinite(value.since)) return value;
  } catch { /* Ignore unavailable or malformed local storage. */ }
  return null;
}

const iconLabel: Record<string, string> = {
  power: 'Charging ports', pc_terminal: 'Computers', fan: 'Fans', ac: 'Air conditioning', wifi: 'Wi-Fi', discussion: 'Open discussion',
};

function OccupancyApp() {
  const { theme, toggleTheme } = useTheme();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedFloorId, setSelectedFloorId] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [selectedSeatId, setSelectedSeatId] = useState('');
  const [activeOccupancy, setActiveOccupancy] = useState<ActiveOccupancy | null>(readActiveOccupancy);
  const [clockNow, setClockNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>('feedback');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const appliedSeatLink = useRef(false);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await api.occupancy.getLocations();
      setBuildings(result.buildings);
      if (activeOccupancy) {
        const savedSeat = result.buildings.flatMap((building) => building.floors.flatMap((floor) => floor.spaces.flatMap((space) => space.seats)))
          .find((seat) => seat.id === activeOccupancy.seatId);
        const reminderIsDue = Date.now() - activeOccupancy.since >= CHECK_IN_REMINDER_MS;
        if ((!savedSeat?.occupied || !savedSeat.occupied_by_me) && !reminderIsDue) {
          localStorage.removeItem(ACTIVE_OCCUPANCY_KEY);
          setActiveOccupancy(null);
        }
      }
      const linkedSeatId = new URLSearchParams(window.location.search).get('seat');
      const linkedLocation = linkedSeatId ? result.buildings.flatMap((building) => building.floors.flatMap((floor) =>
        floor.spaces.map((space) => ({ building, floor, space }))
      )).find(({ space }) => space.seats.some((seat) => seat.id === linkedSeatId)) : undefined;
      if (!appliedSeatLink.current) {
        appliedSeatLink.current = true;
        if (linkedLocation && linkedSeatId) {
          setSelectedBuildingId(linkedLocation.building.id);
          setSelectedFloorId(linkedLocation.floor.id);
          setSelectedSpaceId(linkedLocation.space.id);
          setSelectedSeatId(linkedSeatId);
          setFeedbackSubmitted(false);
          setFeedbackOpen(true);
        } else {
          setSelectedBuildingId((current) => result.buildings.some((building) => building.id === current)
            ? current
            : result.buildings.find((building) => building.id === 'bld_library')?.id || result.buildings[0]?.id || '');
          setSelectedFloorId((current) => result.buildings.some((building) => building.floors.some((floor) => floor.id === current))
            ? current
            : result.buildings.find((building) => building.id === 'bld_library')?.floors[0]?.id || result.buildings[0]?.floors[0]?.id || '');
          setSelectedSpaceId((current) => {
            const allSpaces = result.buildings.flatMap((building) => building.floors.flatMap((floor) => floor.spaces));
            return allSpaces.some((space) => space.id === current) ? current : allSpaces[0]?.id || '';
          });
        }
      }
      setClockNow(Date.now());
      setLastUpdated(new Date());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load study-space seats.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeOccupancy]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!feedbackOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !feedbackSubmitting) setFeedbackOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [feedbackOpen, feedbackSubmitting]);

  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId) || null;
  const floors = selectedBuilding?.floors || [];
  const selectedFloor = floors.find((floor) => floor.id === selectedFloorId) || floors[0] || null;
  const selectedSpace = selectedFloor?.spaces.find((space) => space.id === selectedSpaceId) || null;
  const selectedSeat = selectedSpace?.seats.find((seat) => seat.id === selectedSeatId) || null;
  const activeSeat = buildings.flatMap((building) => building.floors.flatMap((floor) => floor.spaces.map((space) => ({ building, floor, space }))))
    .find(({ space }) => space.seats.some((seat) => seat.id === activeOccupancy?.seatId));
  const reminderDue = Boolean(activeOccupancy && clockNow - activeOccupancy.since >= CHECK_IN_REMINDER_MS);
  const floorCapacity = useMemo(() => selectedFloor?.spaces.reduce((sum, space) => sum + space.total_seats, 0) || 0, [selectedFloor]);
  const floorOccupied = useMemo(() => selectedFloor?.spaces.reduce((sum, space) => sum + space.occupied_seats, 0) || 0, [selectedFloor]);

  const chooseFloor = (floor: Floor) => {
    setSelectedFloorId(floor.id);
    setSelectedSpaceId(floor.spaces[0]?.id || '');
    setSelectedSeatId('');
  };

  const chooseBuilding = (building: Building) => {
    setSelectedBuildingId(building.id);
    setSelectedFloorId(building.floors[0]?.id || '');
    setSelectedSpaceId(building.floors[0]?.spaces[0]?.id || '');
    setSelectedSeatId('');
  };

  const floorTotals = (building: Building) => building.floors.reduce((total, floor) => {
    for (const space of floor.spaces) {
      total.seats += space.total_seats;
      total.occupied += space.occupied_seats;
    }
    return total;
  }, { seats: 0, occupied: 0 });

  const formatHours = (hours: string) => hours === 'Until 19:00'
    ? (isPastClosing(hours) ? 'Closed for today' : 'Available until 7:00 PM')
    : `Open ${hours}`;

  function isPastClosing(hours: string) {
    const closing = /^Until (\d{2}):(\d{2})$/.exec(hours || '');
    if (!closing) return false;
    const timeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const currentHour = Number(timeParts.find((part) => part.type === 'hour')?.value || 0);
    const currentMinute = Number(timeParts.find((part) => part.type === 'minute')?.value || 0);
    return currentHour * 60 + currentMinute >= Number(closing[1]) * 60 + Number(closing[2]);
  }

  const markSeat = async () => {
    if (!selectedSeat) return;
    const isMine = Boolean(selectedSeat.occupied_by_me);
    if (selectedSeat.occupied && !isMine) {
      setError('This seat is already marked occupied on another device.');
      return;
    }
    if (!selectedSeat.occupied && activeOccupancy && activeOccupancy.seatId !== selectedSeat.id) {
      setError('Check out of your current seat before marking another one occupied.');
      return;
    }
    setSaving(true);
    try {
      await api.occupancy.setSeatOccupied(selectedSeat.id, !Boolean(selectedSeat.occupied));
      if (selectedSeat.occupied) {
        localStorage.removeItem(ACTIVE_OCCUPANCY_KEY);
        setActiveOccupancy(null);
      } else {
        const current = { seatId: selectedSeat.id, deviceToken: api.occupancy.getDeviceToken(), since: Date.now() };
        localStorage.setItem(ACTIVE_OCCUPANCY_KEY, JSON.stringify(current));
        setActiveOccupancy(current);
      }
      setSelectedSeatId('');
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update this seat.');
    } finally {
      setSaving(false);
    }
  };

  const respondToReminder = async () => {
    if (!activeOccupancy) return;
    setSaving(true);
    try {
      await api.occupancy.setSeatOccupied(activeOccupancy.seatId, false);
      localStorage.removeItem(ACTIVE_OCCUPANCY_KEY);
      setActiveOccupancy(null);
      await load(true);
    } catch (e) {
      // The lease may already have expired and another student may have taken the seat.
      if (e && typeof e === 'object' && 'status' in e && e.status === 409) {
        localStorage.removeItem(ACTIVE_OCCUPANCY_KEY);
        setActiveOccupancy(null);
        await load(true);
        setSaving(false);
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not update your seat status.');
    } finally {
      setSaving(false);
    }
  };

  const seatQrUrl = (seatId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('seat', seatId);
    return url.toString();
  };

  const openFeedback = () => {
    setFeedbackCategory('feedback');
    setFeedbackMessage('');
    setFeedbackError('');
    setFeedbackSubmitted(false);
    setFeedbackOpen(true);
  };

  const submitFeedback = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = feedbackMessage.trim();
    if (message.length < 10) {
      setFeedbackError('Please add a little more detail (at least 10 characters).');
      return;
    }
    setFeedbackSubmitting(true);
    setFeedbackError('');
    try {
      await api.occupancy.submitFeedback({
        category: feedbackCategory,
        message,
        ...(selectedSeatId ? { seat_id: selectedSeatId } : {}),
      });
      setFeedbackSubmitted(true);
      setFeedbackMessage('');
    } catch (e) {
      setFeedbackError(e instanceof Error ? e.message : 'Could not send your feedback. Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const seatStyle = (seat: Seat) => {
    if (seat.is_blocked) return 'bg-zinc-100 border-zinc-200 text-zinc-400 dark:bg-[#292A30] dark:border-[#33343B] dark:text-zinc-500';
    if (seat.occupied) return 'bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-200';
    return 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100 dark:bg-emerald-950/35 dark:border-emerald-900 dark:text-emerald-200 dark:hover:bg-emerald-950/60';
  };

  return (
    <>
    <div className="site-shell min-h-screen bg-[#F8F8F8] text-[#171717] dark:bg-[#111318] dark:text-[#F5F5F5]">
      <header className="sticky top-0 z-20 border-b border-[#E5E5E5] bg-white/90 backdrop-blur dark:border-[#33343B] dark:bg-[#202127]/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="flex items-center gap-3" aria-label="Seat Safari home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EA580C] text-white"><Armchair size={19} /></span>
            <span className="leading-tight"><strong className="block text-sm font-semibold tracking-tight">Seat Safari</strong><span className="text-xs text-[#737373] dark:text-[#A1A1AA]">Library &amp; academic spaces</span></span>
          </a>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-[#737373] dark:text-[#A1A1AA] sm:block">Updates every 15 seconds</span>
            <button onClick={() => void load(true)} disabled={refreshing} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E5E5] text-[#737373] hover:bg-[#F4F4F5] disabled:opacity-50 dark:border-[#33343B] dark:text-[#A1A1AA] dark:hover:bg-[#292A30]" aria-label="Refresh occupancy">
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={toggleTheme} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E5E5] text-[#737373] hover:bg-[#F4F4F5] dark:border-[#33343B] dark:text-[#A1A1AA] dark:hover:bg-[#292A30]" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-16 sm:px-6 sm:py-10">
        <div className="mb-7 max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#EA580C]">Campus study spaces</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Find an empty seat.</h1>
          <p className="mt-2 text-sm leading-6 text-[#737373] dark:text-[#A1A1AA]">Choose the library or an academic block, then select a floor and area. When you sit down or leave, update that seat so others can find it. Seat status is self-reported; QR labels open a seat but do not verify physical presence.</p>
        </div>

        {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>}
        {reminderDue && activeOccupancy && <section role="status" aria-live="polite" className="mb-5 flex flex-col justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 sm:flex-row sm:items-center dark:border-orange-900 dark:bg-orange-950/25">
          <div><p className="text-sm font-semibold">Your 90-minute check-in has ended.</p><p className="mt-1 text-xs text-[#737373] dark:text-[#A1A1AA]">{activeSeat ? `${activeSeat.space.name} · Seat ${activeOccupancy.seatId.split('_').at(-1)}` : 'Your checked-in seat'} was released. If you’re still there, scan its QR code again to mark it occupied.</p></div>
          <button onClick={() => void respondToReminder()} disabled={saving} className="min-h-10 rounded-lg border border-[#E5E5E5] bg-white px-3 text-xs font-semibold dark:border-[#33343B] dark:bg-[#202127]">I’ve left</button>
        </section>}
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-[#737373] dark:text-[#A1A1AA]"><LoaderCircle size={18} className="animate-spin" /> Loading study spaces…</div>
        ) : (
          <>
            <section aria-label="Choose a study-space section" className="mb-7 space-y-5">
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#737373] dark:text-[#A1A1AA]">Library</h2>
                {buildings.filter((building) => building.id === 'bld_library').map((building) => {
                  const totals = floorTotals(building);
                  return <button key={building.id} onClick={() => chooseBuilding(building)} className={`w-full rounded-xl border p-3 text-left transition-colors sm:w-72 ${selectedBuildingId === building.id ? 'border-[#EA580C] bg-orange-50 ring-1 ring-[#EA580C] dark:bg-orange-950/20' : 'border-[#E5E5E5] bg-white hover:border-zinc-300 dark:border-[#33343B] dark:bg-[#202127] dark:hover:border-zinc-600'}`}>
                    <span className="block text-sm font-semibold">{building.name}</span><span className="mt-1 block text-xs text-[#737373] dark:text-[#A1A1AA]">{totals.seats - totals.occupied} empty · {totals.seats} seats</span>
                  </button>;
                })}
              </div>
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#737373] dark:text-[#A1A1AA]">Academic Blocks</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {buildings.filter((building) => building.id !== 'bld_library').map((building) => {
                    const totals = floorTotals(building);
                    const closed = isPastClosing(building.hours);
                    return <button key={building.id} onClick={() => chooseBuilding(building)} className={`rounded-xl border p-3 text-left transition-colors ${selectedBuildingId === building.id ? 'border-[#EA580C] bg-orange-50 ring-1 ring-[#EA580C] dark:bg-orange-950/20' : 'border-[#E5E5E5] bg-white hover:border-zinc-300 dark:border-[#33343B] dark:bg-[#202127] dark:hover:border-zinc-600'}`}>
                      <span className="block text-sm font-semibold">{building.name.replace('Academic ', '')}</span><span className="mt-1 block text-xs text-[#737373] dark:text-[#A1A1AA]">{closed ? `Closed · ${totals.seats} seats` : `${totals.seats - totals.occupied} empty · ${totals.seats}`}</span><span className="mt-1 block text-[10px] text-[#737373] dark:text-[#A1A1AA]">{formatHours(building.hours)}</span>
                    </button>;
                  })}
                </div>
              </div>
            </section>

            <section aria-label="Choose a floor" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {floors.map((floor) => {
                const total = floor.spaces.reduce((sum, space) => sum + space.total_seats, 0);
                const occupied = floor.spaces.reduce((sum, space) => sum + space.occupied_seats, 0);
                const closed = isPastClosing(selectedBuilding?.hours || '');
                return <button key={floor.id} onClick={() => chooseFloor(floor)} className={`rounded-xl border p-3 text-left transition-colors ${selectedFloor?.id === floor.id ? 'border-[#EA580C] bg-orange-50 ring-1 ring-[#EA580C] dark:bg-orange-950/20' : 'border-[#E5E5E5] bg-white hover:border-zinc-300 dark:border-[#33343B] dark:bg-[#202127] dark:hover:border-zinc-600'}`}>
                  <span className="block text-sm font-semibold">{floor.floor_number === 1 ? 'Basement' : `Floor ${floor.floor_number}`}</span>
                  <span className="mt-1 block text-xs text-[#737373] dark:text-[#A1A1AA]">{closed ? `Closed · ${total} seats` : total ? `${Math.max(0, total - occupied)} of ${total} empty` : 'Capacity pending'}</span>
                </button>;
              })}
            </section>

            {selectedBuilding && selectedFloor && <>
              <section className="mb-5 flex flex-col justify-between gap-4 rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:flex-row sm:items-center sm:p-5 dark:border-[#33343B] dark:bg-[#202127]">
                <div><h2 className="text-lg font-semibold">{selectedBuilding.name} · {selectedFloor.name}</h2><p className="mt-1 text-sm text-[#737373] dark:text-[#A1A1AA]">{selectedFloor.description}</p><p className="mt-1 text-xs font-medium text-[#EA580C]">{formatHours(selectedBuilding.hours)}</p></div>
                <div className="flex items-center gap-3 rounded-xl bg-[#F8F8F8] px-4 py-3 dark:bg-[#292A30]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"><Armchair size={18} /></span>
                  <div><span className="block text-xl font-semibold leading-none">{isPastClosing(selectedBuilding.hours) ? 'Closed' : Math.max(0, floorCapacity - floorOccupied)} <span className="text-sm font-normal text-[#737373] dark:text-[#A1A1AA]">{isPastClosing(selectedBuilding.hours) ? '' : `/ ${floorCapacity}`}</span></span><span className="mt-1 block text-[11px] text-[#737373] dark:text-[#A1A1AA]">{isPastClosing(selectedBuilding.hours) ? 'not available right now' : 'seats currently empty'}</span></div>
                </div>
              </section>

              <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
                <nav aria-label="Areas on this floor" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                  {selectedFloor.spaces.map((space) => <button key={space.id} onClick={() => { setSelectedSpaceId(space.id); setSelectedSeatId(''); }} className={`min-w-max rounded-xl border px-3.5 py-3 text-left transition-colors lg:min-w-0 ${selectedSpaceId === space.id ? 'border-[#EA580C] bg-orange-50 dark:bg-orange-950/20' : 'border-[#E5E5E5] bg-white hover:bg-[#F4F4F5] dark:border-[#33343B] dark:bg-[#202127] dark:hover:bg-[#292A30]'}`}>
                    <span className="block text-sm font-medium">{space.name}</span><span className="mt-1 block text-xs text-[#737373] dark:text-[#A1A1AA]">{isPastClosing(space.hours) ? `Closed · ${space.total_seats} seats` : space.total_seats ? `${Math.max(0, space.total_seats - space.occupied_seats)} empty · ${space.total_seats} seats` : 'Seat layout pending'}</span>
                  </button>)}
                </nav>

                {selectedSpace && <section className="min-w-0 rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-6 dark:border-[#33343B] dark:bg-[#202127]">
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div><h3 className="text-base font-semibold">{selectedSpace.name}</h3><p className="mt-1 text-xs text-[#EA580C]">{formatHours(selectedSpace.hours)}</p>{selectedBuilding.id === 'bld_library' && [2, 4, 5].includes(selectedFloor.floor_number) && <p className="mt-1 max-w-xl text-xs text-amber-700 dark:text-amber-300">Area seat counts are provisional allocations of the 100-seat floor total. Confirm actual area counts before printing QR labels.</p>}<div className="mt-2 flex flex-wrap gap-1.5">{selectedSpace.facilities.filter((facility) => iconLabel[facility]).map((facility) => <span key={facility} className="rounded-md bg-[#F4F4F5] px-2 py-1 text-[11px] text-[#737373] dark:bg-[#292A30] dark:text-[#A1A1AA]">{iconLabel[facility]}</span>)}</div></div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#737373] dark:text-[#A1A1AA]"><button onClick={() => window.print()} className="qr-screen-only inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E5E5E5] bg-white px-3 text-xs font-medium hover:bg-[#F4F4F5] dark:border-[#33343B] dark:bg-[#202127] dark:hover:bg-[#292A30]"><Printer size={14} />Print QR labels</button><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Empty</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-rose-500" />Occupied</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-zinc-400" />Unavailable</span></div>
                  </div>

                  {isPastClosing(selectedSpace.hours) && <p className="mb-3 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:bg-[#292A30] dark:text-[#A1A1AA]">This computer lab is closed for today. New check-ins are closed after 7:00 PM; you can still check out of a seat marked by this device.</p>}
                  {selectedSpace.seats.length ? <div className="overflow-x-auto rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3 dark:border-[#33343B] dark:bg-[#17181D]">
                    <div className="mx-auto grid w-max grid-cols-5 gap-2 sm:grid-cols-10" role="group" aria-label={`${selectedSpace.name} seats`}>
                      {selectedSpace.seats.map((seat) => <button key={seat.id} disabled={Boolean(seat.is_blocked) || (isPastClosing(selectedSpace.hours) && !(seat.occupied && seat.occupied_by_me))} onClick={() => setSelectedSeatId((current) => current === seat.id ? '' : seat.id)} aria-pressed={selectedSeatId === seat.id} aria-label={`Seat ${seat.seat_number}, ${isPastClosing(selectedSpace.hours) ? seat.occupied_by_me ? 'your occupied seat, check out available' : 'closed' : seat.is_blocked ? 'unavailable' : seat.occupied ? 'occupied' : 'empty'}`} className={`flex h-10 w-10 flex-col items-center justify-center rounded-lg border text-[9px] font-semibold transition ${isPastClosing(selectedSpace.hours) && !(seat.occupied && seat.occupied_by_me) ? 'bg-zinc-100 border-zinc-200 text-zinc-400 dark:bg-[#292A30] dark:border-[#33343B] dark:text-zinc-500' : seatStyle(seat)} ${selectedSeatId === seat.id ? 'outline outline-2 outline-[#EA580C] outline-offset-1' : ''}`}><Armchair size={13} /><span>{seat.seat_number}</span></button>)}
                    </div>
                  </div> : <div className="rounded-xl border border-dashed border-[#D4D4D8] bg-[#FAFAFA] px-5 py-10 text-center dark:border-[#44454D] dark:bg-[#17181D]">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#F4F4F5] text-[#737373] dark:bg-[#292A30] dark:text-[#A1A1AA]"><Wifi size={18} /></div><p className="text-sm font-medium">Seat layout is not configured</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#737373] dark:text-[#A1A1AA]">Add the real seat positions for this area to show live empty-seat counts.</p>
                  </div>}

                  {selectedSeat && <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-[#E5E5E5] p-3 sm:flex-row sm:items-center dark:border-[#33343B]">
                    <div><p className="text-sm font-medium">Seat {selectedSeat.seat_number}</p><p className="text-xs text-[#737373] dark:text-[#A1A1AA]">{selectedSeat.occupied ? selectedSeat.occupied_by_me ? 'Marked occupied by you on this device' : 'Already marked occupied' : 'Marked empty'}</p></div>
                    <button onClick={() => void markSeat()} disabled={saving || Boolean(selectedSeat.occupied && !selectedSeat.occupied_by_me) || Boolean(!selectedSeat.occupied && activeOccupancy && activeOccupancy.seatId !== selectedSeat.id)} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60 ${selectedSeat.occupied ? 'bg-[#52525B] hover:bg-[#3F3F46]' : 'bg-[#EA580C] hover:bg-[#C2410C]'}`}>
                      {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}{selectedSeat.occupied ? selectedSeat.occupied_by_me ? 'I’ve left this seat' : 'Occupied by another student' : activeOccupancy ? 'Check out of your current seat first' : 'I’m using this seat'}
                    </button>
                  </div>}
                </section>}
              </div>
            </>}
            {lastUpdated && <p className="mt-5 text-right text-[11px] text-[#737373] dark:text-[#A1A1AA]">Last refreshed {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>}
          </>
        )}

        <footer className="mt-10 border-t border-[#E5E5E5] pt-6 dark:border-[#33343B]">
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[#E5E5E5] bg-white p-5 sm:flex-row sm:items-center dark:border-[#33343B] dark:bg-[#202127]">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#EA580C] dark:bg-orange-950/30"><MessageSquareText size={18} /></span>
              <div><h2 className="text-sm font-semibold">Help us improve Seat Safari</h2><p className="mt-1 text-xs leading-5 text-[#737373] dark:text-[#A1A1AA]">Share a suggestion, report a problem, or tell us what could work better.</p></div>
            </div>
            <button onClick={openFeedback} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#EA580C] px-4 text-sm font-semibold text-white transition hover:bg-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#EA580C] focus:ring-offset-2 dark:focus:ring-offset-[#202127]">
              <MessageSquareText size={16} /> Send feedback
            </button>
          </div>
        </footer>
      </main>
    </div>
    {feedbackOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget && !feedbackSubmitting) setFeedbackOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="feedback-title" aria-describedby="feedback-description" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-2xl sm:p-7 dark:border-[#33343B] dark:bg-[#202127]">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#EA580C] dark:bg-orange-950/30"><MessageSquareText size={18} /></span>
            <div><h2 id="feedback-title" className="text-lg font-semibold tracking-tight">{feedbackSubmitted ? 'Thank you for sharing' : 'Help us improve Seat Safari'}</h2><p id="feedback-description" className="mt-1 text-sm leading-5 text-[#737373] dark:text-[#A1A1AA]">{feedbackSubmitted ? 'Your feedback has been received.' : 'Tell us about a suggestion, complaint, or issue.'}</p></div>
          </div>
          <button onClick={() => setFeedbackOpen(false)} disabled={feedbackSubmitting} aria-label="Close feedback" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#737373] transition hover:bg-[#F4F4F5] hover:text-[#171717] disabled:opacity-50 dark:text-[#A1A1AA] dark:hover:bg-[#292A30] dark:hover:text-white"><X size={18} /></button>
        </header>

        {feedbackSubmitted ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-900 dark:bg-emerald-950/25">
          <CheckCircle2 size={30} className="mx-auto text-emerald-600 dark:text-emerald-400" />
          <p className="mt-3 text-sm font-semibold">Thanks for helping us make this better.</p>
          <p className="mt-1 text-xs leading-5 text-[#737373] dark:text-[#A1A1AA]">Your message was saved successfully.</p>
          <button onClick={() => setFeedbackOpen(false)} className="mt-5 min-h-10 rounded-lg bg-[#EA580C] px-5 text-sm font-semibold text-white hover:bg-[#C2410C]">Done</button>
        </div> : <form onSubmit={(event) => void submitFeedback(event)}>
          {selectedSeat && <p className="mb-4 rounded-lg bg-[#F8F8F8] px-3 py-2 text-xs text-[#52525B] dark:bg-[#292A30] dark:text-[#D4D4D8]">About {selectedSpace?.name}, seat {selectedSeat.seat_number}</p>}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-[#52525B] dark:text-[#D4D4D8]">What would you like to share?</legend>
            <div role="radiogroup" aria-label="Feedback type" className="grid grid-cols-2 gap-2">
              {feedbackCategories.map((category) => <button key={category.id} type="button" role="radio" aria-checked={feedbackCategory === category.id} onClick={() => setFeedbackCategory(category.id)} className={`min-h-10 rounded-lg border px-3 text-left text-xs font-medium transition ${feedbackCategory === category.id ? 'border-[#EA580C] bg-orange-50 text-[#C2410C] ring-1 ring-[#EA580C] dark:bg-orange-950/25 dark:text-orange-200' : 'border-[#E5E5E5] text-[#52525B] hover:bg-[#F8F8F8] dark:border-[#3F4048] dark:text-[#D4D4D8] dark:hover:bg-[#292A30]'}`}>{category.label}</button>)}
            </div>
          </fieldset>
          <label htmlFor="feedback-message" className="mt-5 block text-xs font-semibold text-[#52525B] dark:text-[#D4D4D8]">Your message</label>
          <textarea id="feedback-message" autoFocus rows={5} minLength={10} maxLength={2000} required value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} placeholder="Tell us what happened or what you’d like to see…" className="mt-2 w-full resize-y rounded-xl border border-[#D4D4D8] bg-white px-3.5 py-3 text-sm leading-6 outline-none transition placeholder:text-[#A1A1AA] focus:border-[#EA580C] focus:ring-2 focus:ring-orange-100 dark:border-[#44454D] dark:bg-[#17181D] dark:focus:ring-orange-950/40" />
          <div className="mt-1 flex items-start justify-between gap-3"><p className="text-[11px] leading-4 text-[#737373] dark:text-[#A1A1AA]">Please don’t include passwords or sensitive personal information.</p><span className="shrink-0 text-[11px] tabular-nums text-[#737373] dark:text-[#A1A1AA]">{feedbackMessage.length}/2000</span></div>
          {feedbackError && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{feedbackError}</p>}
          <div className="mt-5 flex justify-end gap-2 border-t border-[#E5E5E5] pt-4 dark:border-[#33343B]">
            <button type="button" onClick={() => setFeedbackOpen(false)} disabled={feedbackSubmitting} className="min-h-10 rounded-lg border border-[#E5E5E5] px-4 text-sm font-medium text-[#52525B] hover:bg-[#F8F8F8] disabled:opacity-50 dark:border-[#3F4048] dark:text-[#D4D4D8] dark:hover:bg-[#292A30]">Not now</button>
            <button type="submit" disabled={feedbackSubmitting || feedbackMessage.trim().length < 10} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#EA580C] px-4 text-sm font-semibold text-white transition hover:bg-[#C2410C] disabled:cursor-not-allowed disabled:opacity-50">{feedbackSubmitting ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}{feedbackSubmitting ? 'Sending…' : 'Send feedback'}</button>
          </div>
        </form>}
      </section>
    </div>}
    {selectedSpace && <div className="qr-print-only">
      <header className="mb-5 border-b border-black pb-3"><h1 className="text-2xl font-bold">Seat Safari · {selectedBuilding?.name}</h1><p>{selectedFloor?.name} · {selectedSpace.name}</p><p className="text-sm">Scan a seat code to mark it occupied or check out.</p></header>
      <div className="qr-label-grid">{selectedSpace.seats.filter((seat) => !seat.is_blocked).map((seat) => <div key={seat.id} className="qr-label"><QRCodeSVG value={seatQrUrl(seat.id)} size={92} level="M" /><strong>Seat {seat.seat_number}</strong><span>{selectedBuilding?.name}</span><span>{selectedSpace.name}</span></div>)}</div>
    </div>}
    </>
  );
}

export const OccupancyPage: React.FC = () => <OccupancyApp />;
