/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Battery, 
  BatteryCharging, 
  LayoutDashboard, 
  PlusCircle, 
  RefreshCw, 
  Settings as SettingsIcon, 
  LogOut,
  Coins
} from 'lucide-react';
import { motion } from 'motion/react';

interface AndroidContainerProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOnline: boolean;
  onLogout: () => void;
  userEmail: string;
}

export default function AndroidContainer({
  children,
  activeTab,
  setActiveTab,
  isOnline,
  onLogout,
  userEmail
}: AndroidContainerProps) {
  const [time, setTime] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(87);
  const [isCharging, setIsCharging] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours().toString().padStart(2, '0');
      let minutes = now.getMinutes().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}`);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Simulate slowly decaying battery or charging
  useEffect(() => {
    const batteryInterval = setInterval(() => {
      setBatteryLevel((prev) => {
        if (prev <= 10) return 99; // Reset for demonstration
        return prev - 1;
      });
    }, 120000);
    return () => clearInterval(batteryInterval);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dasbor', icon: LayoutDashboard },
    { id: 'transaksi', label: 'Transaksi', icon: Coins },
    { id: 'sync', label: 'Sinkronisasi', icon: RefreshCw },
    { id: 'pengaturan', label: 'Pengaturan', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-0 sm:p-4 md:p-8 font-sans select-none">
      {/* Outer Phone Bezel Mockup - hidden on full mobile screen, visible on tablet/desktop */}
      <div className="w-full max-w-md sm:h-[840px] sm:rounded-[40px] bg-slate-950 sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border-0 sm:border-[12px] border-slate-800 flex flex-col overflow-hidden relative text-slate-100">
        
        {/* Android Top Camera Punch Hole (Simulated) */}
        <div className="hidden sm:block absolute top-3 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-black rounded-full z-50 border border-slate-900" />

        {/* Android Status Bar */}
        <div className="h-10 bg-slate-950 px-6 flex items-center justify-between text-xs font-semibold tracking-wider text-slate-300 z-40 select-none">
          <span>{time}</span>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <Wifi className="w-3.5 h-3.5" />
              </span>
            ) : (
              <span className="flex items-center gap-1 text-rose-400">
                <WifiOff className="w-3.5 h-3.5" />
              </span>
            )}
            <div className="flex items-center gap-1">
              <span className="text-[10px] opacity-75">{batteryLevel}%</span>
              {isCharging ? (
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Battery className="w-3.5 h-3.5 text-slate-300" />
              )}
            </div>
          </div>
        </div>

        {/* Android App Bar (Header) */}
        <header className="h-16 bg-gradient-to-r from-emerald-600 to-teal-700 px-5 flex items-center justify-between shadow-md z-30 select-none">
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Buku Kas Android
            </h1>
            <span className="text-[10px] text-emerald-100 opacity-90 truncate max-w-[200px]">
              {userEmail}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Quick Online Badge */}
            <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${
              isOnline ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/30' : 'bg-rose-500/30 text-rose-200 border border-rose-400/30'
            }`}>
              {isOnline ? 'Online' : 'Offline'}
            </div>

            <button 
              onClick={onLogout}
              className="p-1.5 rounded-full bg-black/10 hover:bg-black/20 text-white transition-colors"
              title="Keluar"
              id="btn-logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Primary Screen Scrollable Canvas */}
        <main className="flex-1 overflow-y-auto bg-slate-900 pb-20 select-text">
          {children}
        </main>

        {/* Android Bottom Navigation Bar */}
        <nav className="absolute bottom-0 left-0 right-0 h-[68px] bg-slate-950 border-t border-slate-800 flex items-center justify-around px-2 pb-1 z-40 select-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col items-center justify-center flex-1 h-full py-1 group focus:outline-none relative"
                id={`nav-${item.id}`}
              >
                {/* Active Indicator Background Bubble */}
                {isActive && (
                  <motion.div 
                    layoutId="activeNavIndicator"
                    className="absolute inset-x-4 top-1.5 bottom-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                
                <Icon className={`w-5.5 h-5.5 transition-all duration-200 z-10 ${
                  isActive ? 'text-emerald-400 scale-110' : 'text-slate-400 group-hover:text-slate-300'
                }`} />
                
                <span className={`text-[10px] font-medium transition-colors duration-200 mt-1 z-10 ${
                  isActive ? 'text-emerald-300 font-semibold' : 'text-slate-400 group-hover:text-slate-300'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Android virtual soft-keys pill indicator (Decorative overlay for premium native design) */}
        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-28 h-1 bg-slate-800 rounded-full z-50 pointer-events-none hidden sm:block" />

      </div>
    </div>
  );
}
