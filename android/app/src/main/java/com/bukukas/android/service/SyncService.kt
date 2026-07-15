package com.bukukas.android.service

import com.google.gson.annotations.SerializedName
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Url

data class TransactionPayload(
    @SerializedName("action") val action: String = "addOrUpdate",
    @SerializedName("id") val id: Int,
    @SerializedName("date") val date: String,
    @SerializedName("category") val category: String,
    @SerializedName("description") val description: String,
    @SerializedName("debit") val debit: Double,
    @SerializedName("credit") val credit: Double,
    @SerializedName("createdAt") val createdAt: String
)

data class TransactionItemPayload(
    @SerializedName("id") val id: String,
    @SerializedName("date") val date: String,
    @SerializedName("category") val category: String,
    @SerializedName("description") val description: String,
    @SerializedName("debit") val debit: Double,
    @SerializedName("credit") val credit: Double
)

data class BulkSyncPayload(
    @SerializedName("action") val action: String = "sync",
    @SerializedName("transactions") val transactions: List<TransactionItemPayload>
)

interface GoogleAppsScriptApi {
    @POST
    suspend fun syncTransaction(
        @Url url: String,
        @Body payload: TransactionPayload
    ): Response<Map<String, Any>>

    @POST
    suspend fun syncAllTransactions(
        @Url url: String,
        @Body payload: BulkSyncPayload
    ): Response<Map<String, Any>>
}

class RedirectInterceptor : okhttp3.Interceptor {
    @Throws(java.io.IOException::class)
    override fun intercept(chain: okhttp3.Interceptor.Chain): okhttp3.Response {
        val request = chain.request()
        var response = chain.proceed(request)
        
        var tryCount = 0
        while ((response.code == 301 || response.code == 302 || response.code == 307 || response.code == 308) && tryCount < 5) {
            val location = response.header("Location") ?: break
            response.close()
            
            val newRequest = request.newBuilder()
                .url(location)
                .removeHeader("Host")
                .removeHeader("host")
                .method(request.method, request.body)
                .build()
            
            response = chain.proceed(newRequest)
            tryCount++
        }
        return response
    }
}

object RetrofitClient {
    private var retrofit: Retrofit? = null

    fun getClient(): GoogleAppsScriptApi {
        if (retrofit == null) {
            val okHttpClient = okhttp3.OkHttpClient.Builder()
                .followRedirects(false)
                .followSslRedirects(false)
                .addInterceptor(RedirectInterceptor())
                .build()

            retrofit = Retrofit.Builder()
                // Use dummy base URL as Google Apps Script redirect works with absolute @Url anyway
                .baseUrl("https://script.google.com/") 
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }
        return retrofit!!.create(GoogleAppsScriptApi::class.java)
    }
}
