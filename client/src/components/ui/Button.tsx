import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className = '', 
    variant = 'primary', 
    size = 'md', 
    loading = false, 
    disabled, 
    icon, 
    children, 
    ...props 
  }, ref) => {
    
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer';

    const variants = {
      primary: 'bg-[#EA580C] hover:bg-[#C2410C] active:bg-[#9A3412] dark:bg-[#F97316] dark:hover:bg-[#EA580C] text-white shadow-xs',
      secondary: 'bg-[#F4F4F5] text-[#171717] hover:bg-[#E5E5E5] active:bg-[#D4D4D8] dark:bg-[#292A30] dark:text-[#F5F5F5] dark:hover:bg-[#33343B]',
      outline: 'border border-[#E5E5E5] bg-white text-[#171717] hover:bg-[#F8F8F8] dark:border-[#33343B] dark:bg-[#202127] dark:text-[#F5F5F5] dark:hover:bg-[#292A30] shadow-xs',
      ghost: 'text-[#737373] hover:text-[#171717] hover:bg-[#F4F4F5] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5] dark:hover:bg-[#292A30]',
      danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-xs',
      success: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-xs',
    };

    const sizes = {
      sm: 'h-8 px-2.5 text-xs gap-1.5 min-h-[36px] sm:min-h-0',
      md: 'h-9 px-3.5 text-xs sm:text-sm gap-2 min-h-[44px] sm:min-h-0',
      lg: 'h-11 px-5 text-sm gap-2.5 min-h-[44px]',
      icon: 'h-9 w-9 p-0 min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
