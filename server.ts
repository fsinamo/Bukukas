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
      let currentUrl = appsScriptUrl;
      let method = 'POST';
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      let body: string | undefined = JSON.stringify({
        action: 'sync',
        transactions: transactions
      });

      let response: any = null;
      let redirectCount = 0;
      const maxRedirects = 5;

      while (redirectCount < maxRedirects) {
        response = await fetch(currentUrl, {
          method,
          headers,
          body,
          redirect: 'manual' // Manually follow redirects to ensure correct method conversion (POST -> GET) and header stripping
        });

        // Handle redirect statuses (301, 302, 303, 307, 308)
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (!location) {
            break;
          }
          
          // Resolve relative redirects
          currentUrl = new URL(location, currentUrl).toString();
          redirectCount++;

          // For 301, 302, 303, convert to GET and strip body & headers
          if (response.status === 301 || response.status === 302 || response.status === 303) {
            method = 'GET';
            headers = {};
            body = undefined;
          }
          continue;
        }
        break;
      }

      if (!response) {
        throw new Error('Tidak ada respons dari Google Apps Script setelah pengalihan.');
      }

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { text: responseText };
      }

      if (response.ok) {
        return res.json({
          success: true,
          simulated: false,
          data: responseData,
          message: 'Sinkronisasi dengan Google Sheet berhasil!'
        });
      } else {
        return res.status(response.status).json({
          success: false,
          message: `Gagal sinkronisasi. Apps Script merespons dengan status ${response.status}.`,
          error: responseText
        });
      }
    } catch (error: any) {
      console.error('Error during Google Sheet sync:', error);
      return res.status(500).json({
        success: false,
        message: 'Koneksi gagal. Silakan periksa kembali URL Apps Script Anda.',
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
