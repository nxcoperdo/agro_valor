import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show ThemeMode;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api/api_client.dart';
import 'markets.dart';
import 'push.dart';

/// Guarda el token en el almacenamiento cifrado del teléfono para no pedir login cada vez.
class Session extends ChangeNotifier {
  Session() {
    api.onUnauthorized = () => logout(tellServer: false);
    push = PushNotifications(api);
  }

  static const _tokenKey = 'av_token';
  static const _marketKey = 'av_market';
  static const _themeKey = 'av_theme';
  final _storage = const FlutterSecureStorage();
  final api = ApiClient();
  late final PushNotifications push;

  Json? user;
  bool restoring = true;

  /// Mercado elegido (café por defecto). Se recuerda entre sesiones.
  String market = kDefaultMarket;

  Future<void> setMarket(String id) async {
    if (id == market) return;
    market = marketById(id).id;
    notifyListeners();
    try {
      await _storage.write(key: _marketKey, value: market);
    } catch (_) {
      // Sin almacenamiento la elección dura solo mientras la app esté abierta.
    }
  }

  /// Apariencia elegida en Cuenta (sistema por defecto). Se recuerda entre sesiones.
  ThemeMode themeMode = ThemeMode.system;

  Future<void> setThemeMode(ThemeMode mode) async {
    if (mode == themeMode) return;
    themeMode = mode;
    notifyListeners();
    try {
      await _storage.write(key: _themeKey, value: mode.name);
    } catch (_) {
      // Sin almacenamiento la elección dura solo mientras la app esté abierta.
    }
  }

  bool get isLoggedIn => user != null;
  bool get isPro => user?['isPro'] == true;

  /// Firebase se inicia en paralelo con la intro para no demorar la primera pantalla.
  /// Si la sesión ya se restauró antes de que termine, aquí se registra el teléfono.
  Future<void> startPush() async {
    push.available = await PushNotifications.init();
    if (push.available && isLoggedIn) await push.register();
  }

  Future<void> restore() async {
    try {
      market = marketById(await _storage.read(key: _marketKey)).id;
      final savedTheme = await _storage.read(key: _themeKey);
      themeMode = ThemeMode.values.firstWhere((m) => m.name == savedTheme, orElse: () => ThemeMode.system);
      api.token = await _storage.read(key: _tokenKey);
      if (api.token != null) {
        user = (await api.me())['user'] as Json;
        unawaited(push.register());
      }
    } on ApiError catch (e) {
      // Sin internet se conserva el token para reintentar; si el servidor lo rechazó, se borra.
      if (e.unauthorized) await _clear();
    } finally {
      restoring = false;
      notifyListeners();
    }
  }

  Future<void> login(String username, String password) => _start(api.login(username, password));

  /// True justo después de crear la cuenta (la prueba gratis solo se otorga en el registro);
  /// HomeShell lo consume una vez para mostrar el modal de bienvenida.
  bool pendingTrialWelcome = false;

  Future<void> signup(Json payload) => _start(api.signup(payload), isSignup: true);

  Future<void> refreshUser() async {
    user = (await api.me())['user'] as Json;
    notifyListeners();
  }

  Future<void> logout({bool tellServer = true}) async {
    await push.unregister(tellServer: tellServer);
    await _clear();
    notifyListeners();
  }

  /// Borra la cuenta en el server (que ya se lleva el dispositivo push en cascada,
  /// así que a diferencia de logout() no hace falta avisarle aparte) y limpia la sesión local.
  Future<void> deleteAccount(String password) async {
    await api.deleteAccount(password);
    await _clear();
    notifyListeners();
  }

  Future<void> _start(Future<Json> call, {bool isSignup = false}) async {
    final res = await call;
    final token = res['token'] as String?;
    if (token == null) {
      // Un backend sin soporte para la app responde bien al login pero no entrega token.
      throw ApiError('El servidor no está actualizado para la app. Sube el último cambio del backend.', 0);
    }
    api.token = token;
    user = res['user'] as Json;
    pendingTrialWelcome = isSignup && user?['isTrialing'] == true;
    await _storage.write(key: _tokenKey, value: token);
    notifyListeners();
    unawaited(push.register());
  }

  Future<void> _clear() async {
    api.token = null;
    user = null;
    await _storage.delete(key: _tokenKey);
  }
}
