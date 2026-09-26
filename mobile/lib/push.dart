import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'theme.dart';

/// Para mostrar avisos que llegan con la app abierta (Android solo los pinta solo si está en segundo plano).
final messengerKey = GlobalKey<ScaffoldMessengerState>();

/// Notificaciones push con Firebase Cloud Messaging.
///
/// Si la app se compiló sin google-services.json, Firebase no arranca y todo esto queda
/// apagado sin romper nada: las alertas siguen llegando por WhatsApp.
class PushNotifications {
  PushNotifications(this.api, {required this.available});

  final ApiClient api;
  final bool available;

  String? _token;
  StreamSubscription<String>? _refreshSub;
  StreamSubscription<RemoteMessage>? _messageSub;

  static Future<bool> init() async {
    try {
      await Firebase.initializeApp();
      return true;
    } catch (e) {
      debugPrint('Notificaciones push desactivadas: $e');
      return false;
    }
  }

  /// Pide permiso (Android 13+ lo exige) y registra este teléfono en la cuenta. Devuelve si quedó activo.
  Future<bool> register() async {
    if (!available) return false;
    try {
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return false;

      _token = await messaging.getToken();
      if (_token == null) return false;
      await api.registerDevice(_token!, defaultTargetPlatform.name);

      _refreshSub ??= messaging.onTokenRefresh.listen((token) {
        _token = token;
        api.registerDevice(token, defaultTargetPlatform.name).catchError((_) {});
      });
      _messageSub ??= FirebaseMessaging.onMessage.listen(_showInApp);
      return true;
    } catch (e) {
      debugPrint('No se pudo registrar el teléfono para push: $e');
      return false;
    }
  }

  Future<bool> get permissionDenied async {
    if (!available) return false;
    final settings = await FirebaseMessaging.instance.getNotificationSettings();
    return settings.authorizationStatus == AuthorizationStatus.denied;
  }

  /// Al cerrar sesión: el teléfono deja de recibir avisos de esta cuenta.
  /// [tellServer] va en falso cuando la sesión ya no es válida y el API no aceptaría la llamada.
  Future<void> unregister({bool tellServer = true}) async {
    if (!available) return;
    await _refreshSub?.cancel();
    await _messageSub?.cancel();
    _refreshSub = null;
    _messageSub = null;
    try {
      if (tellServer && _token != null) await api.unregisterDevice(_token!);
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {
      // Si falla (sin internet), el servidor limpia el token la próxima vez que FCM lo rechace.
    }
    _token = null;
  }

  void _showInApp(RemoteMessage message) {
    final n = message.notification;
    if (n == null) return;
    messengerKey.currentState?.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AvColors.surfaceAlt,
        duration: const Duration(seconds: 6),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (n.title != null) Text(n.title!, style: const TextStyle(fontWeight: FontWeight.w700)),
            if (n.body != null) Text(n.body!),
          ],
        ),
      ),
    );
  }
}
