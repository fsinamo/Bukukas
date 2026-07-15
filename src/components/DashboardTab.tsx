/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Plus
} from 'lucide-react';
import { Transaction } from '../types';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

interface DashboardTabProps {
  transactions: Transaction[];
  onNavigateToRecord: (type: 'debit' | 'credit') => void;
}

export default function DashboardTab({ transactions, onNavigateToRecord }: DashboardTabProps) {
  
  // Calculate general statistics
  const stats = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;

    transactions.forEach(t => {
      totalDebit += t.debit;
      totalCredit += t.credit;
    });

    const balance = totalDebit - totalCredit;

    return {
      totalDebit,
      totalCredit,
      balance
    };
  }, [transactions]);

  // Format currency helper
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Group transactions by month for trend analysis
  const trendData = useMemo(() => {
    const monthlyMap: { [key: string]: { month: string; debit: number; credit: number } } = {};
    
    // Default last 5 months if empty to show beautiful chart
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    
    // Sort transactions by date ascending
    const sortedTx = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

    if (sortedTx.length === 0) {
      // Return beautiful mock trend template for initial user experience
      return [
        { month: 'Mei', debit: 4500000, credit: 3200000 },
        { month: 'Jun', debit: 5000000, credit: 4100000 },
        { month: 'Jul', debit: 0, credit: 0 },
      ];
    }

    sortedTx.forEach(tx => {
      const dateParts = tx.date.split('-');
      if (dateParts.length < 2) return;
      const monthIndex = parseInt(dateParts[1], 10) - 1;
      const year = dateParts[0].substring(2);
      const monthLabel = `${monthNames[monthIndex]} '${year}`;

      if (!monthlyMap[monthLabel]) {
        monthlyMap[monthLabel] = { month: monthLabel, debit: 0, credit: 0 };
      }
      monthlyMap[monthLabel].debit += tx.debit;
      monthlyMap[monthLabel].credit += tx.credit;
    });

    return Object.values(monthlyMap);
  }, [transactions]);

  // Aggregate expenses by category for credit breakdown
  const categoryData = useMemo(() => {
    const categoryMap: { [key: string]: number } = {};
    
    transactions.forEach(tx => {
      if (tx.credit > 0) {
        const cat = tx.category || 'Lain-lain';
        categoryMap[cat] = (categoryMap[cat] || 0) + tx.credit;
      }
    });

    const colors = ['#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#3B82F6', '#10B981', '#6B7280'];

    return Object.entries(categoryMap)
      .map(([name, value], idx) => ({
        name,
        value,
        color: colors[idx % colors.length]
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // top 5
  }, [transactions]);

  return (
    <div className="p-5 flex flex-col gap-6 select-none">
      
      {/* Saldo Utama Card */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full filter blur-2xl" />
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <Wallet className="w-4 h-4 text-emerald-400" />
            Total Saldo Buku Kas
          </div>
          <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded-full text-slate-300 font-medium border border-slate-600">
            IDR Rp
          </span>
        </div>

        <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight break-all">
          {formatIDR(stats.balance)}
        </h3>

        {/* Separator */}
        <div className="my-5 border-t border-slate-700/50" />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <ArrowUpRight className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Uang Masuk</span>
              <span className="text-xs sm:text-sm font-bold text-emerald-400 truncate">
                {formatIDR(stats.totalDebit)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
              <ArrowDownLeft className="w-5 h-5 text-rose-400" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Uang Keluar</span>
              <span className="text-xs sm:text-sm font-bold text-rose-400 truncate">
                {formatIDR(stats.totalCredit)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Triggers */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigateToRecord('debit')}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/10 transition-all active:scale-98"
          id="btn-quick-pemasukan"
        >
          <Plus className="w-4 h-4" /> Catat Pemasukan
        </button>
        <button
          onClick={() => onNavigateToRecord('credit')}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/10 transition-all active:scale-98"
          id="btn-quick-pengeluaran"
        >
          <Plus className="w-4 h-4" /> Catat Pengeluaran
        </button>
      </div>

      {/* Visual Analisis Trend Chart */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Tren Bulanan (Arus Kas)
        </h4>

        <div className="h-56 w-full text-[10px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorDebit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCredit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" stroke="#475569" />
              <YAxis stroke="#475569" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
              />
              <Area type="monotone" dataKey="debit" name="Pemasukan" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDebit)" />
              <Area type="monotone" dataKey="credit" name="Pengeluaran" stroke="#EF4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCredit)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Expense Category Distribution */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            Kategori Pengeluaran Terbesar
          </h4>
          <span className="text-[9px] text-slate-500 font-medium">Top 5</span>
        </div>

        {categoryData.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl bg-slate-900/40">
            <AlertCircle className="w-6 h-6 text-slate-600 mb-2" />
            Belum ada catatan pengeluaran
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {categoryData.map((item, index) => {
              const maxVal = categoryData[0]?.value || 1;
              const pct = Math.round((item.value / stats.totalCredit) * 100) || 0;
              const widthPct = Math.round((item.value / maxVal) * 100);

              return (
                <div key={item.name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="text-slate-400 font-semibold">
                      {formatIDR(item.value)} <span className="text-[10px] text-slate-500 font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ 
                        backgroundColor: item.color,
                        width: `${widthPct}%`
                      }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Activity Mini Log */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-400" />
            Catatan Terakhir
          </h4>
          <button 
            onClick={() => onNavigateToRecord('debit')} // Navigates to Transaction tab
            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider flex items-center"
            id="btn-see-all-activities"
          >
            Lihat Semua <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl bg-slate-900/40">
            <AlertCircle className="w-6 h-6 text-slate-600 mb-2" />
            Belum ada transaksi tercatat
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-slate-800">
            {transactions.slice(0, 3).map((tx) => (
              <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="font-semibold text-slate-200 truncate">{tx.description || 'Tanpa keterangan'}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">{tx.date} • {tx.category}</span>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  {tx.debit > 0 ? (
                    <span className="font-bold text-emerald-400">+{formatIDR(tx.debit)}</span>
                  ) : (
                    <span className="font-bold text-rose-400">-{formatIDR(tx.credit)}</span>
                  )}
                  <span className={`text-[9px] px-1.5 py-0.2 rounded mt-1 font-semibold uppercase tracking-wider ${
                    tx.syncStatus === 'synced' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-400/20' : 'bg-amber-500/10 text-amber-400 border border-amber-400/20'
                  }`}>
                    {tx.syncStatus === 'synced' ? 'Synced' : 'Bulk Queue'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
