/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  User, 
  ShieldCheck, 
  Smartphone, 
  Trash2, 
  Check, 
  AlertCircle,
  HelpCircle,
  SmartphoneNfc,
  Plus,
  X
} from 'lucide-react';
import { UserSettings } from '../types';

interface SettingsTabProps {
  settings: UserSettings;
  onSaveSettings: (settings: UserSettings) => void;
  onClearAllData: () => void;
  userEmail: string;
  categoriesPemasukan: string[];
  categoriesPengeluaran: string[];
  onSaveCategories: (pemasukan: string[], pengeluaran: string[]) => void;
}

export default function SettingsTab({
  settings,
  onSaveSettings,
  onClearAllData,
  userEmail,
  categoriesPemasukan,
  categoriesPengeluaran,
  onSaveCategories
}: SettingsTabProps) {
  const [reminderEnabled, setReminderEnabled] = useState(settings.reminderEnabled);
  const [reminderTime, setReminderTime] = useState(settings.reminderTime);
  const [notifySuccess, setNotifySuccess] = useState(false);
  const [testSuccessMessage, setTestSuccessMessage] = useState('');

  // State for category management
  const [activeCategoryTab, setActiveCategoryTab] = useState<'debit' | 'credit'>('debit');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [catError, setCatError] = useState('');

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setCatError('');
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    const targetList = activeCategoryTab === 'debit' ? categoriesPemasukan : categoriesPengeluaran;
    if (targetList.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setCatError('Kategori ini sudah terdaftar.');
      return;
    }

    if (activeCategoryTab === 'debit') {
      onSaveCategories([...categoriesPemasukan, trimmed], categoriesPengeluaran);
    } else {
      onSaveCategories(categoriesPemasukan, [...categoriesPengeluaran, trimmed]);
    }
    setNewCategoryName('');
  };

  const handleDeleteCategory = (catToDelete: string) => {
    setCatError('');
    if (activeCategoryTab === 'debit') {
      if (categoriesPemasukan.length <= 1) {
        setCatError('Minimal harus ada satu kategori pemasukan.');
        return;
      }
      onSaveCategories(
        categoriesPemasukan.filter(c => c !== catToDelete),
        categoriesPengeluaran
      );
    } else {
      if (categoriesPengeluaran.length <= 1) {
        setCatError('Minimal harus ada satu kategori pengeluaran.');
        return;
      }
      onSaveCategories(
        categoriesPemasukan,
        categoriesPengeluaran.filter(c => c !== catToDelete)
      );
    }
  };

  // Handle setting updates
  const handleUpdateReminder = (enabled: boolean, time: string) => {
    setReminderEnabled(enabled);
    setReminderTime(time);
    onSaveSettings({
      ...settings,
      reminderEnabled: enabled,
      reminderTime: time
    });
  };

  // Test System Notification API with in-app banner fallback
  const handleTestNotification = async () => {
    setTestSuccessMessage('');
    
    // Check if notification is supported
    if (!('Notification' in window)) {
      triggerInAppBanner('Browser Anda tidak mendukung push notifikasi. Menampilkan notifikasi in-app simulasi.');
      return;
    }

    // Request permissions if not granted yet
    if (Notification.permission !== 'granted') {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          triggerInAppBanner('Izin notifikasi ditolak. Menampilkan notifikasi in-app simulasi.');
          return;
        }
      } catch (e) {
        triggerInAppBanner('Gagal meminta izin notifikasi dalam iframe. Menampilkan notifikasi in-app simulasi.');
        return;
      }
    }

    // Fire real browser notification
    try {
      const notification = new Notification('Pengingat Buku Kas', {
        body: 'Halo Ravina! Jangan lupa untuk mencatat transaksi pengeluaran hari ini agar pembukuan tetap akurat. 📝🟢',
        icon: 'https://cdn-icons-png.flaticon.com/512/2910/2910156.png', // Cash Icon placeholder
        tag: 'buku-kas-daily-reminder'
      });
      setTestSuccessMessage('Notifikasi sistem berhasil dikirim!');
      setTimeout(() => setTestSuccessMessage(''), 4000);
    } catch (err) {
      triggerInAppBanner('Mengirim notifikasi in-app karena keterbatasan sandbox iframe.');
    }
  };

  const triggerInAppBanner = (msg: string) => {
    setTestSuccessMessage(`🔔 ${msg}`);
    setTimeout(() => setTestSuccessMessage(''), 5000);
  };

  const handleResetData = () => {
    const check = window.confirm('Apakah Anda yakin ingin menghapus seluruh transaksi lokal? Data yang belum disinkronkan akan hilang.');
    if (check) {
      onClearAllData();
      setNotifySuccess(true);
      setTimeout(() => setNotifySuccess(false), 3000);
    }
  };

  return (
    <div className="p-5 flex flex-col gap-5 select-none text-slate-100">
      
      {/* Account Profile Card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 p-5 flex items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full filter blur-2xl" />
        
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
          <User className="w-7.5 h-7.5" />
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Administrator Resmi
          </span>
          <span className="text-sm font-bold text-slate-200 mt-0.5 truncate">Ravina Arcamanik</span>
          <span className="text-xs text-slate-400 font-mono truncate">{userEmail}</span>
        </div>
      </div>

      {/* Daily Reminder Manager Panel */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-emerald-400" />
            Pengingat Harian (Notifikasi)
          </h4>
          
          {/* Custom Toggle Switch */}
          <button
            onClick={() => handleUpdateReminder(!reminderEnabled, reminderTime)}
            className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ${
              reminderEnabled ? 'bg-emerald-500' : 'bg-slate-800 border border-slate-700'
            }`}
            id="toggle-reminder"
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
              reminderEnabled ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        <p className="text-[10px] text-slate-500 leading-relaxed">
          Hidupkan alarm pengingat harian agar aplikasi mengirimkan pemberitahuan untuk mencatat transaksi arus kas tepat waktu.
        </p>

        {reminderEnabled && (
          <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 flex flex-col gap-3 select-text animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Pilih Waktu Alarm:</span>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => handleUpdateReminder(reminderEnabled, e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-emerald-400 font-bold p-1.5 rounded-lg focus:outline-none"
                id="reminder-time-input"
              />
            </div>

            <button
              onClick={handleTestNotification}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors"
              id="btn-test-notification"
            >
              Test Kirim Notifikasi Pengingat
            </button>
          </div>
        )}

        {testSuccessMessage && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[10px] leading-relaxed flex items-start gap-2 select-text">
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p className="font-medium">{testSuccessMessage}</p>
          </div>
        )}
      </div>

      {/* Android Studio Integration Help Card */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          Proyek Native Android (Kotlin & Jetpack Compose)
        </h4>
        <p className="text-[10px] text-slate-500 leading-relaxed mb-3">
          Saya telah membuatkan proyek Native Android murni (bukan PWA hibrid/Capacitor) yang ditulis menggunakan <strong>Kotlin & Jetpack Compose</strong> di folder <code className="text-emerald-400 bg-black/40 px-1 py-0.5 rounded">/android</code>. Proyek ini siap dibuka di Android Studio untuk membuat file APK asli Anda.
        </p>

        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-[10px] leading-relaxed text-slate-400 select-text">
          <div className="font-semibold text-slate-200 flex items-center gap-1 mb-1.5">
            <SmartphoneNfc className="w-4 h-4 text-emerald-400" /> Fitur Kode Native Android di Folder <code className="text-slate-200">/android</code>:
          </div>
          <ul className="list-disc list-inside flex flex-col gap-1.5 pl-0.5">
            <li><strong>Room Database</strong>: Penyimpanan database SQLite lokal yang aman dan murni untuk pencatatan transaksi offline.</li>
            <li><strong>Retrofit</strong>: Handler sinkronisasi HTTP langsung ke Google Apps Script Anda (mendukung field <code className="text-slate-300">tanggal, kategori, keterangan, debet, kredit, saldo</code>).</li>
            <li><strong>Jetpack Compose</strong>: Antarmuka modern Material 3 dengan bagan grafik, warna hijau-merah dinamis, dan login admin.</li>
            <li><strong>AlarmManager & NotificationReceiver</strong>: Alarm internal Android untuk mengirimkan push notification pengingat jam 20:00 harian secara andal.</li>
            <li><strong>Siap Impor & Run</strong>: Cukup buka Android Studio, pilih menu <strong>File -&gt; Open</strong>, lalu pilih folder <code className="text-emerald-400 bg-black/40 px-1 py-0.5 rounded">/android</code> dari proyek yang Anda unduh/ekspor ini untuk langsung melakukan <strong>Build APK</strong>!</li>
          </ul>
        </div>
      </div>

      {/* Manage Categories Section */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <SmartphoneNfc className="w-4 h-4 text-emerald-400" />
          Kelola Kategori Arus Kas
        </h4>
        <p className="text-[10px] text-slate-500 leading-relaxed mb-4">
          Tambahkan atau hapus kategori kustom untuk menyesuaikan pencatatan keuangan Anda.
        </p>

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-1 bg-slate-900 rounded-xl border border-slate-800 mb-4">
          <button
            onClick={() => { setActiveCategoryTab('debit'); setCatError(''); }}
            className={`py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold transition-all ${
              activeCategoryTab === 'debit'
                ? 'bg-emerald-500 text-white font-extrabold'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Pemasukan (Debet)
          </button>
          <button
            onClick={() => { setActiveCategoryTab('credit'); setCatError(''); }}
            className={`py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold transition-all ${
              activeCategoryTab === 'credit'
                ? 'bg-rose-500 text-white font-extrabold'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Pengeluaran (Kredit)
          </button>
        </div>

        {/* Category list tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(activeCategoryTab === 'debit' ? categoriesPemasukan : categoriesPengeluaran).map((cat) => (
            <div 
              key={cat} 
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 font-medium"
            >
              <span>{cat}</span>
              <button
                type="button"
                onClick={() => handleDeleteCategory(cat)}
                className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                title={`Hapus kategori ${cat}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Error message */}
        {catError && (
          <div className="p-2 mb-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-[10px] flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{catError}</span>
          </div>
        )}

        {/* Add Category Form */}
        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            type="text"
            required
            placeholder="Kategori baru..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold rounded-xl text-xs flex items-center gap-1 border border-slate-700/80 hover:border-emerald-500/30 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah
          </button>
        </form>
      </div>

      {/* Reset Data and System Settings */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <Trash2 className="w-4 h-4 text-rose-500" />
          Zona Bahaya (Risiko Data)
        </h4>

        {notifySuccess && (
          <div className="mb-3 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-[10px] flex items-center gap-2">
            <Check className="w-3.5 h-3.5" />
            <span>Seluruh transaksi lokal berhasil dibersihkan!</span>
          </div>
        )}

        <button
          onClick={handleResetData}
          className="w-full py-2.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all"
          id="btn-clear-local-data"
        >
          Bersihkan Seluruh Transaksi Lokal
        </button>
      </div>

    </div>
  );
}
