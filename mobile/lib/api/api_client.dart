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
  Future<Json> currentPrice([String market = 'coffee']) async =>
      await _request('GET', '/prices/current?market=$market') as Json;
  Future<List<dynamic>> priceHistory([int days = 30, String market = 'coffee']) async =>
      await _request('GET', '/prices/history?days=$days&market=$market') as List<dynamic>;
  Future<Json> cooperatives([String market = 'coffee']) async =>
      await _request('GET', '/cooperatives?market=$market') as Json;
  Future<Json> plans() async => await _request('GET', '/public/plans') as Json;
  Future<Json> plan() async => await _request('GET', '/account/plan') as Json;
  Future<Json> privacyPolicy() async => await _request('GET', '/public/legal/privacy') as Json;
  Future<Json> termsOfService() async => await _request('GET', '/public/legal/terms') as Json;
  Future<Json> dmcaPolicy() async => await _request('GET', '/public/legal/dmca') as Json;

  // Cuenta
  Future<Json> profile() async => await _request('GET', '/account/profile') as Json;
  Future<Json> updateProfile(Json payload) async => await _request('PUT', '/account/profile', payload) as Json;
  Future<void> changePassword(String currentPassword, String newPassword) => _request('PUT', '/account/password', {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });
  Future<void> registerDevice(String token, String platform) =>
      _request('POST', '/account/devices', {'token': token, 'platform': platform});
  Future<void> unregisterDevice(String token) => _request('DELETE', '/account/devices', {'token': token});
  Future<void> deleteAccount(String password) => _request('DELETE', '/account', {'password': password});

  // Reportes de precio (gratis: alimentan el dato de todos)
  Future<Json> reportPrice(Json payload) async => await _request('POST', '/reports', payload) as Json;
  Future<Json> myReports() async => await _request('GET', '/reports/mine') as Json;

  // Pro
  Future<Json> forecast([String market = 'coffee']) async =>
      await _request('GET', '/forecast?market=$market') as Json;
  Future<Json> calculateCocoa(Json payload) async => await _request('POST', '/calculator/cocoa', payload) as Json;
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

  // Módulo de café (compras, lotes, inventario, ventas). Mismo API que la web: /api/coffee.
  Future<Json> coffeeDashboard() async => await _request('GET', '/coffee/dashboard') as Json;
  Future<Json> coffeePurchases({bool onlyWithoutLot = false}) async =>
      await _request('GET', '/coffee/purchases${onlyWithoutLot ? '?noLot=1&status=ACTIVA' : ''}') as Json;
  Future<Json> coffeeCreatePurchase(Json payload) async => await _request('POST', '/coffee/purchases', payload) as Json;
  Future<Json> coffeeInvoices() async => await _request('GET', '/coffee/invoices') as Json;
  Future<Json> coffeeInvoice(int id) async => await _request('GET', '/coffee/invoices/$id') as Json;
  Future<Json> coffeeCreateInvoice(Json payload) async => await _request('POST', '/coffee/invoices', payload) as Json;
  Future<Json> coffeeVoidInvoice(int id, String reason) async =>
      await _request('POST', '/coffee/invoices/$id/void', {'reason': reason}) as Json;
  Future<Json> coffeeVoidPurchase(int id, String reason) async =>
      await _request('POST', '/coffee/purchases/$id/void', {'reason': reason}) as Json;
  Future<Json> coffeeProjection(int purchaseId) async =>
      await _request('GET', '/coffee/purchases/$purchaseId/projection') as Json;
  Future<Json> coffeeSaveProjection(int purchaseId, Json payload) async =>
      await _request('PUT', '/coffee/purchases/$purchaseId/projection', payload) as Json;
  Future<Json> coffeeProductTypes() async => await _request('GET', '/coffee/product-types') as Json;
  Future<Json> coffeeSearchSuppliers(String q) async =>
      await _request('GET', '/coffee/suppliers?q=${Uri.encodeQueryComponent(q)}') as Json;
  Future<Json> coffeeCurrentWorkday() async => await _request('GET', '/coffee/workdays/current') as Json;
  Future<Json> coffeeQuickCalc(Json payload) async => await _request('POST', '/coffee/calculator', payload) as Json;
  Future<Json> coffeeCompareFactors(Json payload) async =>
      await _request('POST', '/coffee/calculator/compare', payload) as Json;
  Future<Json> coffeeInventory() async => await _request('GET', '/coffee/inventory') as Json;
  Future<Json> coffeeLots() async => await _request('GET', '/coffee/lots') as Json;
  Future<Json> coffeeLot(int id) async => await _request('GET', '/coffee/lots/$id') as Json;
  Future<Json> coffeeCreateLot(List<int> purchaseIds, String notes) async =>
      await _request('POST', '/coffee/lots', {'purchaseIds': purchaseIds, 'notes': notes}) as Json;
  Future<Json> coffeeChangeLotStatus(int id, String status) async =>
      await _request('POST', '/coffee/lots/$id/status', {'status': status}) as Json;
  Future<Json> coffeeRemoveLotPurchase(int id, int purchaseId) async =>
      await _request('DELETE', '/coffee/lots/$id/purchases/$purchaseId') as Json;
  Future<Json> coffeeLotProcessing(int id) async => await _request('GET', '/coffee/lots/$id/processing') as Json;
  Future<Json> coffeeSaveLotShipment(int id, Json payload) async =>
      await _request('PUT', '/coffee/lots/$id/processing', payload) as Json;
  Future<Json> coffeeAddLotCost(int id, Json payload) async =>
      await _request('POST', '/coffee/lots/$id/processing/costs', payload) as Json;
  Future<Json> coffeeRemoveLotCost(int id, int costId) async =>
      await _request('DELETE', '/coffee/lots/$id/processing/costs/$costId') as Json;
  Future<Json> coffeeFinishLot(int id, Json payload) async =>
      await _request('POST', '/coffee/lots/$id/processing/finish', payload) as Json;
  Future<Json> coffeeInvoiceToInventory(int invoiceId) async =>
      await _request('POST', '/coffee/invoices/$invoiceId/inventory', <String, dynamic>{}) as Json;
  Future<Json> coffeeEnterInventory(int lotId, Json payload) async =>
      await _request('POST', '/coffee/lots/$lotId/inventory', payload) as Json;
}
