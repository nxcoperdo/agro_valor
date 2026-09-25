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

  // Mercado
  Future<Json> currentPrice() async => await _request('GET', '/prices/current') as Json;
  Future<List<dynamic>> priceHistory([int days = 30]) async =>
      await _request('GET', '/prices/history?days=$days') as List<dynamic>;
  Future<Json> cooperatives() async => await _request('GET', '/cooperatives') as Json;
  Future<Json> plans() async => await _request('GET', '/public/plans') as Json;

  // Pro
  Future<Json> forecast() async => await _request('GET', '/forecast') as Json;
}
