import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ShieldAlert, ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Forbidden403: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-md mx-auto py-12">
      <Card className="p-8 text-center space-y-4 border-rose-200 dark:border-rose-900/60">
        <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div>
          <span className="text-[11px] font-mono font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider block mb-1">
            HTTP 403 Forbidden
          </span>
          <h1 className="text-xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
            Staff Access Required
          </h1>
          <p className="text-xs text-[#737373] dark:text-[#A1A1AA] mt-2 leading-relaxed">
            You are signed in as <strong>{user.display_name}</strong> with role <span className="font-mono font-semibold">{user.role}</span>. This administrative route is restricted to verified campus staff members.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Link to="/" className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Discovery</span>
            </Button>
          </Link>

          <Link to="/login" className="w-full sm:w-auto">
            <Button variant="primary" size="sm" className="w-full gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Sign In with Staff Account</span>
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};
