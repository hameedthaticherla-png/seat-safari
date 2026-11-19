import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, Bookmark, CalendarClock, Shield, User, Armchair } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export const BottomNav: React.FC = () => {
  const { user, role } = useAuth();
  const [hasActiveHold, setHasActiveHold] = useState(false);

  useEffect(() => {
    if (role === 'student') {
      api.holds.getMyActive()
        .then(res => setHasActiveHold(Boolean(res.hold && res.hold.status === 'active')))
        .catch(() => setHasActiveHold(false));
    } else {
      setHasActiveHold(false);
    }
  }, [role]);

  const navItems = [
    {
      to: '/',
      label: 'Find',
      icon: Compass,
      badge: null,
    },
    {
      to: '/book',
      label: 'Book Seat',
      icon: Armchair,
      badge: null,
    },
    {
      to: '/favourites',
      label: 'Saved',
      icon: Bookmark,
      badge: null,
    },
    {
      to: '/holds',
      label: 'Passes',
      icon: CalendarClock,
      badge: hasActiveHold ? '1' : null,
    },
    ...(role === 'staff'
      ? [
          {
            to: '/staff',
            label: 'Staff',
            icon: Shield,
            badge: null,
          },
        ]
      : []),
    {
      to: user.role === 'guest' ? '/login' : '/profile',
      label: user.role === 'guest' ? 'Sign In' : 'Account',
      icon: User,
      badge: null,
    },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#202127]/95 backdrop-blur-md border-t border-[#E5E5E5] dark:border-[#33343B] pb-[env(safe-area-inset-bottom)] no-print">
      <div className="grid grid-flow-col auto-cols-fr h-16 items-center px-1 max-w-lg mx-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `min-h-[44px] relative flex flex-col items-center justify-center py-1 px-1 transition-colors ${
                  isActive
                    ? 'text-[#EA580C] dark:text-[#F97316] font-semibold'
                    : 'text-[#737373] hover:text-[#171717] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5] font-medium'
                }`
              }
            >
              <div className="relative">
                <Icon className="w-5 h-5 mb-0.5" />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 bg-[#EA580C] dark:bg-[#F97316] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] tracking-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
