import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [totpCode, setTotpCode] = useState<string>('');
  const [requires2FA, setRequires2FA] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const payload: Record<string, string> = { email, password };
      if (requires2FA && totpCode) {
        payload.totp_code = totpCode;
      }

      const res = await api.post('/auth/login/', payload);

      if (res.data.requires_2fa) {
        setRequires2FA(true);
        setIsLoading(false);
        return;
      }

      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.error?.details || err.response?.data?.error?.message || err.response?.data?.non_field_errors?.[0] || 'Invalid credentials.';
      setErrorMsg(typeof msg === 'object' ? JSON.stringify(msg) : String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
            <Shield className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">LifeVault</h2>
          <p className="mt-1 text-xs text-slate-500">
            {requires2FA ? 'Enter your 6-digit authenticator code' : 'Access your secure digital document vault'}
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {!requires2FA ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Email Address</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Password</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 text-center">
                Authenticator 6-Digit Code
              </label>
              <div className="relative mt-2">
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="000000"
                  className="w-full rounded-lg border border-slate-300 py-3 font-mono text-center text-xl tracking-widest text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
          >
            <span>{isLoading ? 'Verifying...' : requires2FA ? 'Confirm & Unlock Vault' : 'Sign In'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="text-center text-xs text-slate-500">
          Don't have a vault yet?{' '}
          <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-500">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
};
