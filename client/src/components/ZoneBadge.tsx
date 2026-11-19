import React from 'react';
import { VolumeX, Users, Layers } from 'lucide-react';
import type { ZoneType } from '../types';

interface ZoneBadgeProps {
  zone: ZoneType;
  size?: 'sm' | 'md';
  showRule?: boolean;
  ruleText?: string;
  className?: string;
}

export const ZoneBadge: React.FC<ZoneBadgeProps> = ({
  zone,
  size = 'md',
  showRule = false,
  ruleText,
  className = '',
}) => {
  const configs = {
    Quiet: {
      bg: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
      icon: VolumeX,
      label: 'Quiet Zone',
      defaultRule: 'Quiet: No talking nearby. Whispers only if essential.',
    },
    Discussion: {
      bg: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
      icon: Users,
      label: 'Discussion Zone',
      defaultRule: 'Discussion: Collaborative talk and group discussion welcome.',
    },
    Flexible: {
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
      icon: Layers,
      label: 'Flexible Zone',
      defaultRule: 'Flexible: Adaptable seating and moderate conversational study.',
    },
  };

  const config = configs[zone] || configs.Flexible;
  const Icon = config.icon;

  return (
    <div className={`inline-flex flex-col gap-1 items-start ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-md border ${config.bg} ${
          size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
        }`}
      >
        <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span>{config.label}</span>
      </span>

      {showRule && (
        <p className="text-xs text-slate-600 dark:text-slate-400 font-normal mt-0.5">
          {ruleText || config.defaultRule}
        </p>
      )}
    </div>
  );
};
