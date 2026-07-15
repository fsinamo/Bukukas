/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  category: string;
  description: string;
  debit: number;  // Pemasukan (Uang Masuk)
  credit: number; // Pengeluaran (Uang Keluar)
  balance: number; // Saldo
  syncStatus: 'synced' | 'pending' | 'failed';
  createdAt: number;
}

export interface SyncQueueItem {
  id: string;
  action: 'add' | 'delete';
  transaction: Transaction;
  timestamp: number;
}

export interface UserSettings {
  reminderEnabled: boolean;
  reminderTime: string; // "HH:MM"
  appsScriptUrl: string; // Google Apps Script URL for deployment
}

export interface DashboardMetrics {
  totalDebit: number;
  totalCredit: number;
  balance: number;
  monthlyDebit: number;
  monthlyCredit: number;
}
