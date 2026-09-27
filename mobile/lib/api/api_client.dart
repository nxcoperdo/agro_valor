import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';

typedef Json = Map<String, dynamic>;

class ApiError implements Exception {
  ApiError(this.message, this.status, [this.payload = const {}]);

  final String message;
  final int status;
  final Json payload;

  bool get upgradeRequired => payload['upgradeRequired'] == true;
  bool get unauthorized => status == 401;

  @override
  String toString() => message;
}

/// Cliente del mismo API que usa la web (js/services/api.js), autenticado con Bearer.
class ApiClient {
  String? token;
  void Function()? onUnauthorized;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'X-Client': 'mobile',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<dynamic> _request(String method, String path, [Object? body]) async {
    final http.Response res;
    try {
      final req = http.Request(method, Uri.parse('$apiBaseUrl/api$path'))..headers.addAll(_headers);
      if (body != null) req.body = jsonEncode(body);
      res = await http.Response.fromStream(await req.send().timeout(const Duration(seconds: 15)));
    } catch (_) {
      throw ApiError('No hay conexión con el servidor. Revisa tu internet.', 0);
    }

    dynamic data;
    try {
      data = res.body.isEmpty ? <String, dynamic>{} : jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      data = <String, dynamic>{};
    }

    if (res.statusCode >= 400) {
      final payload = data is Json ? data : <String, dynamic>{};
      final err = ApiError(payload['error'] as String? ?? 'Error ${res.statusCode}', res.statusCode, payload);
      if (err.unauthorized && token != null) onUnauthorized?.call();
      throw err;
    }
    return data;
  }

  // Sesión
  Future<Json> login(String username, String password) async =>
      await _request('POST', '/auth/login', {'username': username, 'password': password}) as Json;
  Future<Json> signup(Json payload) async => await _request('POST', '/auth/signup', payload) as Json;
  Future<Json> me() async => await _request('GET', '/auth/me') as Json;
  Future<Json> requestPasswordReset(String username) async =>
      await _request('POST', '/auth/password-reset/request', {'username': username}) as Json;
  Future<Json> confirmPasswordReset(String username, String code, String newPassword) async =>
      await _request('POST', '/auth/password-reset/confirm', {
        'username': username,
        'code': code,
        'newPassword': newPassword,
      }) as Json;

  // Mercado
  Future<Json> currentPrice() async => await _request('GET', '/prices/current') as Json;
  Future<List<dynamic>> priceHistory([int days = 30]) async =>
      await _request('GET', '/prices/history?days=$days') as List<dynamic>;
  Future<Json> cooperatives() async => await _request('GET', '/cooperatives') as Json;
  Future<Json> plans() async => await _request('GET', '/public/plans') as Json;
  Future<Json> privacyPolicy() async => await _request('GET', '/public/legal/privacy') as Json;

  // Cuenta
  Future<Json> profile() async => await _request('GET', '/account/profile') as Json;
  Future<Json> updateProfile(Json payload) async => await _request('PUT', '/account/profile', payload) as Json;
  Future<void> registerDevice(String token, String platform) =>
      _request('POST', '/account/devices', {'token': token, 'platform': platform});
  Future<void> unregisterDevice(String token) => _request('DELETE', '/account/devices', {'token': token});
  Future<void> deleteAccount(String password) => _request('DELETE', '/account', {'password': password});

  // Reportes de precio (gratis: alimentan el dato de todos)
  Future<Json> reportPrice(Json payload) async => await _request('POST', '/reports', payload) as Json;
  Future<Json> myReports() async => await _request('GET', '/reports/mine') as Json;

  // Pro
  Future<Json> forecast() async => await _request('GET', '/forecast') as Json;
  Future<Json> calculate(Json payload) async => await _request('POST', '/calculator', payload) as Json;

  Future<Json> alerts() async => await _request('GET', '/alerts') as Json;
  Future<Json> createAlert(Json payload) async => await _request('POST', '/alerts', payload) as Json;
  Future<Json> setAlertActive(int id, bool active) async =>
      await _request('PATCH', '/alerts/$id', {'active': active}) as Json;
  Future<void> deleteAlert(int id) => _request('DELETE', '/alerts/$id');
  Future<Json> testAlert() async => await _request('POST', '/alerts/test') as Json;

  Future<Json> sales() async => await _request('GET', '/sales') as Json;
  Future<Json> createSale(Json payload) async => await _request('POST', '/sales', payload) as Json;
  Future<void> deleteSale(int id) => _request('DELETE', '/sales/$id');
}
