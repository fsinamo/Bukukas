/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  RefreshCw, 
  Database, 
  FileSpreadsheet, 
  FileDown, 
  Copy, 
  Check, 
  HelpCircle, 
  CloudCheck,
  Play,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { Transaction } from '../types';
import { GOOGLE_APPS_SCRIPT_CODE } from './GoogleScriptTemplate';
import { jsPDF } from 'jspdf';

interface SyncTabProps {
  transactions: Transaction[];
  appsScriptUrl: string;
  onSaveAppsScriptUrl: (url: string) => void;
  onSyncAll: () => Promise<{ success: boolean; message: string }>;
  isSyncing: boolean;
}

export default function SyncTab({
  transactions,
  appsScriptUrl,
  onSaveAppsScriptUrl,
  onSyncAll,
  isSyncing
}: SyncTabProps) {
  const [urlInput, setUrlInput] = useState(appsScriptUrl);
  const [copied, setCopied] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [isUrlSaving, setIsUrlSaving] = useState(false);

  // Filter transactions into pending vs synced
  const syncStats = useMemo(() => {
    let pendingCount = 0;
    let syncedCount = 0;

    transactions.forEach(t => {
      if (t.syncStatus === 'pending' || t.syncStatus === 'failed') {
        pendingCount++;
      } else {
        syncedCount++;
      }
    });

    return { pendingCount, syncedCount };
  }, [transactions]);

  // Handle saving Apps Script URL
  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUrlSaving(true);
    setTimeout(() => {
      onSaveAppsScriptUrl(urlInput.trim());
      setIsUrlSaving(false);
      addLog(`URL Apps Script disimpan: ${urlInput.slice(0, 30)}...`);
    }, 400);
  };

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSyncLogs(prev => [`[${timestamp}] ${msg}`, ...prev]);
  };

  // Perform bulk sync
  const handleSyncNow = async () => {
    setSyncLogs([]);
    addLog('Memulai sinkronisasi arus kas...');
    addLog(`Ditemukan ${syncStats.pendingCount} transaksi dalam antrean bulk.`);
    
    if (transactions.length === 0) {
      addLog('Batal: Tidak ada transaksi untuk disinkronkan.');
      return;
    }

    const res = await onSyncAll();
    if (res.success) {
      addLog('SUKSES: Seluruh data berhasil didepositkan ke Google Sheets!');
      addLog(res.message);
    } else {
      addLog('ERROR: Sinkronisasi gagal.');
      addLog(res.message);
    }
  };

  // Copy template script helper
  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // EXPORT TO EXCEL (CSV formatting with BOM for flawless Excel loading)
  const handleExportExcel = () => {
    addLog('Mengekspor data ke Excel (CSV format)...');
    
    // Sort transactions chronologically
    const sortedTx = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    
    // Header columns in Indonesian
    const headers = ['ID Transaksi', 'Tanggal', 'Kategori', 'Keterangan', 'Debet (Pemasukan)', 'Kredit (Pengeluaran)', 'Saldo'];
    
    let runningBalance = 0;
    const rows = sortedTx.map(tx => {
      runningBalance = runningBalance + tx.debit - tx.credit;
      return [
        tx.id,
        tx.date,
        tx.category,
        `"${tx.description.replace(/"/g, '""')}"`, // escape quotes
        tx.debit,
        tx.credit,
        runningBalance
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    // Add UTF-8 BOM so Excel opens indonesian currency/accents correctly
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Buku_Kas_Laporan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog('Ekspor Excel selesai!');
  };

  // EXPORT TO PDF
  const handleExportPDF = () => {
    addLog('Mempersiapkan dokumen PDF...');
    try {
      const doc = new jsPDF();
      
      // Page setup
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(16, 185, 129); // Emerald Green
      doc.text('LAPORAN BUKU KAS RAVINA', 14, 20);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // Slate Grey
      doc.text(`Waktu Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 26);
      doc.text(`Email Pengguna: ravinaarcamanik@gmail.com`, 14, 31);
      
      // Financial Summary Box
      let totalDebit = 0;
      let totalCredit = 0;
      transactions.forEach(t => {
        totalDebit += t.debit;
        totalCredit += t.credit;
      });
      const balance = totalDebit - totalCredit;

      doc.setFillColor(241, 245, 249); // light background
      doc.roundedRect(14, 36, 182, 24, 3, 3, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL PEMASUKAN', 20, 43);
      doc.text('TOTAL PENGELUARAN', 80, 43);
      doc.text('SALDO AKHIR', 140, 43);

      doc.setFontSize(12);
      doc.setTextColor(16, 185, 129); // Green
      doc.text(`Rp ${totalDebit.toLocaleString('id-ID')}`, 20, 51);
      doc.setTextColor(239, 68, 68); // Red
      doc.text(`Rp ${totalCredit.toLocaleString('id-ID')}`, 80, 51);
      doc.setTextColor(30, 41, 59); // Dark slate
      doc.text(`Rp ${balance.toLocaleString('id-ID')}`, 140, 51);

      // Ledger Table
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      
      // Draw Table Header
      doc.setFillColor(30, 41, 59); // Slate 800
      doc.rect(14, 68, 182, 8, 'F');
      
      doc.text('Tgl', 16, 73);
      doc.text('Kategori', 38, 73);
      doc.text('Keterangan', 72, 73);
      doc.text('Pemasukan (Rp)', 125, 73);
      doc.text('Pengeluaran (Rp)', 158, 73);

      // Sort transactions oldest first
      const sortedTx = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);

      let yPosition = 82;
      sortedTx.forEach((tx, index) => {
        // Handle multi-page layout if table overflows page length
        if (yPosition > 275) {
          doc.addPage();
          yPosition = 20;
          // Re-draw header table on new page
          doc.setFillColor(30, 41, 59);
          doc.rect(14, yPosition, 182, 8, 'F');
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(255, 255, 255);
          doc.text('Tgl', 16, yPosition + 5);
          doc.text('Kategori', 38, yPosition + 5);
          doc.text('Keterangan', 72, yPosition + 5);
          doc.text('Pemasukan (Rp)', 125, yPosition + 5);
          doc.text('Pengeluaran (Rp)', 158, yPosition + 5);
          
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(51, 65, 85);
          yPosition += 15;
        }

        // Draw zebra striping
        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, yPosition - 4, 182, 6.5, 'F');
        }

        // Clip long description texts
        const desc = tx.description.length > 25 ? tx.description.substring(0, 23) + '...' : tx.description;

        doc.text(tx.date, 16, yPosition);
        doc.text(tx.category, 38, yPosition);
        doc.text(desc, 72, yPosition);
        doc.text(tx.debit > 0 ? tx.debit.toLocaleString('id-ID') : '-', 125, yPosition);
        doc.text(tx.credit > 0 ? tx.credit.toLocaleString('id-ID') : '-', 158, yPosition);

        yPosition += 6.5;
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Laporan Buku Kas Ravina • Sinkronisasi Google Sheets • Diunduh secara Aman', 14, 287);

      doc.save(`Buku_Kas_Laporan_${new Date().toISOString().split('T')[0]}.pdf`);
      addLog('Ekspor PDF selesai!');
    } catch (e: any) {
      console.error(e);
      addLog(`Gagal membuat PDF: ${e.message}`);
    }
  };

  return (
    <div className="p-5 flex flex-col gap-5 select-none text-slate-100">
      
      {/* Sync Status Hub Card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-200">Status Sinkronisasi</h3>
          </div>
          <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 border border-slate-700">
            Arus Kas
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex flex-col">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Antrean Bulk (Lokal)</span>
            <span className="text-lg font-black text-amber-400 mt-1">{syncStats.pendingCount}</span>
            <span className="text-[8px] text-slate-500 mt-0.5">Disimpan di browser</span>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex flex-col">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Tersinkron (Sheet)</span>
            <span className="text-lg font-black text-emerald-400 mt-1">{syncStats.syncedCount}</span>
            <span className="text-[8px] text-slate-500 mt-0.5">Tersimpan di awan</span>
          </div>
        </div>

        {/* Sync Button */}
        <button
          onClick={handleSyncNow}
          disabled={isSyncing}
          className="w-full py-3.5 mt-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
          id="btn-sync-trigger"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Sedang Mensinkronisasikan...' : 'Sinkronkan Antrean Sekarang'}
        </button>
      </div>

      {/* Export Financial Reports Panel */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <FileDown className="w-4 h-4 text-emerald-400" />
          Ekspor Laporan Keuangan
        </h4>
        <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
          Unduh laporan keuangan Anda untuk kebutuhan pembukuan eksternal, presentasi, ataupun analisis detail di komputer.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleExportPDF}
            className="flex flex-col items-center gap-2 p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-center transition-all"
            id="btn-export-pdf"
          >
            <div className="w-9 h-9 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
              <FileDown className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Unduh PDF</span>
            <span className="text-[9px] text-slate-500">Laporan Format Cetak</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex flex-col items-center gap-2 p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-center transition-all"
            id="btn-export-excel"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Unduh Excel</span>
            <span className="text-[9px] text-slate-500">Analisis Spreadsheet</span>
          </button>
        </div>
      </div>

      {/* Apps Script Configuration Card */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-emerald-400" />
            Konfigurasi Google Apps Script
          </h4>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
            id="btn-toggle-instructions"
          >
            <HelpCircle className="w-3.5 h-3.5" /> {showInstructions ? 'Sembunyikan' : 'Petunjuk'}
          </button>
        </div>

        {/* Form to set Web App URL */}
        <form onSubmit={handleSaveUrl} className="flex flex-col gap-2.5 select-text">
          <input
            type="url"
            placeholder="Masukkan URL Web App Apps Script Anda..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            id="apps-script-url-input"
          />
          <button
            type="submit"
            disabled={isUrlSaving}
            className="self-end py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-all"
            id="btn-save-script-url"
          >
            {isUrlSaving ? 'Menyimpan...' : 'Simpan URL'}
          </button>
        </form>

        {/* Help instructions drawer */}
        {showInstructions && (
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col gap-2.5 text-[11px] leading-relaxed text-slate-400 select-text">
            <h5 className="font-bold text-slate-200 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Cara Menghubungkan Google Sheet:
            </h5>
            <ol className="list-decimal list-inside flex flex-col gap-1.5 text-slate-400 pl-1">
              <li>Buat Spreadsheet Baru di Google Drive (Login email: <span className="text-slate-200 font-medium">ravinaarcamanik@gmail.com</span>).</li>
              <li>Klik <span className="text-slate-200">Ekstensi</span> &gt; <span className="text-slate-200">Apps Script</span>.</li>
              <li>Salin kode template di bawah ini secara penuh.</li>
              <li>Simpan proyek, lalu klik <span className="text-slate-200">Terapkan &gt; Penerapan Baru</span>.</li>
              <li>Pilih tipe <span className="text-slate-200">Aplikasi Web</span>, setel Akses ke <span className="text-slate-200">"Siapa Saja" (Anyone)</span>, lalu Deploy.</li>
              <li>Salin URL Aplikasi Web yang diberikan, tempel di kolom input di atas, lalu klik Simpan URL.</li>
            </ol>

            {/* Template Copy Block */}
            <div className="mt-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                <span>Kode Apps Script (.gs)</span>
                <button
                  onClick={handleCopyCode}
                  type="button"
                  className="flex items-center gap-1 py-1 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 transition-colors"
                  id="btn-copy-template"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Tersalin' : 'Salin Kode'}
                </button>
              </div>
              <textarea
                readOnly
                value={GOOGLE_APPS_SCRIPT_CODE}
                className="w-full h-32 p-2 bg-slate-950 rounded-lg text-[9px] font-mono text-emerald-400 border border-slate-800 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sync Log Monitor */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            Konsol Log Sinkronisasi
          </h4>
          <span className="text-[8px] text-slate-600 font-medium uppercase tracking-wider">Real-time</span>
        </div>
        
        <div className="h-28 overflow-y-auto p-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[9px] text-emerald-500/80 leading-relaxed flex flex-col gap-1 select-text">
          {syncLogs.length === 0 ? (
            <span className="text-slate-600 italic">Antrean siap disinkronkan. Menunggu aktivitas...</span>
          ) : (
            syncLogs.map((log, idx) => <div key={idx} className="border-b border-slate-900 pb-1">{log}</div>)
          )}
        </div>
      </div>

    </div>
  );
}
