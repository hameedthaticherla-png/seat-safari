import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, ChevronRight, Sparkles } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export const Navbar: React.FC = () => {
  const { role, quickSwitchPersona } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  // Helper to determine breadcrumb title
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Find Study Spaces';
    if (path.startsWith('/spaces/') && path.endsWith('/plan-b')) return 'Alternative Spaces';
    if (path.startsWith('/spaces/')) return 'Space Overview';
    if (path === '/holds') return 'Room Reservations & Holds';
    if (path === '/favourites') return 'Saved Spaces';
    if (path === '/login') return 'Authentication';
    if (path === '/profile') return 'Account & Permissions';
    if (path === '/staff') return 'Staff Operations Dashboard';
    if (path === '/staff/spaces') return 'Space Inventory Management';
    if (path === '/staff/reports') return 'Availability Reports Moderation';
    if (path === '/staff/holds') return 'Room Holds Management';
    if (path === '/staff/signs') return 'Printable Zone Signage';
    if (path === '/staff/audit') return 'System Audit Trail';
    if (path === '/staff/settings') return 'Configuration Settings';
    if (path === '/403') return 'Access Denied';
    return 'Seat Safari';
  };

  return (
    <header className="h-14 border-b border-[#E5E5E5] dark:border-[#33343B] bg-white/95 dark:bg-[#202127]/95 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between no-print">
      {/* Left: Mobile Brand / Desktop Breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Mobile Brand Link (visible < lg) */}
        <Link to="/" className="flex items-center lg:hidden">
          <BrandLogo size="sm" showSubtitle={false} />
        </Link>

        {/* Desktop Breadcrumb (visible >= lg) */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#737373] dark:text-[#A1A1AA]">
          <Link to="/" className="hover:text-[#171717] dark:hover:text-[#F5F5F5] transition-colors font-medium">
            Seat Safari
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#737373] dark:text-[#A1A1AA]" />
          <span className="font-semibold text-[#171717] dark:text-[#F5F5F5]">
            {getPageTitle()}
          </span>
        </div>
      </div>

      {/* Right: Quick Role Switcher (Evaluation Helper) & Theme Toggle */}
      <div className="flex items-center gap-2">
        {/* Discrete Demo Role Switcher for evaluation */}
        <div className="hidden sm:flex items-center bg-[#F4F4F5] dark:bg-[#292A30] p-0.5 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] text-[11px] font-medium text-[#737373] dark:text-[#A1A1AA]">
          <span className="px-2 text-[10px] text-[#737373] dark:text-[#A1A1AA] font-mono flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-[#EA580C] dark:text-[#F97316]" />
            Role:
          </span>
          <button
            onClick={() => quickSwitchPersona('guest')}
            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
              role === 'guest'
                ? 'bg-white dark:bg-[#202127] text-[#171717] dark:text-[#F5F5F5] font-semibold shadow-xs'
                : 'hover:text-[#171717] dark:hover:text-[#F5F5F5]'
            }`}
          >
            Guest
          </button>
          <button
            onClick={() => quickSwitchPersona('student')}
            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
              role === 'student'
                ? 'bg-white dark:bg-[#202127] text-[#171717] dark:text-[#F5F5F5] font-semibold shadow-xs'
                : 'hover:text-[#171717] dark:hover:text-[#F5F5F5]'
            }`}
          >
            Student
          </button>
          <button
            onClick={() => quickSwitchPersona('staff')}
            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
              role === 'staff'
                ? 'bg-white dark:bg-[#202127] text-[#171717] dark:text-[#F5F5F5] font-semibold shadow-xs'
                : 'hover:text-[#171717] dark:hover:text-[#F5F5F5]'
            }`}
          >
            Staff
          </button>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-[#737373] hover:text-[#171717] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5] hover:bg-[#F4F4F5] dark:hover:bg-[#292A30] transition-colors cursor-pointer"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#171717]" />}
        </button>

        {/* User Account Button (Mobile) */}
        <Link
          to={role === 'guest' ? '/login' : '/profile'}
          className="lg:hidden p-1.5 rounded-lg text-[#737373] hover:text-[#171717] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5] hover:bg-[#F4F4F5] dark:hover:bg-[#292A30] transition-colors flex items-center gap-1.5"
          aria-label="Account"
        >
          <div className="w-6 h-6 rounded-full bg-[#E5E5E5] dark:bg-[#292A30] flex items-center justify-center text-[10px] font-bold text-[#171717] dark:text-[#F5F5F5]">
            {role === 'staff' ? 'S' : role === 'student' ? 'U' : 'G'}
          </div>
        </Link>
      </div>
    </header>
  );
};
