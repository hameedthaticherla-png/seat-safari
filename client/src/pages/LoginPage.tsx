import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Lock, Mail, Shield, User, ArrowRight, Info } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    const targetEmail = customEmail || email;
    const targetPass = customPass || password;

    try {
      setLoading(true);
      setError(null);
      const user = await login(targetEmail, targetPass);
      if (user.role === 'staff') {
        navigate('/staff');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-6 sm:py-12 space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2 flex flex-col items-center">
        <BrandLogo size="lg" showSubtitle={false} />
        <div>
          <h1 className="text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5] tracking-tight">
            Sign In to Seat Safari
          </h1>
          <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA] mt-0.5">
            Campus Study Space Discovery & Management Platform
          </p>
        </div>
      </div>

      {/* Demo Credentials Quick-Access Box */}
      <Card className="p-4 sm:p-5 border-[#E5E5E5] dark:border-[#33343B] bg-[#F8F8F8] dark:bg-[#202127]/60 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#EA580C] dark:text-[#F97316] shrink-0" />
          <h2 className="text-xs font-semibold text-[#171717] dark:text-[#F5F5F5] uppercase tracking-wider">
            Evaluation Demo Accounts
          </h2>
        </div>
        <p className="text-xs text-[#737373] dark:text-[#A1A1AA] leading-normal">
          Select a role to sign in instantly with pre-seeded demo permissions:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleLogin(undefined, 'student@demo.test', 'Student123!')}
            className="p-3 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] hover:border-orange-500 text-left transition-colors flex flex-col justify-between group cursor-pointer shadow-xs"
          >
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#171717] dark:text-[#F5F5F5] group-hover:text-[#EA580C] dark:group-hover:text-[#F97316]">
                <User className="w-3.5 h-3.5" />
                <span>Student Account</span>
              </div>
              <span className="text-[11px] text-[#737373] dark:text-[#A1A1AA] font-mono block mt-0.5">student@demo.test</span>
            </div>
            <span className="text-[11px] text-[#EA580C] dark:text-[#F97316] font-medium mt-2 flex items-center gap-1">
              Sign In →
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleLogin(undefined, 'library@demo.test', 'Library123!')}
            className="p-3 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] hover:border-orange-500 text-left transition-colors flex flex-col justify-between group cursor-pointer shadow-xs"
          >
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#171717] dark:text-[#F5F5F5] group-hover:text-[#EA580C] dark:group-hover:text-[#F97316]">
                <Shield className="w-3.5 h-3.5" />
                <span>Staff Account</span>
              </div>
              <span className="text-[11px] text-[#737373] dark:text-[#A1A1AA] font-mono block mt-0.5">library@demo.test</span>
            </div>
            <span className="text-[11px] text-[#EA580C] dark:text-[#F97316] font-medium mt-2 flex items-center gap-1">
              Staff Console →
            </span>
          </button>
        </div>
      </Card>

      {/* Manual Login Form */}
      <Card className="p-5 sm:p-6">
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#171717] dark:text-[#F5F5F5] mb-1.5">
              Campus Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#737373] dark:text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@university.edu"
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] text-xs sm:text-sm text-[#171717] dark:text-[#F5F5F5] placeholder:text-[#737373] dark:placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#171717] dark:text-[#F5F5F5] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#737373] dark:text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] text-xs sm:text-sm text-[#171717] dark:text-[#F5F5F5] placeholder:text-[#737373] dark:placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full gap-2"
            loading={loading}
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Sign In
          </Button>
        </form>
      </Card>
    </div>
  );
};
