/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * GOOGLE APPS SCRIPT - BUKU KAS ANDROID INTEGRATION SCRIPT
 * 
 * Petunjuk Penggunaan:
 * 1. Buka Google Sheet baru atau yang sudah ada di akun Anda (ravinaarcamanik@gmail.com).
 * 2. Klik menu "Extensions" (Ekstensi) -> "Apps Script".
 * 3. Hapus kode bawaan, lalu salin dan tempel (paste) seluruh kode ini.
 * 4. Klik ikon Simpan (Save).
 * 5. Klik tombol "Deploy" -> "New deployment" (Penerapan Baru).
 * 6. Pilih tipe "Web app" (Aplikasi Web).
 * 7. Konfigurasi:
 *    - Description: Buku Kas Sync API
 *    - Execute as: "Me" (Saya - ravinaarcamanik@gmail.com)
 *    - Who has access: "Anyone" (Siapa saja - agar aplikasi bisa mengirim data)
 * 8. Klik "Deploy" dan berikan izin akses jika diminta (Authorize Access).
 * 9. Salin "Web app URL" (URL Aplikasi Web) yang dihasilkan, lalu masukkan URL tersebut ke tab 'Sinkronisasi' di aplikasi Buku Kas Anda.
 */

function doPost(e) {
  try {
    var lock = LockService.getScriptLock();
    // Tunggu maksimal 30 detik untuk menghindari tabrakan penulisan data
    lock.waitLock(30000);
    
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = "appdb";
    var sheet = spreadsheet.getSheetByName(sheetName);
    
    // Buat sheet baru jika belum ada
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      // Buat header kolom
      sheet.appendRow([
        "ID Transaksi", 
        "Tanggal", 
        "Kategori", 
        "Keterangan", 
        "Debet", 
        "Kredit", 
        "Saldo"
      ]);
      // Format header agar rapi
      sheet.getRange("A1:G1").setFontWeight("bold").setBackground("#10B981").setFontColor("#FFFFFF");
    }

    var payload = JSON.parse(e.postData.contents);
    var responseData = { success: true };

    if (payload.action === "sync") {
      var transactions = payload.transactions;
      
      // Ambil seluruh ID transaksi yang sudah ada di sheet untuk mencegah duplikasi
      var existingRows = sheet.getDataRange().getValues();
      var idMap = {};
      for (var i = 1; i < existingRows.length; i++) {
        var id = existingRows[i][0]; // Kolom A
        if (id) {
          idMap[id] = i + 1; // Simpan baris fisik (1-indexed, header = baris 1)
        }
      }

      var runningBalance = 0;
      
      // Sinkronkan setiap transaksi
      transactions.forEach(function(tx) {
        var rowIndex = idMap[tx.id];
        var rowData = [
          tx.id,
          tx.date,
          tx.category,
          tx.description,
          tx.debit,
          tx.credit,
          0 // Saldo berjalan dihitung ulang di bawah
        ];

        if (rowIndex) {
          // Update baris yang sudah ada jika ada perubahan
          var range = sheet.getRange(rowIndex, 1, 1, 7);
          range.setValues([rowData]);
        } else {
          // Tambahkan baris baru
          sheet.appendRow(rowData);
        }
      });

      // Hitung ulang saldo berjalan dari atas ke bawah untuk konsistensi rumus
      var allRows = sheet.getDataRange().getValues();
      var balanceRangeValues = [];
      for (var k = 1; k < allRows.length; k++) {
        var debit = parseFloat(allRows[k][4]) || 0;
        var credit = parseFloat(allRows[k][5]) || 0;
        runningBalance = runningBalance + debit - credit;
        balanceRangeValues.push([runningBalance]);
      }

      if (balanceRangeValues.length > 0) {
        // Tulis ulang seluruh saldo berjalan di kolom G (kolom ke-7)
        sheet.getRange(2, 7, balanceRangeValues.length, 1).setValues(balanceRangeValues);
      }

      responseData.message = "Sinkronisasi " + transactions.length + " transaksi berhasil!";
      responseData.syncedCount = transactions.length;
    } else {
      responseData.success = false;
      responseData.message = "Aksi '" + payload.action + "' tidak dikenali.";
    }

    lock.releaseLock();
    
    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    if (lock) lock.releaseLock();
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Terjadi kesalahan di Apps Script: " + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Koneksi Buku Kas Sync API Aktif. Gunakan metode POST untuk sinkronisasi data.")
    .setMimeType(ContentService.MimeType.TEXT);
}
`;
