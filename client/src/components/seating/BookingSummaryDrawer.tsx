import React, { useEffect, useState } from 'react';
import { ArrowRight, Clock, MapPin, Zap, ShieldCheck, AlertCircle } from 'lucide-react';
import { Seat, Space, Building, Floor } from '../../types';

interface BookingSummaryDrawerProps {
  selectedSeat: Seat | null;
  space: Space | null;
  building: Building | null;
  floor: Floor | null;
  date: string;
  startTime: string;
  endTime: string;
  holdExpiresAt?: string | null;
  onProceed: () => void;
  onClearSeat: () => void;
  isSubmitting?: boolean;
}

export const BookingSummaryDrawer: React.FC<BookingSummaryDrawerProps> = ({
  selectedSeat,
  space,
  building,
  floor,
  date,
  startTime,
  endTime,
  holdExpiresAt,
  onProceed,
  onClearSeat,
  isSubmitting = false,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!holdExpiresAt) {
      setSecondsLeft(null);
      return;
    }

    const calcTime = () => {
      const exp = new Date(holdExpiresAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((exp - now) / 1000));
      setSecondsLeft(diff);
      return diff;
    };

    calcTime();
    const interval = setInterval(() => {
      const remaining = calcTime();
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [holdExpiresAt]);

  if (!selectedSeat || !space) return null;

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#202127]/95 backdrop-blur-md border-t border-[#E5E5E5] dark:border-[#33343B] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Left: Location & Seat Details */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex flex-col items-center justify-center font-bold">
                <span className="text-[10px] uppercase font-semibold leading-none text-zinc-500 dark:text-zinc-400">Seat</span>
                <span className="text-base leading-none mt-0.5">{selectedSeat.seat_number}</span>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>
                    {building?.name || 'Campus'} &bull; {floor?.name || 'Floor'}
                  </span>
                </div>
                <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm sm:text-base">
                  {space.name}
                  {selectedSeat.table_label && (
                    <span className="text-zinc-500 dark:text-zinc-400 font-normal text-xs ml-1.5">
                      ({selectedSeat.table_label})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="h-8 w-[1px] bg-zinc-200 dark:bg-[#33343B] hidden sm:block" />

            {/* Time & Hold Status */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-300">
              <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-[#202127] px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-[#33343B]">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-medium">
                  {formattedDate} &bull; {startTime} – {endTime}
                </span>
              </div>

              {secondsLeft !== null && (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono font-semibold text-xs ${
                    secondsLeft <= 60
                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 animate-pulse'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Held: {formatTimer(secondsLeft)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 self-end md:self-auto w-full md:w-auto">
            <button
              type="button"
              onClick={onClearSeat}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-[#33343B] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#202127] text-xs font-semibold transition-colors"
            >
              Deselect
            </button>

            <button
              type="button"
              onClick={onProceed}
              disabled={isSubmitting || secondsLeft === 0}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold text-sm shadow-md shadow-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>{isSubmitting ? 'Confirming...' : 'Review & Confirm'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
