import React from 'react';
import { Zap, Sun, Monitor, Users, Ban, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Seat, SpaceTable } from '../../types';

interface SeatMapProps {
  seats: Seat[];
  tables?: SpaceTable[];
  selectedSeatId: string | null;
  onSelectSeat: (seat: Seat) => void;
  frontLabel?: string;
  layoutType?: string;
  isLoading?: boolean;
}

export const SeatMap: React.FC<SeatMapProps> = ({
  seats,
  tables = [],
  selectedSeatId,
  onSelectSeat,
  frontLabel = 'FRONT OF ROOM / PRESENTATION WALL',
  layoutType = 'grid',
  isLoading = false,
}) => {
  // Group seats by table or by row
  const tableMap = new Map<string, SpaceTable>();
  tables.forEach((t) => tableMap.set(t.id, t));

  // Determine row labels
  const rows = Array.from(new Set(seats.map((s) => s.row_label || 'A'))).sort();

  const getSeatIcon = (seat: Seat) => {
    if (seat.seat_type === 'group_room') {
      return <Users className="w-4 h-4" />;
    }
    if (seat.facilities.includes('computer') || seat.facilities.includes('monitor')) {
      return <Monitor className="w-3.5 h-3.5" />;
    }
    if (seat.facilities.includes('power') || seat.facilities.includes('socket')) {
      return <Zap className="w-3.5 h-3.5" />;
    }
    if (seat.facilities.includes('window')) {
      return <Sun className="w-3.5 h-3.5" />;
    }
    return null;
  };

  const getSeatStatus = (seat: Seat) => {
    if (seat.id === selectedSeatId) return 'selected';
    if (seat.is_blocked) return 'blocked';
    if (seat.status === 'booked') return 'booked';
    if (seat.status === 'held') return 'held';
    return 'available';
  };

  const renderSeat = (seat: Seat) => {
    const status = getSeatStatus(seat);
    const isSelected = status === 'selected';
    const isAvailable = status === 'available';
    const isHeld = status === 'held';
    const isBooked = status === 'booked';
    const isBlocked = status === 'blocked';

    // Styling based on state matching BookMyShow and Seat Safari Orange + Dark theme
    let statusClasses = '';
    if (isSelected) {
      statusClasses =
        'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/30 scale-105 ring-2 ring-orange-400 ring-offset-2 dark:ring-offset-[#111318] z-10';
    } else if (isBlocked) {
      statusClasses =
        'bg-rose-500/10 text-rose-400/60 border-rose-500/20 cursor-not-allowed opacity-60';
    } else if (isBooked) {
      statusClasses =
        'bg-zinc-200 dark:bg-zinc-800/80 text-zinc-400 dark:text-zinc-600 border-zinc-300 dark:border-zinc-700/50 cursor-not-allowed';
    } else if (isHeld) {
      statusClasses = seat.held_by_me
        ? 'bg-amber-500/20 text-amber-500 border-amber-500 animate-pulse cursor-pointer ring-1 ring-amber-400'
        : 'bg-amber-500/10 text-amber-400/50 border-amber-500/30 cursor-not-allowed opacity-70';
    } else {
      // Available
      statusClasses =
        'bg-white dark:bg-[#202127] text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-[#33343B] hover:border-orange-500 hover:text-orange-500 dark:hover:border-orange-500 dark:hover:text-orange-400 hover:shadow-md cursor-pointer transition-all active:scale-95';
    }

    const tooltipText = isBlocked
      ? `Seat ${seat.seat_number}: Blocked (${seat.block_reason || 'Maintenance'})`
      : isBooked
      ? `Seat ${seat.seat_number}: Already Reserved`
      : isHeld
      ? seat.held_by_me
        ? `Seat ${seat.seat_number}: Held by you (${seat.held_seconds_remaining || 300}s left)`
        : `Seat ${seat.seat_number}: Temporarily held by another student`
      : isSelected
      ? `Seat ${seat.seat_number}: Selected`
      : `Seat ${seat.seat_number}: Available • Click to reserve`;

    const isGroupRoom = seat.seat_type === 'group_room';

    if (isGroupRoom) {
      return (
        <button
          key={seat.id}
          type="button"
          onClick={() => (isAvailable || isSelected || (isHeld && seat.held_by_me)) && onSelectSeat(seat)}
          disabled={isBooked || isBlocked || (isHeld && !seat.held_by_me)}
          title={tooltipText}
          aria-label={tooltipText}
          className={`relative p-5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${statusClasses} w-full max-w-sm`}
        >
          <div className="flex items-center gap-2 font-semibold text-base">
            <Users className="w-5 h-5 text-orange-500" />
            <span>Entire Group Room ({seat.seat_number})</span>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-3">
            <span>Capacity: 6-8 people</span>
            <span>•</span>
            <span>Whiteboard</span>
            <span>•</span>
            <span>Display Screen</span>
          </div>
          {isSelected && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-orange-600 px-2.5 py-0.5 rounded-full mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Selected Room
            </span>
          )}
        </button>
      );
    }

    return (
      <button
        key={seat.id}
        type="button"
        onClick={() => (isAvailable || isSelected || (isHeld && seat.held_by_me)) && onSelectSeat(seat)}
        disabled={isBooked || isBlocked || (isHeld && !seat.held_by_me)}
        title={tooltipText}
        aria-label={tooltipText}
        className={`group relative flex flex-col items-center justify-center w-12 h-13 sm:w-13 sm:h-14 rounded-lg border text-xs font-semibold transition-all ${statusClasses}`}
      >
        <span className="leading-none">{seat.seat_number}</span>
        
        {/* Facility Indicator Icons */}
        <div className="flex items-center gap-0.5 mt-1 opacity-80 group-hover:opacity-100">
          {getSeatIcon(seat)}
        </div>

        {/* Status mini indicator */}
        {isBlocked && (
          <Ban className="absolute -top-1.5 -right-1.5 w-4 h-4 text-rose-500 bg-white dark:bg-[#111318] rounded-full p-0.5 shadow" />
        )}
        {isHeld && (
          <Clock className="absolute -top-1.5 -right-1.5 w-4 h-4 text-amber-500 bg-white dark:bg-[#111318] rounded-full p-0.5 shadow" />
        )}
      </button>
    );
  };

  // Check if this space is a group room or table/row layout
  const isAllGroupRooms = seats.length > 0 && seats.every((s) => s.seat_type === 'group_room');

  return (
    <div className="w-full bg-[#F8F8F8] dark:bg-[#16181F] rounded-2xl border border-[#E5E5E5] dark:border-[#33343B] p-4 sm:p-8 overflow-hidden">
      {/* Curved Screen / Orientation Indicator (BookMyShow Style) */}
      <div className="relative mb-10 max-w-lg mx-auto text-center">
        <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-orange-500/70 to-transparent rounded-full shadow-[0_0_12px_rgba(249,115,22,0.4)]" />
        <div className="pt-2 text-[11px] font-semibold tracking-widest text-zinc-500 dark:text-zinc-400 uppercase">
          {frontLabel}
        </div>
      </div>

      {/* Main Seat Matrix Viewport */}
      <div className="overflow-x-auto pb-4 pt-2 flex justify-center">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading seat map and live availability...</span>
          </div>
        ) : seats.length === 0 ? (
          <div className="py-16 text-center text-zinc-400">
            <ShieldAlert className="w-10 h-10 mx-auto mb-2 text-zinc-500" />
            <p className="font-medium">No reserved seating configured for this space</p>
            <p className="text-xs text-zinc-500 mt-1">This space operates on walk-in free seating.</p>
          </div>
        ) : isAllGroupRooms ? (
          <div className="flex flex-col gap-4 items-center justify-center w-full py-6">
            {seats.map(renderSeat)}
          </div>
        ) : tables.length > 0 ? (
          /* Table-Based Layout */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start min-w-[320px] max-w-4xl w-full">
            {tables.map((table) => {
              const tableSeats = seats.filter((s) => s.table_id === table.id);
              if (tableSeats.length === 0) return null;

              return (
                <div
                  key={table.id}
                  className="bg-white dark:bg-[#202127]/60 border border-[#E5E5E5] dark:border-[#33343B] rounded-xl p-4 flex flex-col items-center relative shadow-sm"
                >
                  <div className="text-xs font-semibold text-[#737373] dark:text-[#A1A1AA] mb-3 tracking-wide flex items-center justify-between w-full">
                    <span>{table.label}</span>
                    <span className="text-[10px] text-[#737373] dark:text-[#A1A1AA] font-normal">Cap: {table.capacity}</span>
                  </div>

                  {/* Visual Table Surface */}
                  <div className="w-full bg-[#F4F4F5] dark:bg-[#292A30] rounded-lg p-3 flex flex-wrap gap-2.5 items-center justify-center border border-[#E5E5E5] dark:border-[#33343B]/80 min-h-[90px]">
                    {tableSeats.map(renderSeat)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Row / Grid Based Layout */
          <div className="flex flex-col gap-3 min-w-[340px]">
            {rows.map((rowLabel) => {
              const rowSeats = seats
                .filter((s) => (s.row_label || 'A') === rowLabel)
                .sort((a, b) => a.col_index - b.col_index);

              return (
                <div key={rowLabel} className="flex items-center gap-3">
                  {/* Row Indicator */}
                  <div className="w-6 text-center font-bold text-xs text-zinc-400 dark:text-zinc-500 select-none">
                    {rowLabel}
                  </div>

                  {/* Seat Grid with Aisle Breaks */}
                  <div className="flex items-center gap-2">
                    {rowSeats.map((seat, idx) => {
                      // Visual aisle spacer after every 3 seats if more than 5 seats
                      const hasAisle = rowSeats.length > 5 && idx > 0 && idx % 3 === 0;
                      return (
                        <React.Fragment key={seat.id}>
                          {hasAisle && <div className="w-5" aria-hidden="true" />}
                          {renderSeat(seat)}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Right Row Indicator for large displays */}
                  <div className="w-6 text-center font-bold text-xs text-zinc-400 dark:text-zinc-500 select-none hidden sm:block">
                    {rowLabel}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BookMyShow Style Visual Legend */}
      <div className="mt-8 pt-6 border-t border-[#E5E5E5] dark:border-[#33343B] flex flex-wrap items-center justify-center gap-y-3 gap-x-6 text-xs text-[#737373] dark:text-[#A1A1AA]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127]" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-500 border border-orange-500 text-white" />
          <span className="font-semibold text-orange-600 dark:text-orange-400">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-amber-500/20 border border-amber-500" />
          <span>Held (5m)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700" />
          <span>Reserved</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
            <Ban className="w-3 h-3" />
          </div>
          <span>Maintenance</span>
        </div>
        <div className="h-4 w-[1px] bg-zinc-300 dark:bg-zinc-700 hidden sm:block" />
        <div className="flex items-center gap-1.5 text-zinc-500">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>AC Power</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-500">
          <Sun className="w-3.5 h-3.5 text-sky-400" />
          <span>Window View</span>
        </div>
      </div>
    </div>
  );
};
