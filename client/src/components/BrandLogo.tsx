import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
}) => {
  const containerSizes = {
    sm: 'w-7 h-7 rounded-md',
    md: 'w-8 h-8 rounded-lg',
    lg: 'w-10 h-10 rounded-xl',
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  const titleSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Modern Location Pin Mark */}
      <div
        className={`${containerSizes} bg-[#EA580C] dark:bg-[#F97316] text-white flex items-center justify-center shadow-xs shrink-0 transition-transform hover:scale-105`}
      >
        <svg
          className={iconSizes}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
          <circle cx="12" cy="10" r="3" fill="currentColor" />
        </svg>
      </div>

      {/* Wordmark */}
      <div className="flex flex-col min-w-0">
        <span
          className={`font-bold ${titleSizes} text-[#171717] dark:text-[#F5F5F5] tracking-tight leading-tight truncate`}
        >
          Seat Safari
        </span>
        {showSubtitle && (
          <span className="text-[10px] text-[#737373] dark:text-[#A1A1AA] font-medium leading-none truncate">
            Campus Study Spaces
          </span>
        )}
      </div>
    </div>
  );
};
