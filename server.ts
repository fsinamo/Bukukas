/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API 1: Login Authentication
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    // Strict requirement from user
    if (email === 'ravinaarcamanik@gmail.com' && password === 'Ravina_15') {
      return res.json({
        success: true,
        user: {
          email: 'ravinaarcamanik@gmail.com',
          name: 'Ravina Arcamanik'
        },
        token: 'token_ravina_buku_kas_2026'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Email atau password salah! Akses hanya untuk pengguna khusus.'
    });
  });

  // API 2: Proxy to Google Apps Script (Bypasses CORS issues in browser)
  app.post('/api/sync', async (req, res) => {
    const { appsScriptUrl, transactions } = req.body;

    if (!appsScriptUrl) {
      // If no Apps Script URL, succeed by simulating so the user can use the app offline or see the flow
      return res.json({
        success: true,
        simulated: true,
        message: 'Mode offline aktif atau Apps Script belum dikonfigurasi. Data disimpan secara lokal di aplikasi.'
      });
    }

    try {
      console.log('Memulai sinkronisasi ke Apps Script:', appsScriptUrl);

      // Node.js fetch (undici) mengikuti redirect (302 Found) otomatis secara default.
      // Di redirect 302, fetch akan mengubah method POST menjadi GET secara otomatis dan
      // menghapus body/headers sesuai standar web, yang mana tepat seperti yang dibutuhkan
      // oleh server deployment Google Apps Script untuk mengakses output doGet hasil eksekusi doPost.
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sync',
          transactions: transactions
        }),
        redirect: 'follow'
      });

      console.log(`Respons dari Apps Script: Status ${response.status} (${response.statusText})`);

      const responseText = await response.text();
      
      // Deteksi jika Google Apps Script mengembalikan halaman HTML (misalnya login Google atau halaman error Google)
      const isHtml = responseText.trim().startsWith('<') || responseText.includes('<!DOCTYPE html>') || responseText.includes('<html');

      if (isHtml) {
        console.warn('Apps Script mengembalikan respons HTML, bukan JSON. Preview isi respons:', responseText.slice(0, 300));
        
        let customMessage = 'Google Apps Script mengembalikan halaman HTML (Bukan JSON). ';
        if (responseText.includes('Google Accounts') || responseText.includes('Sign in') || responseText.includes('ServiceLogin')) {
          customMessage += 'Penyebab: Akses dibatasi. Pastikan Anda telah menyetel "Who has access" ke "Anyone" (Siapa saja) saat melakukan deployment (Penerapan Baru) di Google Apps Script Anda.';
        } else {
          customMessage += 'Penyebab: Ada kesalahan konfigurasi atau URL Apps Script yang dimasukkan salah/tidak valid.';
        }

        return res.json({
          success: false,
          simulated: false,
          message: customMessage,
          error: responseText.slice(0, 300)
        });
      }

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.warn('Gagal memproses respons sebagai JSON. Isi respons:', responseText.slice(0, 300));
        return res.json({
          success: false,
          simulated: false,
          message: 'Respons dari Google Apps Script tidak valid (bukan format JSON yang benar).',
          error: responseText.slice(0, 300)
        });
      }

      if (response.ok && (responseData.success || responseData.success === undefined)) {
        return res.json({
          success: true,
          simulated: false,
          data: responseData,
          message: responseData.message || 'Sinkronisasi dengan Google Sheet berhasil!'
        });
      } else {
        return res.json({
          success: false,
          simulated: false,
          message: responseData.message || `Gagal sinkronisasi. Apps Script merespons dengan status ${response.status}.`,
          error: responseText
        });
      }
    } catch (error: any) {
      console.error('Error during Google Sheet sync:', error);
      return res.json({
        success: false,
        simulated: false,
        message: 'Koneksi gagal. Silakan periksa kembali URL Apps Script Anda atau pastikan server Anda terhubung ke internet.',
        error: error.message
      });
    }
  });

  // Serve Frontend
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Buku Kas Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
