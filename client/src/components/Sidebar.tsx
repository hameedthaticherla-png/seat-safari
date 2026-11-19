import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { 
  Compass, Bookmark, CalendarClock, LayoutDashboard, 
  Building2, MessageSquare, Printer, History, 
  Settings, LogOut, Sun, Moon, User, LayoutGrid, Ticket, Armchair
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { BrandLogo } from './BrandLogo';

export const Sidebar: React.FC = () => {
  const { user, role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
      isActive
        ? 'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 font-semibold'
        : 'text-[#737373] hover:text-[#171717] hover:bg-[#F4F4F5] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5] dark:hover:bg-[#292A30]'
    }`;

  return (
    <aside className="hidden lg:flex w-64 border-r border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] flex-col shrink-0 min-h-screen sticky top-0 select-none no-print">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-[#E5E5E5] dark:border-[#33343B] flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <BrandLogo size="md" />
        </Link>
      </div>

      {/* Nav Content */}
      <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {/* Discovery Section */}
        <div>
          <div className="px-3 pb-2 text-[10px] font-semibold text-[#737373] dark:text-[#A1A1AA] uppercase tracking-wider">
            Discovery
          </div>
          <nav className="space-y-0.5">
            <NavLink to="/" className={navItemClass} end>
              <Compass className="w-4 h-4 shrink-0" />
              <span>Find Spaces</span>
            </NavLink>
            <NavLink to="/book" className={navItemClass}>
              <Armchair className="w-4 h-4 shrink-0 text-orange-500" />
              <span>Reserve Seats</span>
            </NavLink>
            <NavLink to="/favourites" className={navItemClass}>
              <Bookmark className="w-4 h-4 shrink-0" />
              <span>Saved Spaces</span>
            </NavLink>
            <NavLink to="/holds" className={navItemClass}>
              <CalendarClock className="w-4 h-4 shrink-0" />
              <span>My Reservations</span>
            </NavLink>
          </nav>
        </div>

        {/* Staff Administration Section */}
        {role === 'staff' && (
          <div>
            <div className="px-3 pb-2 text-[10px] font-semibold text-[#737373] dark:text-[#A1A1AA] uppercase tracking-wider flex items-center justify-between">
              <span>Operations</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#F4F4F5] dark:bg-[#292A30] text-[#171717] dark:text-[#F5F5F5] border border-[#E5E5E5] dark:border-[#33343B]">
                Staff
              </span>
            </div>
            <nav className="space-y-0.5">
              <NavLink to="/staff" className={navItemClass} end>
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/staff/seating" className={navItemClass}>
                <Armchair className="w-4 h-4 shrink-0" />
                <span>Seat Layouts</span>
              </NavLink>
              <NavLink to="/staff/reservations" className={navItemClass}>
                <Ticket className="w-4 h-4 shrink-0" />
                <span>All Reservations</span>
              </NavLink>
              <NavLink to="/staff/spaces" className={navItemClass}>
                <Building2 className="w-4 h-4 shrink-0" />
                <span>Space Inventory</span>
              </NavLink>
              <NavLink to="/staff/reports" className={navItemClass}>
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span>Report Moderation</span>
              </NavLink>
              <NavLink to="/staff/holds" className={navItemClass}>
                <CalendarClock className="w-4 h-4 shrink-0" />
                <span>Room Holds</span>
              </NavLink>
              <NavLink to="/staff/signs" className={navItemClass}>
                <Printer className="w-4 h-4 shrink-0" />
                <span>Print Signage</span>
              </NavLink>
              <NavLink to="/staff/audit" className={navItemClass}>
                <History className="w-4 h-4 shrink-0" />
                <span>Audit Logs</span>
              </NavLink>
              <NavLink to="/staff/settings" className={navItemClass}>
                <Settings className="w-4 h-4 shrink-0" />
                <span>Configuration</span>
              </NavLink>
            </nav>
          </div>
        )}
      </div>

      {/* User Footer Section */}
      <div className="p-3 border-t border-[#E5E5E5] dark:border-[#33343B] bg-[#F8F8F8] dark:bg-[#111318]/50">
        <div className="flex items-center justify-between p-2 rounded-lg">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#E5E5E5] dark:bg-[#292A30] flex items-center justify-center text-[#171717] dark:text-[#F5F5F5] font-semibold text-xs shrink-0">
              {role === 'staff' ? 'ST' : role === 'student' ? 'ST' : 'GU'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#171717] dark:text-[#F5F5F5] truncate">
                {user.display_name || 'Guest User'}
              </p>
              <p className="text-[10px] text-[#737373] dark:text-[#A1A1AA] capitalize">
                {role === 'staff' ? 'Library Staff' : role === 'student' ? 'Student' : 'Guest'}
              </p>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-[#737373] hover:text-[#171717] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5] hover:bg-[#E5E5E5] dark:hover:bg-[#292A30] transition-colors cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#171717]" />}
          </button>
        </div>

        <div className="mt-2 pt-2 border-t border-[#E5E5E5] dark:border-[#33343B] flex items-center justify-between text-xs px-1">
          {role !== 'guest' ? (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-[#737373] hover:text-rose-600 dark:hover:text-rose-400 font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-[#EA580C] dark:text-[#F97316] font-medium hover:underline"
            >
              <User className="w-3.5 h-3.5" />
              <span>Sign In / Demo</span>
            </Link>
          )}

          <Link
            to="/profile"
            className="text-[11px] text-[#737373] hover:text-[#171717] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5]"
          >
            Settings
          </Link>
        </div>
      </div>
    </aside>
  );
};
