/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Coins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertCircle,
  X,
  Sparkles,
  CloudLightning,
  Database
} from 'lucide-react';
import { Transaction } from '../types';

interface TransactionsTabProps {
  transactions: Transaction[];
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'syncStatus' | 'createdAt'>, mode: 'instant' | 'bulk') => Promise<boolean>;
  onDeleteTransaction: (id: string) => void;
  quickRecordType: 'debit' | 'credit' | null;
  clearQuickRecordType: () => void;
  appsScriptUrlConfigured: boolean;
  categoriesPemasukan: string[];
  categoriesPengeluaran: string[];
}

export default function TransactionsTab({
  transactions,
  onAddTransaction,
  onDeleteTransaction,
  quickRecordType,
  clearQuickRecordType,
  appsScriptUrlConfigured,
  categoriesPemasukan,
  categoriesPengeluaran
}: TransactionsTabProps) {
  const [isFormOpen, setIsFormOpen] = useState(quickRecordType !== null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [typeFilter, setTypeFilter] = useState<'Semua' | 'debit' | 'credit'>('Semua');

  // Form State
  const [txType, setTxType] = useState<'debit' | 'credit'>(quickRecordType === 'credit' ? 'credit' : 'debit');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [nominal, setNominal] = useState('');
  const [recordingMode, setRecordingMode] = useState<'instant' | 'bulk'>(appsScriptUrlConfigured ? 'instant' : 'bulk');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize and keep category updated if empty
  React.useEffect(() => {
    if (!category) {
      setCategory(txType === 'debit' ? categoriesPemasukan[0] : categoriesPengeluaran[0]);
    }
  }, [categoriesPemasukan, categoriesPengeluaran, txType, category]);

  // Sync state to form if quickRecordType changes
  React.useEffect(() => {
    if (quickRecordType) {
      setTxType(quickRecordType);
      setCategory(quickRecordType === 'credit' ? categoriesPengeluaran[0] : categoriesPemasukan[0]);
      setIsFormOpen(true);
      clearQuickRecordType();
    }
  }, [quickRecordType, clearQuickRecordType, categoriesPemasukan, categoriesPengeluaran]);

  // Adjust default category when transaction type toggles
  const handleTypeChange = (type: 'debit' | 'credit') => {
    setTxType(type);
    setCategory(type === 'debit' ? categoriesPemasukan[0] : categoriesPengeluaran[0]);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(nominal.replace(/[^0-9]/g, ''));
    if (!amount || amount <= 0) {
      alert('Nominal transaksi harus lebih dari 0!');
      return;
    }

    setIsSubmitting(true);
    const success = await onAddTransaction({
      date,
      category,
      description,
      debit: txType === 'debit' ? amount : 0,
      credit: txType === 'credit' ? amount : 0,
      balance: 0 // Will be calculated dynamically
    }, recordingMode);

    setIsSubmitting(false);
    if (success) {
      // Reset form
      setNominal('');
      setDescription('');
      setIsFormOpen(false);
    }
  };

  // Helper for nominal input layout format
  const formatInputCurrency = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    if (!clean) return '';
    return new Intl.NumberFormat('id-ID', {
      style: 'decimal',
      minimumFractionDigits: 0
    }).format(parseInt(clean, 10));
  };

  const handleNominalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatInputCurrency(e.target.value);
    setNominal(formatted);
  };

  // Chronologically compute running balances for display
  const processedTransactions = useMemo(() => {
    // Sort transactions oldest first to calculate running balance correctly
    const chronological = [...transactions].sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return a.createdAt - b.createdAt;
    });

    let balance = 0;
    const mapped = chronological.map(tx => {
      balance = balance + tx.debit - tx.credit;
      return {
        ...tx,
        calculatedBalance: balance
      };
    });

    // Return newest first for ledger listing
    return mapped.reverse();
  }, [transactions]);

  // Apply filters
  const filteredTransactions = useMemo(() => {
    return processedTransactions.filter(tx => {
      const matchesSearch = tx.description.toLowerCase().includes(search.toLowerCase()) ||
                            tx.category.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = categoryFilter === 'Semua' || tx.category === categoryFilter;
      
      const matchesType = typeFilter === 'Semua' || 
                          (typeFilter === 'debit' && tx.debit > 0) || 
                          (typeFilter === 'credit' && tx.credit > 0);

      return matchesSearch && matchesCategory && matchesType;
    });
  }, [processedTransactions, search, categoryFilter, typeFilter]);

  // Unique categories in dataset for filtering
  const allCategoriesList = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => set.add(t.category));
    return ['Semua', ...Array.from(set)];
  }, [transactions]);

  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="p-5 flex flex-col gap-5 select-none relative min-h-full">
      
      {/* Header Panel with Add Trigger */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-400" />
            Catatan Keuangan
          </h2>
          <span className="text-xs text-slate-400">Total {filteredTransactions.length} baris data</span>
        </div>
        
        <button
          onClick={() => {
            setIsFormOpen(true);
            setRecordingMode(appsScriptUrlConfigured ? 'instant' : 'bulk');
          }}
          className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 font-bold text-xs text-white shadow-lg shadow-emerald-500/10 active:scale-98 transition-all"
          id="btn-add-transaction-trigger"
        >
          <Plus className="w-4.5 h-4.5" /> Catat Baru
        </button>
      </div>

      {/* Transaction Entry Form (Slide Overlay / Modal) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 rounded-t-[32px] sm:rounded-3xl border border-slate-800 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto select-text animate-slideUp">
            
            <button 
              onClick={() => setIsFormOpen(false)}
              className="absolute top-5 right-5 p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              id="btn-close-form-modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-black text-white">
                Catat Transaksi Baru
              </h3>
            </div>

            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
              
              {/* Type Switcher */}
              <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleTypeChange('debit')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    txType === 'debit' 
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/10' 
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                  id="form-toggle-debit"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 inline mr-1" />
                  Pemasukan (Debet)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('credit')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    txType === 'credit' 
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/10' 
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                  id="form-toggle-credit"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 inline mr-1" />
                  Pengeluaran (Kredit)
                </button>
              </div>

              {/* Date Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tanggal Transaksi</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  id="form-date"
                />
              </div>

              {/* Category Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  id="form-category"
                >
                  {txType === 'debit' 
                    ? categoriesPemasukan.map(c => <option key={c} value={c}>{c}</option>)
                    : categoriesPengeluaran.map(c => <option key={c} value={c}>{c}</option>)
                  }
                </select>
              </div>

              {/* Nominal Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nominal Transaksi (Rp)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-xs font-bold text-slate-500">Rp</span>
                  <input
                    type="text"
                    required
                    placeholder="0"
                    value={nominal}
                    onChange={handleNominalChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                    id="form-nominal"
                  />
                </div>
              </div>

              {/* Description Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Keterangan / Deskripsi</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Belanja bahan pokok, Gaji bulanan..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500"
                  id="form-description"
                />
              </div>

              {/* Recording Mode (Direct vs Bulk Queue) */}
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  Metode Penyimpanan
                  {!appsScriptUrlConfigured && (
                    <span className="text-[8px] text-amber-400 lowercase italic">Apps Script belum terpasang</span>
                  )}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!appsScriptUrlConfigured}
                    onClick={() => setRecordingMode('instant')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-center transition-all ${
                      recordingMode === 'instant'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-400 disabled:opacity-40'
                    }`}
                    id="form-mode-instant"
                  >
                    <CloudLightning className="w-4 h-4" />
                    <span className="text-[11px] font-bold">Instan (Online)</span>
                    <span className="text-[8px] opacity-75">Langsung ke Sheet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecordingMode('bulk')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-center transition-all ${
                      recordingMode === 'bulk'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-400'
                    }`}
                    id="form-mode-bulk"
                  >
                    <Database className="w-4 h-4" />
                    <span className="text-[11px] font-bold">Bulk (Antrean)</span>
                    <span className="text-[8px] opacity-75">Simpan Lokal Dulu</span>
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 mt-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
                id="btn-add-transaction-submit"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Simpan Transaksi'
                )}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* Filter and Search Bar Panel */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 flex flex-col gap-3 select-text">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Cari keterangan atau kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            id="search-input"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-2">
          {/* Category Filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3 text-emerald-400" /> Kategori
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
              id="filter-category"
            >
              {allCategoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3 text-rose-400" /> Jenis Arus
            </span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
              id="filter-type"
            >
              <option value="Semua">Semua Arus</option>
              <option value="debit">Pemasukan (Debet)</option>
              <option value="credit">Pengeluaran (Kredit)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Listing */}
      <div className="flex flex-col gap-3">
        {filteredTransactions.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
            <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
            <p className="font-semibold">Tidak ada transaksi ditemukan</p>
            <p className="text-[10px] text-slate-600 mt-1 max-w-[200px]">
              Coba ubah filter pencarian Anda atau buat transaksi baru.
            </p>
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const isDebit = tx.debit > 0;
            return (
              <div 
                key={tx.id} 
                className="rounded-2xl bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800/80 p-4 flex items-start justify-between gap-2 shadow-sm relative overflow-hidden group select-text"
                id={`tx-card-${tx.id}`}
              >
                {/* Thin color indicator bar on left side */}
                <div className={`absolute top-0 bottom-0 left-0 w-1 ${
                  isDebit ? 'bg-emerald-500' : 'bg-rose-500'
                }`} />

                <div className="flex gap-3 pl-1 min-w-0">
                  {/* Ledger Icon */}
                  <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${
                    isDebit ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                  }`}>
                    {isDebit ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                  </div>

                  <div className="flex flex-col min-w-0 justify-center">
                    <span className="font-bold text-slate-100 text-xs truncate leading-tight">
                      {tx.description || 'Tanpa keterangan'}
                    </span>
                    
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 flex-wrap">
                      <span className="bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-300 font-medium">
                        {tx.category}
                      </span>
                      <span>•</span>
                      <span>{tx.date}</span>
                    </div>

                    {/* Dynamic Running Balance */}
                    <div className="text-[10px] text-slate-400 mt-1.5 font-medium">
                      Saldo Berjalan: <span className="text-slate-300 font-semibold">{formatIDR((tx as any).calculatedBalance || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                  {/* Amount Badge */}
                  <span className={`font-black text-sm ${
                    isDebit ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {isDebit ? '+' : '-'}{formatIDR(isDebit ? tx.debit : tx.credit)}
                  </span>

                  {/* Sync status + actions */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider ${
                      tx.syncStatus === 'synced' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-400/20' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-400/20'
                    }`}>
                      {tx.syncStatus === 'synced' ? 'Synced' : 'Queue'}
                    </span>

                    <button
                      onClick={() => onDeleteTransaction(tx.id)}
                      className="p-1 rounded text-slate-600 hover:text-rose-400 transition-colors"
                      title="Hapus transaksi"
                      id={`btn-delete-tx-${tx.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
