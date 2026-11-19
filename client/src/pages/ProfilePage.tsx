import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LogOut, LayoutDashboard, KeyRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const ProfilePage: React.FC = () => {
  const { user, role, logout, quickSwitchPersona } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5] tracking-tight">
          Account & Session
        </h1>
        <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA] mt-0.5">
          User identity, role permissions & evaluation session controls
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#F4F4F5] dark:bg-[#292A30] border border-[#E5E5E5] dark:border-[#33343B] flex items-center justify-center text-[#171717] dark:text-[#F5F5F5] font-bold text-base">
            {role === 'staff' ? 'ST' : role === 'student' ? 'ST' : 'GU'}
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#171717] dark:text-[#F5F5F5]">
              {user.display_name || 'Guest User'}
            </h2>
            <p className="text-xs font-mono text-[#737373] dark:text-[#A1A1AA]">
              {user.email || 'Unauthenticated Guest'}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-[#F4F4F5] dark:bg-[#292A30] text-[#171717] dark:text-[#F5F5F5] border border-[#E5E5E5] dark:border-[#33343B]">
                {user.role} {user.staff_scope ? `• ${user.staff_scope} scope` : ''}
              </span>
            </div>
          </div>
        </div>

        {role === 'staff' && (
          <div className="pt-2">
            <Link to="/staff">
              <Button variant="primary" size="md" className="gap-2" icon={<LayoutDashboard className="w-4 h-4" />}>
                <span>Open Staff Management Console</span>
              </Button>
            </Link>
          </div>
        )}
      </Card>

      {/* Role Switching for Testing */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
          <h3 className="text-xs font-semibold text-[#171717] dark:text-[#F5F5F5] uppercase tracking-wider">
            Switch Evaluation Session
          </h3>
        </div>
        <p className="text-xs text-[#737373] dark:text-[#A1A1AA] leading-normal">
          Toggle between account roles to verify server-side access control boundaries:
        </p>

        <div className="grid grid-cols-3 gap-2 pt-1 text-xs font-medium">
          <Button
            variant={role === 'guest' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => quickSwitchPersona('guest')}
          >
            Guest User
          </Button>
          <Button
            variant={role === 'student' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => quickSwitchPersona('student')}
          >
            Student Account
          </Button>
          <Button
            variant={role === 'staff' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => quickSwitchPersona('staff')}
          >
            Staff Account
          </Button>
        </div>
      </Card>

      {role !== 'guest' ? (
        <Button
          variant="outline"
          size="md"
          onClick={handleLogout}
          className="gap-2 text-rose-600 hover:text-rose-700 dark:text-rose-400"
          icon={<LogOut className="w-4 h-4" />}
        >
          <span>Sign Out of Account</span>
        </Button>
      ) : (
        <Link to="/login">
          <Button variant="primary" size="md">
            <span>Sign In to Account</span>
          </Button>
        </Link>
      )}
    </div>
  );
};
