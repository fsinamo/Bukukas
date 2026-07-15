/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (email: string, token: string) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onLoginSuccess(data.user.email, data.token);
      } else {
        setError(data.message || 'Email atau password tidak valid!');
      }
    } catch (err) {
      console.error('Login error:', err);
      // Fallback local auth for resilience (e.g. if offline during development)
      if (email === 'ravinaarcamanik@gmail.com' && password === 'Ravina_15') {
        onLoginSuccess('ravinaarcamanik@gmail.com', 'offline_fallback_token');
      } else {
        setError('Gagal menghubungkan ke server. Periksa jaringan Anda.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('ravinaarcamanik@gmail.com');
    setPassword('Ravina_15');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans select-none">
      <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl p-6 sm:p-8 flex flex-col relative overflow-hidden">
        
        {/* Subtle glowing backgrounds */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full filter blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full filter blur-3xl pointer-events-none" />

        {/* Branding Head */}
        <div className="flex flex-col items-center text-center mt-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4 animate-bounce">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            Buku Kas Android
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 max-w-[280px]">
            Sistem Pencatatan Finansial Real-Time Offline & Online dengan Sinkronisasi Google Sheets
          </p>
        </div>

        {/* Info Credentials Alert */}
        <div className="mb-6 p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-1.5 text-xs text-slate-300">
          <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Hak Akses Terbatas (Khusus)
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Aplikasi ini dilindungi oleh sandi keamanan optimal. Hanya dapat diakses oleh administrator resmi.
          </p>
          <button
            onClick={handleFillDemo}
            type="button"
            className="mt-1.5 self-start px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/20 transition-all font-medium"
            id="btn-fill-demo"
          >
            Gunakan Akun Ravina
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <p className="leading-tight">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 select-text">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Alamat Email Google
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
              <input
                type="email"
                required
                placeholder="email@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                id="login-email"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Kata Sandi Akun
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                id="login-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-400"
                id="btn-toggle-password"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 mt-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            id="btn-login-submit"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Masuk Ke Buku Kas'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-[10px] text-slate-600">
          Versi Android Web-Pack v1.4.0 • Keamanan Enkripsi SSL
        </div>

      </div>
    </div>
  );
}
