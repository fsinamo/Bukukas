package com.bukukas.android

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.Canvas
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import com.bukukas.android.data.AppDatabase
import com.bukukas.android.data.Transaction
import com.bukukas.android.receiver.ReminderReceiver
import com.bukukas.android.service.RetrofitClient
import com.bukukas.android.service.TransactionPayload
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : ComponentActivity() {
    private val db by lazy { AppDatabase.getDatabase(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                BukuKasApp(
                    db = db,
                    onExportCsv = { exportLedgerToShare(it) },
                    onSetReminder = { enable -> toggleDailyReminder(enable) }
                )
            }
        }
    }

    private fun exportLedgerToShare(transactions: List<Transaction>) {
        val stringBuilder = StringBuilder()
        stringBuilder.append("Tanggal,Kategori,Keterangan,Debet,Kredit,Saldo\n")
        transactions.forEach { tx ->
            stringBuilder.append("${tx.tanggal},${tx.kategori},${tx.keterangan},${tx.debet},${tx.kredit},${tx.saldo}\n")
        }

        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "Ledger Buku Kas")
            putExtra(Intent.EXTRA_TEXT, stringBuilder.toString())
        }
        startActivity(Intent.createChooser(shareIntent, "Bagikan Ledger Buku Kas"))
    }

    private fun toggleDailyReminder(enable: Boolean) {
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(this, ReminderReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        if (enable) {
            val calendar = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 20) // 8 PM
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                if (before(Calendar.getInstance())) {
                    add(Calendar.DATE, 1)
                }
            }
            try {
                alarmManager.setRepeating(
                    AlarmManager.RTC_WAKEUP,
                    calendar.timeInMillis,
                    AlarmManager.INTERVAL_DAY,
                    pendingIntent
                )
                Toast.makeText(this, "Pengingat harian dijadwalkan jam 20:00", Toast.LENGTH_SHORT).show()
            } catch (e: SecurityException) {
                Toast.makeText(this, "Izin alarm tidak disetujui", Toast.LENGTH_SHORT).show()
            }
        } else {
            alarmManager.cancel(pendingIntent)
            Toast.makeText(this, "Pengingat harian dinonaktifkan", Toast.LENGTH_SHORT).show()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BukuKasApp(
    db: AppDatabase,
    onExportCsv: (List<Transaction>) -> Unit,
    onSetReminder: (Boolean) -> Unit
) {
    var isLoggedIn by remember { mutableStateOf(false) }
    var currentTab by remember { mutableStateOf(0) } // 0: Dasbor, 1: Transaksi, 2: Sinkronisasi, 3: Pengaturan
    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current

    // Local application state
    val transactions by db.transactionDao().getAllTransactions().collectAsState(initial = emptyList())
    var scriptUrl by remember { mutableStateOf("") }
    var syncLogs by remember { mutableStateOf(listOf<String>()) }
    var preselectedIsDebit by remember { mutableStateOf(true) }
    
    // Load script URL preference
    LaunchedEffect(Unit) {
        val prefs = context.getSharedPreferences("buku_kas_prefs", Context.MODE_PRIVATE)
        scriptUrl = prefs.getString("script_url", "") ?: ""
    }

    if (!isLoggedIn) {
        LoginScreen { success -> isLoggedIn = success }
    } else {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Buku Kas Android", fontWeight = FontWeight.Bold, color = Color.White) },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF020617)),
                    actions = {
                        IconButton(onClick = { onExportCsv(transactions) }) {
                            Icon(Icons.Default.Share, contentDescription = "Ekspor & Bagikan", tint = Color.White)
                        }
                    }
                )
            },
            bottomBar = {
                NavigationBar(containerColor = Color(0xFF020617)) {
                    NavigationBarItem(
                        selected = currentTab == 0,
                        onClick = { currentTab = 0 },
                        icon = { Icon(Icons.Default.Home, contentDescription = "Dasbor") },
                        label = { Text("Dasbor") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Color(0xFF10B981),
                            selectedTextColor = Color(0xFF10B981),
                            unselectedIconColor = Color(0xFF64748B),
                            unselectedTextColor = Color(0xFF64748B),
                            indicatorColor = Color(0xFF1E293B)
                        )
                    )
                    NavigationBarItem(
                        selected = currentTab == 1,
                        onClick = { currentTab = 1 },
                        icon = { Icon(Icons.Default.Add, contentDescription = "Transaksi") },
                        label = { Text("Transaksi") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Color(0xFF10B981),
                            selectedTextColor = Color(0xFF10B981),
                            unselectedIconColor = Color(0xFF64748B),
                            unselectedTextColor = Color(0xFF64748B),
                            indicatorColor = Color(0xFF1E293B)
                        )
                    )
                    NavigationBarItem(
                        selected = currentTab == 2,
                        onClick = { currentTab = 2 },
                        icon = { Icon(Icons.Default.Refresh, contentDescription = "Sinkronisasi") },
                        label = { Text("Sinkronisasi") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Color(0xFF10B981),
                            selectedTextColor = Color(0xFF10B981),
                            unselectedIconColor = Color(0xFF64748B),
                            unselectedTextColor = Color(0xFF64748B),
                            indicatorColor = Color(0xFF1E293B)
                        )
                    )
                    NavigationBarItem(
                        selected = currentTab == 3,
                        onClick = { currentTab = 3 },
                        icon = { Icon(Icons.Default.Settings, contentDescription = "Pengaturan") },
                        label = { Text("Pengaturan") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Color(0xFF10B981),
                            selectedTextColor = Color(0xFF10B981),
                            unselectedIconColor = Color(0xFF64748B),
                            unselectedTextColor = Color(0xFF64748B),
                            indicatorColor = Color(0xFF1E293B)
                        )
                    )
                }
            }
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .background(Color(0xFF0F172A))
            ) {
                when (currentTab) {
                    0 -> DashboardScreen(
                        transactions = transactions,
                        onDelete = { tx ->
                            coroutineScope.launch(Dispatchers.IO) {
                                db.transactionDao().deleteTransaction(tx)
                            }
                        },
                        onNavigateToRecord = { isDebit ->
                            preselectedIsDebit = isDebit
                            currentTab = 1
                        }
                    )
                    1 -> AddTransactionScreen(
                        preselectedIsDebit = preselectedIsDebit,
                        onAdd = { date, category, desc, isDebit, amount ->
                            coroutineScope.launch(Dispatchers.IO) {
                                val currentSaldo = if (transactions.isNotEmpty()) transactions.first().saldo else 0.0
                                val debitAmount = if (isDebit) amount else 0.0
                                val creditAmount = if (!isDebit) amount else 0.0
                                val newSaldo = currentSaldo + debitAmount - creditAmount

                                val newTx = Transaction(
                                    tanggal = date,
                                    kategori = category,
                                    keterangan = desc,
                                    debet = debitAmount,
                                    kredit = creditAmount,
                                    saldo = newSaldo,
                                    isSynced = false
                                )
                                db.transactionDao().insertTransaction(newTx)
                                withContext(Dispatchers.Main) {
                                    Toast.makeText(context, "Transaksi berhasil disimpan secara offline", Toast.LENGTH_SHORT).show()
                                    currentTab = 0
                                }
                            }
                        }
                    )
                    2 -> {
                        SyncScreen(
                            transactions = transactions,
                            scriptUrl = scriptUrl,
                            onSaveUrl = { newUrl ->
                                scriptUrl = newUrl
                                val prefs = context.getSharedPreferences("buku_kas_prefs", Context.MODE_PRIVATE)
                                prefs.edit().putString("script_url", newUrl).apply()
                                Toast.makeText(context, "URL Apps Script disimpan", Toast.LENGTH_SHORT).show()
                                val timeStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                                syncLogs = listOf("[$timeStr] URL Apps Script disimpan.") + syncLogs
                            },
                            onSync = {
                                coroutineScope.launch(Dispatchers.IO) {
                                    if (transactions.isEmpty()) {
                                        withContext(Dispatchers.Main) {
                                            Toast.makeText(context, "Tidak ada data untuk disinkronkan", Toast.LENGTH_SHORT).show()
                                        }
                                        return@launch
                                    }
                                    if (scriptUrl.isEmpty()) {
                                        withContext(Dispatchers.Main) {
                                            Toast.makeText(context, "Atur URL Apps Script terlebih dahulu", Toast.LENGTH_SHORT).show()
                                        }
                                        return@launch
                                    }

                                    val timeStart = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                                    withContext(Dispatchers.Main) {
                                        syncLogs = listOf("[$timeStart] Memulai sinkronisasi arus kas...") + syncLogs
                                    }

                                    try {
                                        val payloadItems = transactions.map { tx ->
                                            com.bukukas.android.service.TransactionItemPayload(
                                                id = tx.id.toString(),
                                                date = tx.tanggal,
                                                category = tx.kategori,
                                                description = tx.keterangan,
                                                debit = tx.debet,
                                                credit = tx.kredit
                                            )
                                        }
                                        val payload = com.bukukas.android.service.BulkSyncPayload(
                                            action = "sync",
                                            transactions = payloadItems
                                        )
                                        val response = RetrofitClient.getClient().syncAllTransactions(scriptUrl, payload)
                                        if (response.isSuccessful) {
                                            // Update all local transactions to isSynced = true
                                            transactions.forEach { tx ->
                                                db.transactionDao().updateTransaction(tx.copy(isSynced = true))
                                            }
                                            val timeSuccess = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                                            withContext(Dispatchers.Main) {
                                                Toast.makeText(context, "Sinkronisasi berhasil! Semua data diperbarui di Google Sheets.", Toast.LENGTH_LONG).show()
                                                syncLogs = listOf(
                                                    "[$timeSuccess] SUKSES: Seluruh data berhasil didepositkan ke Google Sheets!",
                                                    "[$timeSuccess] Sinkronisasi ${payloadItems.size} transaksi berhasil!"
                                                ) + syncLogs
                                            }
                                        } else {
                                            val errorBody = response.errorBody()?.string() ?: response.message()
                                            val timeErr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                                            withContext(Dispatchers.Main) {
                                                Toast.makeText(context, "Sinkronisasi gagal: $errorBody", Toast.LENGTH_LONG).show()
                                                syncLogs = listOf("[$timeErr] ERROR: Sinkronisasi gagal: $errorBody") + syncLogs
                                            }
                                        }
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                        val timeErr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                                        withContext(Dispatchers.Main) {
                                            Toast.makeText(context, "Gagal sinkronisasi: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
                                            syncLogs = listOf("[$timeErr] ERROR: ${e.localizedMessage}") + syncLogs
                                        }
                                    }
                                }
                            },
                            syncLogs = syncLogs,
                            onExportCsv = onExportCsv
                        )
                    }
                    3 -> {
                        SettingsScreen(
                            onSetReminder = onSetReminder,
                            onClearAllData = {
                                coroutineScope.launch(Dispatchers.IO) {
                                    db.transactionDao().deleteAll()
                                    withContext(Dispatchers.Main) {
                                        Toast.makeText(context, "Semua data transaksi berhasil dibersihkan", Toast.LENGTH_SHORT).show()
                                        currentTab = 0
                                    }
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun LoginScreen(onLoginSuccess: (Boolean) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showError by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A))
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    "Masuk ke Buku Kas",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF10B981)
                )
                Spacer(modifier = Modifier.height(24.dp))

                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.LightGray,
                        focusedBorderColor = Color(0xFF10B981),
                        focusedLabelColor = Color(0xFF10B981),
                        unfocusedBorderColor = Color(0xFF1E293B),
                        unfocusedLabelColor = Color.Gray
                    )
                )
                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.LightGray,
                        focusedBorderColor = Color(0xFF10B981),
                        focusedLabelColor = Color(0xFF10B981),
                        unfocusedBorderColor = Color(0xFF1E293B),
                        unfocusedLabelColor = Color.Gray
                    )
                )

                if (showError) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Kredensial tidak valid",
                        color = Color.Red,
                        fontSize = 14.sp
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = {
                        if (email.trim() == "ravinaarcamanik@gmail.com" && password == "Ravina_15") {
                            onLoginSuccess(true)
                        } else {
                            showError = true
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Masuk", fontSize = 16.sp, color = Color.White)
                }
            }
        }
    }
}

data class MonthlyData(
    val monthLabel: String,
    val debit: Double,
    val credit: Double
)

@Composable
fun MonthlyTrendChart(data: List<MonthlyData>) {
    val maxVal = remember(data) {
        val maxInList = data.maxOfOrNull { maxOf(it.debit, it.credit) } ?: 1.0
        if (maxInList == 0.0) 1.0 else maxInList
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(200.dp)
            .background(Color(0xFF020617), shape = RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val width = size.width
            val height = size.height
            val barCount = data.size
            val groupWidth = width / barCount
            val barWidth = (groupWidth * 0.3f).coerceAtLeast(8f)
            val spacing = groupWidth * 0.1f

            // Draw grid lines
            val gridColor = Color(0xFF1E293B)
            val lineCount = 4
            for (i in 0..lineCount) {
                val y = height * (i.toFloat() / lineCount)
                drawLine(
                    color = gridColor,
                    start = androidx.compose.ui.geometry.Offset(0f, y),
                    end = androidx.compose.ui.geometry.Offset(width, y),
                    strokeWidth = 1f
                )
            }

            // Draw bars
            data.forEachIndexed { idx, item ->
                val groupLeft = idx * groupWidth
                
                // Debit bar (Emerald)
                val debitHeight = (item.debit / maxVal) * (height - 40f)
                val debitLeft = groupLeft + (groupWidth - barWidth * 2 - spacing) / 2
                val debitTop = height - 30f - debitHeight.toFloat()
                drawRoundRect(
                    color = Color(0xFF10B981),
                    topLeft = androidx.compose.ui.geometry.Offset(debitLeft, debitTop),
                    size = androidx.compose.ui.geometry.Size(barWidth, debitHeight.toFloat().coerceAtLeast(4f)),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(4f, 4f)
                )

                // Credit bar (Rose)
                val creditHeight = (item.credit / maxVal) * (height - 40f)
                val creditLeft = debitLeft + barWidth + spacing
                val creditTop = height - 30f - creditHeight.toFloat()
                drawRoundRect(
                    color = Color(0xFFEF4444),
                    topLeft = androidx.compose.ui.geometry.Offset(creditLeft, creditTop),
                    size = androidx.compose.ui.geometry.Size(barWidth, creditHeight.toFloat().coerceAtLeast(4f)),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(4f, 4f)
                )
            }
        }

        // Overlay of month labels at the bottom of the canvas
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .height(24.dp),
            horizontalArrangement = Arrangement.SpaceAround
        ) {
            data.forEach { item ->
                Text(
                    text = item.monthLabel,
                    fontSize = 10.sp,
                    color = Color(0xFF64748B),
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun CategoryDistributionSection(transactions: List<Transaction>) {
    val creditTransactions = transactions.filter { it.kredit > 0 }
    val totalCredit = creditTransactions.sumOf { it.kredit }

    if (creditTransactions.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF020617), RoundedCornerShape(16.dp))
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Text("Belum ada catatan pengeluaran", color = Color(0xFF64748B), fontSize = 12.sp)
        }
        return
    }

    val categoryMap = creditTransactions.groupBy { it.kategori }
        .mapValues { entry -> entry.value.sumOf { it.kredit } }
        .entries.sortedByDescending { it.value }
        .take(5)

    val colors = listOf(
        Color(0xFFF59E0B), // Amber
        Color(0xFFEF4444), // Red
        Color(0xFFEC4899), // Pink
        Color(0xFF8B5CF6), // Purple
        Color(0xFF3B82F6), // Blue
        Color(0xFF10B981)  // Emerald
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF020617), RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        val formatter = NumberFormat.getCurrencyInstance(Locale("in", "ID")).apply {
            maximumFractionDigits = 0
        }
        val maxVal = categoryMap.firstOrNull()?.value ?: 1.0

        categoryMap.forEachIndexed { idx, entry ->
            val color = colors[idx % colors.size]
            val pct = ((entry.value / totalCredit) * 100).toInt()
            val widthPct = entry.value / maxVal

            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(color, RoundedCornerShape(4.dp))
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(entry.key, fontSize = 12.sp, color = Color(0xFFE2E8F0), fontWeight = FontWeight.Medium)
                    }
                    Text(
                        "${formatter.format(entry.value)} ($pct%)",
                        fontSize = 12.sp,
                        color = Color(0xFF94A3B8),
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Spacer(modifier = Modifier.height(6.dp))
                // Progress Bar
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .background(Color(0xFF1E293B), RoundedCornerShape(4.dp))
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(widthPct.toFloat())
                            .fillMaxHeight()
                            .background(color, RoundedCornerShape(4.dp))
                    )
                }
            }
        }
    }
}

@Composable
fun SyncBadge(isSynced: Boolean) {
    val bgColor = if (isSynced) Color(0xFF10B981).copy(alpha = 0.1f) else Color(0xFFF59E0B).copy(alpha = 0.1f)
    val textColor = if (isSynced) Color(0xFF10B981) else Color(0xFFF59E0B)
    val text = if (isSynced) "Synced" else "Bulk Queue"

    Box(
        modifier = Modifier
            .background(bgColor, RoundedCornerShape(4.dp))
            .padding(horizontal = 6.dp, py = 2.dp)
    ) {
        Text(text, color = textColor, fontSize = 9.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun DashboardScreen(
    transactions: List<Transaction>,
    onDelete: (Transaction) -> Unit,
    onNavigateToRecord: (Boolean) -> Unit
) {
    val totalDebet = transactions.sumOf { it.debet }
    val totalKredit = transactions.sumOf { it.kredit }
    val currentSaldo = totalDebet - totalKredit
    val formatter = NumberFormat.getCurrencyInstance(Locale("in", "ID")).apply {
        maximumFractionDigits = 0
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Saldo Utama Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "TOTAL SALDO BUKU KAS",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF94A3B8),
                            letterSpacing = 1.sp
                        )
                        Box(
                            modifier = Modifier
                                .background(Color(0xFF1E293B), RoundedCornerShape(12.dp))
                                .padding(horizontal = 8.dp, py = 2.dp)
                        ) {
                            Text("IDR Rp", color = Color(0xFFE2E8F0), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = formatter.format(currentSaldo),
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Black,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(20.dp))
                    Divider(color = Color(0xFF1E293B))
                    Spacer(modifier = Modifier.height(16.dp))

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        // Uang Masuk
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .background(Color(0xFF10B981).copy(alpha = 0.1f), RoundedCornerShape(10.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.ArrowForward, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(18.dp))
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text("Uang Masuk", fontSize = 10.sp, color = Color(0xFF94A3B8), fontWeight = FontWeight.Medium)
                                Text(formatter.format(totalDebet), fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFF10B981))
                            }
                        }
                        
                        // Uang Keluar
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .background(Color(0xFFEF4444).copy(alpha = 0.1f), RoundedCornerShape(10.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.ArrowBack, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text("Uang Keluar", fontSize = 10.sp, color = Color(0xFF94A3B8), fontWeight = FontWeight.Medium)
                                Text(formatter.format(totalKredit), fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFFEF4444))
                            }
                        }
                    }
                }
            }
        }

        // Quick Actions
        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(
                    onClick = { onNavigateToRecord(true) },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                    shape = RoundedCornerShape(16.dp),
                    contentPadding = PaddingValues(vertical = 12.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Catat Pemasukan", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = { onNavigateToRecord(false) },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                    shape = RoundedCornerShape(16.dp),
                    contentPadding = PaddingValues(vertical = 12.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Catat Pengeluaran", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Tren Bulanan
        item {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Refresh, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Tren Bulanan (Arus Kas)", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFFE2E8F0))
                }
                Spacer(modifier = Modifier.height(10.dp))
                
                // Aggregate chart data
                val chartData = if (transactions.isEmpty()) {
                    listOf(
                        MonthlyData("Mei", 4500000.0, 3200000.0),
                        MonthlyData("Jun", 5000000.0, 4100000.0),
                        MonthlyData("Jul", 0.0, 0.0)
                    )
                } else {
                    val grouped = transactions.groupBy {
                        val parts = it.tanggal.split("-")
                        if (parts.size >= 2) "${parts[0]}-${parts[1]}" else "2026-07"
                    }
                    val months = listOf("Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des")
                    grouped.entries.sortedBy { it.key }.map { entry ->
                        val parts = entry.key.split("-")
                        val year = parts[0].substring(2)
                        val monthIdx = parts[1].toIntOrNull()?.minus(1)?.coerceIn(0, 11) ?: 6
                        val label = "${months[monthIdx]} '$year"
                        MonthlyData(label, entry.value.sumOf { it.debet }, entry.value.sumOf { it.kredit })
                    }
                }
                
                MonthlyTrendChart(chartData)
            }
        }

        // Kategori Pengeluaran Terbesar
        item {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Kategori Pengeluaran Terbesar", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFFE2E8F0))
                }
                Spacer(modifier = Modifier.height(10.dp))
                CategoryDistributionSection(transactions)
            }
        }

        // Catatan Terakhir
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.List, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Catatan Terakhir", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFFE2E8F0))
                }
            }
        }

        if (transactions.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF020617), RoundedCornerShape(16.dp))
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("Belum ada transaksi. Catat sekarang!", color = Color(0xFF64748B), fontSize = 12.sp)
                }
            }
        } else {
            items(transactions.take(3)) { tx ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(tx.keterangan, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Color.White)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("${tx.tanggal} • ${tx.kategori}", fontSize = 11.sp, color = Color(0xFF64748B))
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            val amountText = if (tx.debet > 0) "+ " + formatter.format(tx.debet) else "- " + formatter.format(tx.kredit)
                            val amountColor = if (tx.debet > 0) Color(0xFF10B981) else Color(0xFFEF4444)
                            
                            Column(horizontalAlignment = Alignment.End) {
                                Text(amountText, fontWeight = FontWeight.Bold, color = amountColor, fontSize = 14.sp)
                                Spacer(modifier = Modifier.height(4.dp))
                                SyncBadge(tx.isSynced)
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            IconButton(
                                onClick = { onDelete(tx) },
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(Icons.Default.Delete, contentDescription = "Hapus", tint = Color(0xFFEF4444), modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddTransactionScreen(
    preselectedIsDebit: Boolean,
    onAdd: (String, String, String, Boolean, Double) -> Unit
) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("buku_kas_prefs", Context.MODE_PRIVATE) }
    var categoriesString by remember {
        mutableStateOf(prefs.getString("custom_categories", "Makan & Minum,Belanja,Transportasi,Gaji,Kesehatan,Lain-lain") ?: "Makan & Minum,Belanja,Transportasi,Gaji,Kesehatan,Lain-lain")
    }
    val categories = remember(categoriesString) {
        categoriesString.split(",").map { it.trim() }.filter { it.isNotEmpty() }
    }

    var date by remember { mutableStateOf(SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())) }
    var category by remember(categories) { mutableStateOf(categories.firstOrNull() ?: "Makan & Minum") }
    var description by remember { mutableStateOf("") }
    var isDebit by remember(preselectedIsDebit) { mutableStateOf(preselectedIsDebit) }
    var amountString by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Input Transaksi Baru", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF10B981))
                Spacer(modifier = Modifier.height(16.dp))

                // Toggle Pemasukan / Pengeluaran
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = { isDebit = true },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isDebit) Color(0xFF10B981) else Color(0xFF1E293B),
                            contentColor = if (isDebit) Color.White else Color(0xFF94A3B8)
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Pemasukan", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = { isDebit = false },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (!isDebit) Color(0xFFEF4444) else Color(0xFF1E293B),
                            contentColor = if (!isDebit) Color.White else Color(0xFF94A3B8)
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Pengeluaran", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = date,
                    onValueChange = { date = it },
                    label = { Text("Tanggal (YYYY-MM-DD)") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.LightGray,
                        focusedBorderColor = Color(0xFF10B981),
                        focusedLabelColor = Color(0xFF10B981),
                        unfocusedBorderColor = Color(0xFF1E293B),
                        unfocusedLabelColor = Color.Gray
                    )
                )
                Spacer(modifier = Modifier.height(12.dp))

                Text("Kategori", fontSize = 12.sp, color = Color(0xFF94A3B8), fontWeight = FontWeight.Medium)
                Spacer(modifier = Modifier.height(6.dp))
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    categories.chunked(3).forEach { rowCats ->
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            rowCats.forEach { cat ->
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .background(
                                            if (category == cat) Color(0xFF10B981).copy(alpha = 0.2f) else Color(0xFF1E293B),
                                            RoundedCornerShape(8.dp)
                                        )
                                        .clickable { category = cat }
                                        .padding(vertical = 10.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        cat,
                                        fontSize = 11.sp,
                                        color = if (category == cat) Color(0xFF10B981) else Color(0xFF94A3B8),
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1
                                    )
                                }
                            }
                            if (rowCats.size < 3) {
                                repeat(3 - rowCats.size) {
                                    Spacer(modifier = Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Keterangan") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.LightGray,
                        focusedBorderColor = Color(0xFF10B981),
                        focusedLabelColor = Color(0xFF10B981),
                        unfocusedBorderColor = Color(0xFF1E293B),
                        unfocusedLabelColor = Color.Gray
                    )
                )
                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = amountString,
                    onValueChange = { amountString = it },
                    label = { Text("Jumlah (Rupiah)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.LightGray,
                        focusedBorderColor = Color(0xFF10B981),
                        focusedLabelColor = Color(0xFF10B981),
                        unfocusedBorderColor = Color(0xFF1E293B),
                        unfocusedLabelColor = Color.Gray
                    )
                )
                Spacer(modifier = Modifier.height(20.dp))

                Button(
                    onClick = {
                        val amt = amountString.toDoubleOrNull() ?: 0.0
                        if (description.isNotEmpty() && amt > 0.0) {
                            onAdd(date, category, description, isDebit, amt)
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Simpan Transaksi", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun SyncScreen(
    transactions: List<Transaction>,
    scriptUrl: String,
    onSaveUrl: (String) -> Unit,
    onSync: () -> Unit,
    syncLogs: List<String>,
    onExportCsv: (List<Transaction>) -> Unit
) {
    var urlInput by remember { mutableStateOf(scriptUrl) }
    val unsyncedCount = transactions.count { !it.isSynced }
    val syncedCount = transactions.count { it.isSynced }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Status Hub Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Refresh, contentDescription = null, tint = Color(0xFF10B981))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Status Sinkronisasi", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color.White)
                    }
                    Box(
                        modifier = Modifier
                            .background(Color(0xFF1E293B), RoundedCornerShape(12.dp))
                            .padding(horizontal = 8.dp, py = 2.dp)
                    ) {
                        Text("Arus Kas", color = Color(0xFF94A3B8), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    // Left: Bulk Queue Card
                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text("Antrean Bulk", fontSize = 10.sp, color = Color(0xFF64748B), fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("$unsyncedCount", fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color(0xFFF59E0B))
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("Disimpan di HP", fontSize = 8.sp, color = Color(0xFF475569))
                        }
                    }
                    // Right: Synced Card
                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text("Tersinkron (Sheet)", fontSize = 10.sp, color = Color(0xFF64748B), fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("$syncedCount", fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color(0xFF10B981))
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("Tersimpan di Sheet", fontSize = 8.sp, color = Color(0xFF475569))
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = onSync,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(vertical = 12.dp)
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Sinkronkan Antrean Sekarang", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Export card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Ekspor Laporan Keuangan", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color.White)
                Spacer(modifier = Modifier.height(4.dp))
                Text("Bagikan atau ekspor seluruh catatan transaksi Anda dalam format CSV pembukuan.", fontSize = 11.sp, color = Color(0xFF64748B))
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = { onExportCsv(transactions) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(vertical = 12.dp)
                ) {
                    Icon(Icons.Default.Share, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Ekspor & Bagikan CSV", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Config Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Konfigurasi Google Apps Script", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color.White)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Masukkan Web App URL dari Google Apps Script untuk menghubungkan ke Google Sheet.", fontSize = 11.sp, color = Color(0xFF64748B))
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = urlInput,
                    onValueChange = { urlInput = it },
                    label = { Text("Web App URL") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.LightGray,
                        focusedBorderColor = Color(0xFF10B981),
                        focusedLabelColor = Color(0xFF10B981),
                        unfocusedBorderColor = Color(0xFF1E293B),
                        unfocusedLabelColor = Color.Gray
                    )
                )
                Spacer(modifier = Modifier.height(12.dp))
                Button(
                    onClick = { onSaveUrl(urlInput) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Simpan URL", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Sync Console Logs Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Konsol Log Sinkronisasi", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color.White)
                Spacer(modifier = Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp)
                        .background(Color(0xFF0F172A), RoundedCornerShape(12.dp))
                        .padding(12.dp)
                ) {
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        if (syncLogs.isEmpty()) {
                            item {
                                Text("Antrean siap disinkronkan. Menunggu aktivitas...", color = Color(0xFF475569), fontSize = 10.sp)
                            }
                        } else {
                            items(syncLogs) { log ->
                                Text(log, color = Color(0xFF10B981), fontSize = 10.sp, modifier = Modifier.padding(bottom = 4.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SettingsScreen(
    onSetReminder: (Boolean) -> Unit,
    onClearAllData: () -> Unit
) {
    var reminderEnabled by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // User Profile Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .background(Color(0xFF10B981).copy(alpha = 0.2f), RoundedCornerShape(24.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text("RA", color = Color(0xFF10B981), fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text("Ravina Arcamanik", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color.White)
                    Spacer(modifier = Modifier.height(2.dp))
                    Text("ravinaarcamanik@gmail.com", fontSize = 12.sp, color = Color(0xFF64748B))
                }
            }
        }

        // Daily Reminder Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Pengingat Harian (Notification)", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color.White)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Nyalakan notifikasi pengingat untuk mencatatkan arus kas Anda setiap harinya.", fontSize = 11.sp, color = Color(0xFF64748B))
                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Nyalakan Pengingat Jam 20:00", fontSize = 13.sp, color = Color.White, fontWeight = FontWeight.Medium)
                    Switch(
                        checked = reminderEnabled,
                        onCheckedChange = { checked ->
                            reminderEnabled = checked
                            onSetReminder(checked)
                        },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color(0xFF10B981),
                            checkedTrackColor = Color(0xFF10B981).copy(alpha = 0.5f)
                        )
                    )
                }
            }
        }

        // Manage Categories Card
        val context = LocalContext.current
        val prefs = remember { context.getSharedPreferences("buku_kas_prefs", Context.MODE_PRIVATE) }
        var categoriesString by remember {
            mutableStateOf(prefs.getString("custom_categories", "Makan & Minum,Belanja,Transportasi,Gaji,Kesehatan,Lain-lain") ?: "Makan & Minum,Belanja,Transportasi,Gaji,Kesehatan,Lain-lain")
        }
        var newCategoryName by remember { mutableStateOf("") }
        val categories = remember(categoriesString) {
            categoriesString.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Kelola Kategori Arus Kas", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color.White)
                Spacer(modifier = Modifier.height(4.dp))
                Text("Tambahkan atau hapus kategori arus kas kustom Anda di bawah ini.", fontSize = 11.sp, color = Color(0xFF64748B))
                Spacer(modifier = Modifier.height(16.dp))

                // Render categories dynamically in a chunked layout
                categories.chunked(3).forEach { rowCats ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        rowCats.forEach { cat ->
                            Row(
                                modifier = Modifier
                                    .weight(1f)
                                    .background(Color(0xFF1E293B), RoundedCornerShape(8.dp))
                                    .padding(horizontal = 8.dp, vertical = 6.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    cat,
                                    fontSize = 11.sp,
                                    color = Color.LightGray,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    modifier = Modifier.weight(1f)
                                )
                                Icon(
                                    Icons.Default.Close,
                                    contentDescription = "Hapus",
                                    tint = Color(0xFFEF4444),
                                    modifier = Modifier
                                        .size(16.dp)
                                        .clickable {
                                            if (categories.size <= 1) {
                                                Toast.makeText(context, "Minimal harus ada satu kategori!", Toast.LENGTH_SHORT).show()
                                            } else {
                                                val updatedList = categories.filter { it != cat }
                                                val newStr = updatedList.joinToString(",")
                                                prefs.edit().putString("custom_categories", newStr).apply()
                                                categoriesString = newStr
                                                Toast.makeText(context, "Kategori '$cat' dihapus", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                )
                            }
                        }
                        if (rowCats.size < 3) {
                            repeat(3 - rowCats.size) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Input to add category
                OutlinedTextField(
                    value = newCategoryName,
                    onValueChange = { newCategoryName = it },
                    label = { Text("Kategori Baru") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.LightGray,
                        focusedBorderColor = Color(0xFF10B981),
                        focusedLabelColor = Color(0xFF10B981),
                        unfocusedBorderColor = Color(0xFF1E293B),
                        unfocusedLabelColor = Color.Gray
                    )
                )

                Spacer(modifier = Modifier.height(12.dp))

                Button(
                    onClick = {
                        val trimmed = newCategoryName.trim()
                        if (trimmed.isEmpty()) {
                            Toast.makeText(context, "Nama kategori tidak boleh kosong!", Toast.LENGTH_SHORT).show()
                        } else if (categories.any { it.equals(trimmed, ignoreCase = true) }) {
                            Toast.makeText(context, "Kategori sudah terdaftar!", Toast.LENGTH_SHORT).show()
                        } else {
                            val updatedList = categories + trimmed
                            val newStr = updatedList.joinToString(",")
                            prefs.edit().putString("custom_categories", newStr).apply()
                            categoriesString = newStr
                            newCategoryName = ""
                            Toast.makeText(context, "Kategori '$trimmed' ditambahkan", Toast.LENGTH_SHORT).show()
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Tambah Kategori", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Danger Zone: Clear Data Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF020617))
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Zona Bahaya", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color(0xFFEF4444))
                Spacer(modifier = Modifier.height(4.dp))
                Text("Tindakan di bawah ini bersifat permanen dan tidak dapat dibatalkan.", fontSize = 11.sp, color = Color(0xFF64748B))
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = onClearAllData,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(vertical = 12.dp)
                ) {
                    Text("Hapus Semua Data Transaksi", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
