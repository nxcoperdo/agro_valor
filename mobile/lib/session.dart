import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api/api_client.dart';
import 'push.dart';

/// Guarda el token en el almacenamiento cifrado del teléfono para no pedir login cada vez.
class Session extends ChangeNotifier {
  Session({bool pushAvailable = false}) {
    api.onUnauthorized = () => logout(tellServer: false);
    push = PushNotifications(api, available: pushAvailable);
  }

  static const _tokenKey = 'av_token';
  final _storage = const FlutterSecureStorage();
  final api = ApiClient();
  late final PushNotifications push;

  Json? user;
  bool restoring = true;

  bool get isLoggedIn => user != null;
  bool get isPro => user?['isPro'] == true;

  Future<void> restore() async {
    try {
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

  Future<void> signup(Json payload) => _start(api.signup(payload));

  Future<void> refreshUser() async {
    user = (await api.me())['user'] as Json;
    notifyListeners();
  }

  Future<void> logout({bool tellServer = true}) async {
    await push.unregister(tellServer: tellServer);
    await _clear();
    notifyListeners();
  }

  Future<void> _start(Future<Json> call) async {
    final res = await call;
    final token = res['token'] as String?;
    if (token == null) {
      // Un backend sin soporte para la app responde bien al login pero no entrega token.
      throw ApiError('El servidor no está actualizado para la app. Sube el último cambio del backend.', 0);
    }
    api.token = token;
    user = res['user'] as Json;
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
