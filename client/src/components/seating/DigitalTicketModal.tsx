import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  MapPin,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Download,
  Share2,
  ArrowRight,
  ShieldCheck,
  Ban,
  Sparkles,
} from 'lucide-react';
import { SeatReservation } from '../../types';
import { BrandLogo } from '../BrandLogo';

interface DigitalTicketModalProps {
  reservation: SeatReservation | null;
  isOpen: boolean;
  onClose: () => void;
  onCheckIn?: (id: string) => Promise<void>;
  onCancel?: (id: string) => Promise<void>;
}

export const DigitalTicketModal: React.FC<DigitalTicketModalProps> = ({
  reservation,
  isOpen,
  onClose,
  onCheckIn,
  onCancel,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!isOpen || !reservation) return null;

  const handleCheckIn = async () => {
    if (!onCheckIn) return;
    setIsProcessing(true);
    try {
      await onCheckIn(reservation.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!onCancel) return;
    setIsProcessing(true);
    try {
      await onCancel(reservation.id);
      setConfirmCancel(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const formattedDate = new Date(`${reservation.reservation_date}T00:00:00`).toLocaleDateString(
    'en-US',
    {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  );

  const isCheckedIn = reservation.status === 'checked_in';
  const isCancelled = reservation.status === 'cancelled';
  const isExpired = reservation.status === 'expired' || reservation.status === 'no_show';
  const isConfirmed = reservation.status === 'confirmed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-[#202127] border border-[#E5E5E5] dark:border-[#33343B] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-zinc-100 dark:bg-[#292A30] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Ticket Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="scale-90 mb-1">
              <BrandLogo size="sm" showSubtitle={false} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-orange-100">
              Campus Seat Pass
            </span>
            <h2 className="text-xl font-extrabold tracking-tight mt-0.5">
              {reservation.booking_reference}
            </h2>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md">
              {isCheckedIn ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Checked In
                </>
              ) : isCancelled ? (
                <>
                  <Ban className="w-3.5 h-3.5" /> Cancelled
                </>
              ) : isExpired ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" /> No Show / Expired
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" /> Confirmed Reservation
                </>
              )}
            </div>
          </div>
        </div>

        {/* Perforated Divider Bar with Half Circles */}
        <div className="relative flex items-center justify-between px-2 bg-white dark:bg-[#202127]">
          <div className="w-5 h-5 -ml-4 rounded-full bg-black/70" />
          <div className="flex-1 border-t-2 border-dashed border-zinc-200 dark:border-[#33343B] mx-2" />
          <div className="w-5 h-5 -mr-4 rounded-full bg-black/70" />
        </div>

        {/* Ticket Body with QR Code and Details */}
        <div className="p-6 flex flex-col items-center flex-1 overflow-y-auto max-h-[70vh]">
          {/* QR Code Container */}
          <div className="p-4 bg-white rounded-2xl border-2 border-zinc-200 shadow-inner flex flex-col items-center mb-6">
            <QRCodeSVG
              value={reservation.qr_code_token || reservation.booking_reference}
              size={160}
              level="H"
              includeMargin={false}
              fgColor="#111318"
            />
            <span className="text-[10px] font-mono font-medium text-zinc-500 mt-2 tracking-wider">
              Scan at Space Entrance
            </span>
          </div>

          {/* Location & Seat Details Grid */}
          <div className="w-full bg-zinc-50 dark:bg-[#202127] rounded-2xl p-4 border border-zinc-200/80 dark:border-[#33343B] space-y-3 text-xs">
            <div className="flex justify-between items-start border-b border-zinc-200/60 dark:border-[#33343B]/60 pb-2.5">
              <span className="text-zinc-500 dark:text-zinc-400">Space & Location</span>
              <div className="text-right">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
                  {reservation.space_name}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                  {reservation.building_name || 'Campus'} &bull; {reservation.floor_name || 'Floor'}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center border-b border-zinc-200/60 dark:border-[#33343B]/60 pb-2.5">
              <span className="text-zinc-500 dark:text-zinc-400">Reserved Seat</span>
              <span className="font-bold text-base text-orange-600 dark:text-orange-400">
                Seat {reservation.seat_number}
                {reservation.table_label ? ` (${reservation.table_label})` : ''}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-zinc-200/60 dark:border-[#33343B]/60 pb-2.5">
              <span className="text-zinc-500 dark:text-zinc-400">Date</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {formattedDate}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-zinc-500 dark:text-zinc-400">Time Window</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                {reservation.start_time} – {reservation.end_time}
              </span>
            </div>
          </div>

          {/* Policy / Check-in Warning Notice */}
          {isConfirmed && !isCheckedIn && (
            <div className="mt-4 w-full bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">15-Minute Arrival Window:</span> You must arrive and
                check in within 15 minutes of {reservation.start_time}, or this seat will be released
                to walk-in students.
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 w-full space-y-2">
            {isConfirmed && !isCheckedIn && onCheckIn && (
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold text-sm shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isProcessing ? 'Checking in...' : 'Check In to Seat'}</span>
              </button>
            )}

            {isConfirmed && !isCheckedIn && onCancel && (
              <>
                {!confirmCancel ? (
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(true)}
                    className="w-full py-2 px-4 rounded-xl border border-zinc-200 dark:border-[#33343B] text-zinc-500 hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-900/50 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel Reservation
                  </button>
                ) : (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-2">
                    <p className="text-xs text-rose-500 font-medium text-center">
                      Are you sure? This seat will be made available to others immediately.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmCancel(false)}
                        className="flex-1 py-1.5 rounded-lg border border-zinc-200 dark:border-[#33343B] text-xs font-medium"
                      >
                        Keep Seat
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isProcessing}
                        className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        {isProcessing ? 'Cancelling...' : 'Yes, Cancel'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
