import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, Clock } from 'lucide-react';
import type { LatestReport } from '../types';

interface StatusBadgeProps {
  latestReport?: LatestReport | null;
  busyNote?: string;
  size?: 'sm' | 'md';
  showAge?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  latestReport,
  busyNote,
  size = 'md',
  showAge = true,
  className = '',
}) => {
  if (!latestReport) {
    return (
      <div className={`inline-flex flex-col gap-0.5 items-start ${className}`}>
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-md border border-slate-200 dark:border-slate-700/80 bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 ${
            size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <Clock className={size === 'sm' ? 'w-3 h-3 text-slate-400' : 'w-3.5 h-3.5 text-slate-400'} />
          <span>No recent report</span>
        </span>
        {busyNote && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
            Usual: {busyNote}
          </span>
        )}
      </div>
    );
  }

  const { status, age_text } = latestReport;

  // Status mapping:
  // 'Free' -> 'Available'
  // 'Filling up' -> 'Limited Availability'
  // 'Full' -> 'Full'
  const config = {
    Free: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-800/80',
      text: 'text-emerald-700 dark:text-emerald-300',
      icon: CheckCircle2,
      label: 'Available',
    },
    'Filling up': {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-800/80',
      text: 'text-amber-700 dark:text-amber-300',
      icon: AlertCircle,
      label: 'Limited Availability',
    },
    Full: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200 dark:border-rose-800/80',
      text: 'text-rose-700 dark:text-rose-300',
      icon: XCircle,
      label: 'Full',
    },
  }[status] || {
    bg: 'bg-slate-100 dark:bg-slate-800',
    border: 'border-slate-200 dark:border-slate-700',
    text: 'text-slate-700 dark:text-slate-300',
    icon: Clock,
    label: status,
  };

  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-md border ${config.bg} ${config.border} ${config.text} ${
          size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
        }`}
      >
        <Icon className={size === 'sm' ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
        <span>{config.label}</span>
      </span>

      {showAge && age_text && (
        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
          {age_text}
        </span>
      )}
    </div>
  );
};
