import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-[#E5E5E5] dark:border-[#33343B] bg-white/60 dark:bg-[#202127]/60 ${className}`}>
      <div className="w-10 h-10 rounded-full bg-[#F4F4F5] dark:bg-[#292A30] flex items-center justify-center text-[#737373] dark:text-[#A1A1AA] mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5] mb-1">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA] max-w-sm mb-4 leading-normal">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
};
