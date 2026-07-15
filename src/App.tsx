/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import AndroidContainer from './components/AndroidContainer';
import LoginScreen from './components/LoginScreen';
import DashboardTab from './components/DashboardTab';
import TransactionsTab from './components/TransactionsTab';
import SyncTab from './components/SyncTab';
import SettingsTab from './components/SettingsTab';
import { Transaction, UserSettings } from './types';
import { Wifi, CloudCheck, AlertCircle, RefreshCw } from 'lucide-react';

const LOCAL_STORAGE_TX_KEY = 'buku_kas_transactions_v1';
const LOCAL_STORAGE_URL_KEY = 'buku_kas_apps_script_url_v1';
const LOCAL_STORAGE_SETTINGS_KEY = 'buku_kas_settings_v1';
const LOCAL_STORAGE_SESSION_KEY = 'buku_kas_session_v1';

export default function App() {
  const [session, setSession] = useState<{ email: string; token: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>('');
  const [settings, setSettings] = useState<UserSettings>({
    reminderEnabled: true,
    reminderTime: '20:00',
    appsScriptUrl: ''
  });
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  
  // Custom categories state
  const [categoriesPemasukan, setCategoriesPemasukan] = useState<string[]>([
    'Gaji', 'Investasi', 'Penjualan', 'Transfer Masuk', 'Hibah/Hadiah', 'Lain-lain'
  ]);
  const [categoriesPengeluaran, setCategoriesPengeluaran] = useState<string[]>([
    'Makanan & Minuman', 'Transportasi', 'Belanja Harian', 'Tagihan & Utilitas', 'Hiburan & Rekreasi', 'Operasional Usaha', 'Kesehatan', 'Pendidikan', 'Lain-lain'
  ]);
  
  // Custom temporary UI notifications/banners
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [quickRecordType, setQuickRecordType] = useState<'debit' | 'credit' | null>(null);

  // 1. Initial Load from Local Storage
  useEffect(() => {
    // Session
    const savedSession = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch (e) {
        console.error('Failed to parse saved session:', e);
      }
    }

    // Apps Script URL
    const savedUrl = localStorage.getItem(LOCAL_STORAGE_URL_KEY);
    if (savedUrl) {
      setAppsScriptUrl(savedUrl);
    }

    // Settings
    const savedSettings = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Failed to parse saved settings:', e);
      }
    }

    // Load custom categories if present
    const savedPemasukan = localStorage.getItem('buku_kas_categories_pemasukan_v1');
    if (savedPemasukan) {
      try {
        setCategoriesPemasukan(JSON.parse(savedPemasukan));
      } catch (e) {
        console.error('Failed to parse saved pemasukan categories:', e);
      }
    }
    const savedPengeluaran = localStorage.getItem('buku_kas_categories_pengeluaran_v1');
    if (savedPengeluaran) {
      try {
        setCategoriesPengeluaran(JSON.parse(savedPengeluaran));
      } catch (e) {
        console.error('Failed to parse saved pengeluaran categories:', e);
      }
    }

    // Ledger Transactions (Add mock transactions if empty for instant visual dashboard beauty)
    const savedTx = localStorage.getItem(LOCAL_STORAGE_TX_KEY);
    if (savedTx) {
      try {
        setTransactions(JSON.parse(savedTx));
      } catch (e) {
        console.error('Failed to parse saved transactions:', e);
      }
    } else {
      // Pre-populate mock transactions for a warm and gorgeous initial experience
      const defaultMockTx: Transaction[] = [
        {
          id: 'mock-tx-1',
          date: new Date().toISOString().split('T')[0],
          category: 'Gaji',
          description: 'Gaji Bulanan Utama',
          debit: 6500000,
          credit: 0,
          balance: 6500000,
          syncStatus: 'pending', // Pending so they can test the Sync button immediately
          createdAt: Date.now() - 3600000
        },
        {
          id: 'mock-tx-2',
          date: new Date().toISOString().split('T')[0],
          category: 'Belanja Harian',
          description: 'Belanja Bahan Pokok Mingguan',
          debit: 0,
          credit: 450000,
          balance: 6050000,
          syncStatus: 'pending',
          createdAt: Date.now()
        }
      ];
      setTransactions(defaultMockTx);
      localStorage.setItem(LOCAL_STORAGE_TX_KEY, JSON.stringify(defaultMockTx));
    }
  }, []);

  // 2. Network Connectivity Change Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerToast('success', 'Koneksi internet tersambung! Memulai sinkronisasi otomatis...');
      // Auto sync when back online
      autoSyncPendingTransactions();
    };

    const handleOffline = () => {
      setIsOnline(false);
      triggerToast('info', 'Anda sedang offline. Catatan baru akan disimpan di antrean bulk (lokal).');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [transactions, appsScriptUrl]);

  // Helper to show custom bottom Toast alerts
  const triggerToast = (type: 'success' | 'info' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // 3. Auto sync trigger logic when going back online
  const autoSyncPendingTransactions = async () => {
    const pendingCount = transactions.filter(t => t.syncStatus === 'pending' || t.syncStatus === 'failed').length;
    const savedUrl = localStorage.getItem(LOCAL_STORAGE_URL_KEY) || appsScriptUrl;

    if (pendingCount > 0 && savedUrl) {
      setIsSyncing(true);
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appsScriptUrl: savedUrl,
            transactions: transactions // Sends entire dataset to merge or update on sheet
          })
        });

        const responseText = await response.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          throw new Error('Respons dari server tidak valid (bukan JSON).');
        }
        if (response.ok && data.success) {
          // Mark all as synced
          const updated = transactions.map(t => ({ ...t, syncStatus: 'synced' as const }));
          setTransactions(updated);
          localStorage.setItem(LOCAL_STORAGE_TX_KEY, JSON.stringify(updated));
          triggerToast('success', `Sinkronisasi otomatis berhasil! ${pendingCount} antrean diunggah.`);
        } else {
          // If response not ok, do nothing, they stay pending
          console.warn('Auto sync failed:', data.message);
        }
      } catch (err) {
        console.error('Error during auto sync:', err);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // 4. API & Ledger Mutations
  const handleLoginSuccess = (email: string, token: string) => {
    const newSession = { email, token };
    setSession(newSession);
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(newSession));
    triggerToast('success', 'Selamat datang kembali, Ravina!');
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    const check = window.confirm('Apakah Anda yakin ingin keluar dari aplikasi Buku Kas?');
    if (check) {
      setSession(null);
      localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    }
  };

  const handleSaveAppsScriptUrl = (url: string) => {
    setAppsScriptUrl(url);
    localStorage.setItem(LOCAL_STORAGE_URL_KEY, url);
    triggerToast('success', 'URL Google Apps Script berhasil diperbarui!');
  };

  const handleSaveSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(newSettings));
    triggerToast('success', 'Pengaturan notifikasi berhasil disimpan!');
  };

  const handleSaveCategories = (pemasukan: string[], pengeluaran: string[]) => {
    setCategoriesPemasukan(pemasukan);
    setCategoriesPengeluaran(pengeluaran);
    localStorage.setItem('buku_kas_categories_pemasukan_v1', JSON.stringify(pemasukan));
    localStorage.setItem('buku_kas_categories_pengeluaran_v1', JSON.stringify(pengeluaran));
    triggerToast('success', 'Daftar kategori berhasil diperbarui!');
  };

  const handleClearAllData = () => {
    setTransactions([]);
    localStorage.removeItem(LOCAL_STORAGE_TX_KEY);
    triggerToast('success', 'Semua transaksi dibersihkan dari penyimpanan lokal.');
  };

  // Add Transaction
  const handleAddTransaction = async (
    newTx: Omit<Transaction, 'id' | 'syncStatus' | 'createdAt'>,
    mode: 'instant' | 'bulk'
  ): Promise<boolean> => {
    const id = 'tx-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    const createdAt = Date.now();
    
    // Create local transaction
    const transactionRecord: Transaction = {
      ...newTx,
      id,
      syncStatus: mode === 'instant' && isOnline && appsScriptUrl ? 'synced' : 'pending',
      createdAt
    };

    // Calculate preliminary state list to execute requests
    const updatedTransactions = [transactionRecord, ...transactions];

    if (mode === 'instant' && isOnline && appsScriptUrl) {
      try {
        // Send to online proxy
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appsScriptUrl: appsScriptUrl,
            transactions: updatedTransactions
          })
        });

        const responseText = await response.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          throw new Error('Respons dari server tidak valid (bukan JSON).');
        }
        if (response.ok && data.success) {
          // Saved successfully online
          setTransactions(updatedTransactions);
          localStorage.setItem(LOCAL_STORAGE_TX_KEY, JSON.stringify(updatedTransactions));
          triggerToast('success', 'Transaksi berhasil disimpan dan disinkronkan ke Google Sheet!');
          return true;
        } else {
          // Save locally as pending instead
          const fallbackRecord = { ...transactionRecord, syncStatus: 'pending' as const };
          const fallbackList = [fallbackRecord, ...transactions];
          setTransactions(fallbackList);
          localStorage.setItem(LOCAL_STORAGE_TX_KEY, JSON.stringify(fallbackList));
          triggerToast('info', 'Google Sheet merespons lambat. Transaksi disimpan di antrean lokal.');
          return true;
        }
      } catch (err) {
        // Save locally as pending
        const fallbackRecord = { ...transactionRecord, syncStatus: 'pending' as const };
        const fallbackList = [fallbackRecord, ...transactions];
        setTransactions(fallbackList);
        localStorage.setItem(LOCAL_STORAGE_TX_KEY, JSON.stringify(fallbackList));
        triggerToast('info', 'Gagal terhubung ke Sheet. Transaksi disimpan di antrean lokal.');
        return true;
      }
    } else {
      // Bulk queue mode, save directly as pending
      setTransactions(updatedTransactions);
      localStorage.setItem(LOCAL_STORAGE_TX_KEY, JSON.stringify(updatedTransactions));
      triggerToast('success', 'Transaksi berhasil disimpan ke antrean bulk (lokal).');
      return true;
    }
  };

  // Delete Transaction
  const handleDeleteTransaction = (id: string) => {
    const confirmation = window.confirm('Apakah Anda yakin ingin menghapus catatan transaksi ini?');
    if (!confirmation) return;

    const filtered = transactions.filter(t => t.id !== id);
    setTransactions(filtered);
    localStorage.setItem(LOCAL_STORAGE_TX_KEY, JSON.stringify(filtered));
    triggerToast('success', 'Transaksi dihapus dari penyimpanan lokal.');
  };

  // Force Manual Bulk Sync All
  const handleSyncAll = async (): Promise<{ success: boolean; message: string }> => {
    if (!appsScriptUrl) {
      return { 
        success: false, 
        message: 'Batal: Anda harus mengatur URL Google Apps Script terlebih dahulu di tab Sinkronisasi.' 
      };
    }

    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appsScriptUrl,
          transactions: transactions // Sends full set to replace or merge
        })
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error('Respons dari server tidak valid (bukan JSON).');
      }
      if (response.ok && data.success) {
        // Mark all transactions as synced
        const updated = transactions.map(t => ({ ...t, syncStatus: 'synced' as const }));
        setTransactions(updated);
        localStorage.setItem(LOCAL_STORAGE_TX_KEY, JSON.stringify(updated));
        setIsSyncing(false);
        triggerToast('success', 'Sinkronisasi penuh berhasil diselesaikan!');
        return { success: true, message: data.message || 'Sinkronisasi sukses.' };
      } else {
        setIsSyncing(false);
        return { success: false, message: data.message || 'Respons server tidak valid.' };
      }
    } catch (err: any) {
      setIsSyncing(false);
      return { success: false, message: err.message || 'Gagal menyambung ke jaringan.' };
    }
  };

  // Handle Quick Entry redirection from Dashboard Tab
  const handleNavigateToRecord = (type: 'debit' | 'credit') => {
    setQuickRecordType(type);
    setActiveTab('transaksi');
  };

  // If session is empty, present Login Screen
  if (!session) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <AndroidContainer
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isOnline={isOnline}
      onLogout={handleLogout}
      userEmail={session.email}
    >
      {/* Content Router */}
      <div className="animate-fadeIn">
        {activeTab === 'dashboard' && (
          <DashboardTab 
            transactions={transactions} 
            onNavigateToRecord={handleNavigateToRecord}
          />
        )}
        
        {activeTab === 'transaksi' && (
          <TransactionsTab
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            quickRecordType={quickRecordType}
            clearQuickRecordType={() => setQuickRecordType(null)}
            appsScriptUrlConfigured={!!appsScriptUrl}
            categoriesPemasukan={categoriesPemasukan}
            categoriesPengeluaran={categoriesPengeluaran}
          />
        )}
        
        {activeTab === 'sync' && (
          <SyncTab
            transactions={transactions}
            appsScriptUrl={appsScriptUrl}
            onSaveAppsScriptUrl={handleSaveAppsScriptUrl}
            onSyncAll={handleSyncAll}
            isSyncing={isSyncing}
          />
        )}
        
        {activeTab === 'pengaturan' && (
          <SettingsTab
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onClearAllData={handleClearAllData}
            userEmail={session.email}
            categoriesPemasukan={categoriesPemasukan}
            categoriesPengeluaran={categoriesPengeluaran}
            onSaveCategories={handleSaveCategories}
          />
        )}
      </div>

      {/* Floating System Notification / Toast Alerts inside mobile frame */}
      {toastMessage && (
        <div className="absolute bottom-20 left-4 right-4 bg-slate-950 border border-slate-800 rounded-2xl p-3.5 shadow-2xl z-50 animate-slideUp flex items-start gap-2.5">
          {toastMessage.type === 'success' && (
            <CloudCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          )}
          {toastMessage.type === 'info' && (
            <Wifi className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
          )}
          {toastMessage.type === 'error' && (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider">
              {toastMessage.type === 'success' ? 'Notifikasi Buku Kas' : toastMessage.type === 'info' ? 'Status Koneksi' : 'Sistem Alert'}
            </span>
            <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">{toastMessage.text}</p>
          </div>
        </div>
      )}
    </AndroidContainer>
  );
}
