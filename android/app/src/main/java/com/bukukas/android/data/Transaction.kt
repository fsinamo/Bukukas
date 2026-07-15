package com.bukukas.android.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "transactions")
data class Transaction(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val tanggal: String,       // Format: YYYY-MM-DD
    val kategori: String,      // e.g. Pemasukan, Pengeluaran
    val keterangan: String,
    val debet: Double,
    val kredit: Double,
    val saldo: Double,
    val isSynced: Boolean = false // Track sync status with Google Sheets
)
