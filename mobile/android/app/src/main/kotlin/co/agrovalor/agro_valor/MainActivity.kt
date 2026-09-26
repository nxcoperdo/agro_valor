package co.agrovalor.agro_valor

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createPriceAlertsChannel()
    }

    /** Canal "price_alerts" que usa el servidor en cada push; con importancia alta para que suene y se vea. */
    private fun createPriceAlertsChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            "price_alerts",
            "Alertas de precio",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply { description = "Avisos cuando el precio del café cruza tu meta y resúmenes del mercado" }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}
