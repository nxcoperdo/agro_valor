import 'package:agro_valor/api/api_client.dart';
import 'package:agro_valor/format.dart';
import 'package:agro_valor/screens/coffee/coffee_sale_form_screen.dart';
import 'package:agro_valor/screens/coffee/coffee_sales_math.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

/// API de mentira: devuelve inventario y clientes fijos y guarda lo que la pantalla manda al registrar la venta.
class _FakeApi extends ApiClient {
  _FakeApi({this.items = const []});

  final List<Json> items;
  Json? sent;

  @override
  Future<Json> coffeeInventory({bool onlyAvailable = false}) async => {'items': items};

  @override
  Future<Json> coffeeSearchCustomers(String q) async => {
        'customers': [
          {'id': 3, 'idType': 'NIT', 'idNumber': '900555', 'name': 'Exportadora S.A.'},
        ],
      };

  @override
  Future<Json> coffeeCreateSale(Json payload) async {
    sent = payload;
    return {'code': 'VTA-2026-000001'};
  }
}

Json _lot(int id, String code, num available) => {
      'id': id,
      'lot': {'id': id, 'code': code},
      'status': 'DISPONIBLE_PARA_VENTA',
      'kgIniciales': 2000,
      'kgVendidos': 2000 - available,
      'kgDisponibles': available,
    };

void main() {
  // La app lo hace al arrancar (main.dart); sin esto las fechas en español no se pueden formatear.
  setUpAll(() => initializeDateFormatting('es'));

  group('cálculo de la venta', () {
    test('por kilo: 500 kg a \$10.000 son \$5.000.000', () {
      expect(saleLineSubtotal(kg: 500, price: 10000, byKg: true), 5000000);
    });

    test('por kilo con decimales: 300 kg a \$9.500,5', () {
      expect(saleLineSubtotal(kg: 300, price: 9500.5, byKg: true), 2850150);
    });

    test('por carga: \$1.100.000 la carga de 125 kg son \$8.800 el kilo', () {
      expect(saleLineSubtotal(kg: 500, price: 1100000, byKg: false), 4400000);
    });

    test('los kilos se redondean a 2 decimales como en el servidor', () {
      expect(saleLineSubtotal(kg: 1.005, price: 1000, byKg: true), saleLineSubtotal(kg: 1.0, price: 1000, byKg: true) + 10);
      expect(roundKg(12.3456), 12.35);
    });

    test('sin kilos o sin precio el subtotal es cero', () {
      expect(saleLineSubtotal(kg: 0, price: 9000, byKg: true), 0);
      expect(saleLineSubtotal(kg: 100, price: 0, byKg: false), 0);
      expect(kgOrZero(null), 0);
      expect(kgOrZero(-3), 0);
    });

    test('lo vendible de un lote es lo disponible, sin pasar de 2 decimales', () {
      expect(maxSellableKg(1500), 1500);
      expect(maxSellableKg(12.345), 12.35);
      expect(maxSellableKg(null), 0);
    });

    test('el total vendido no cuenta las ventas anuladas', () {
      final sales = [
        {'status': 'ACTIVA', 'total': 4400000},
        {'status': 'ANULADA', 'total': 900000},
        {'status': 'ACTIVA', 'total': 2850000},
      ];
      expect(activeSalesTotal(sales), 7250000);
    });

    test('los kilos de la venta suman los de cada lote', () {
      expect(saleKg([{'kg': 500}, {'kg': 400.5}]), 900.5);
    });

    test('formas de pago y tipos de identificación del servidor', () {
      expect(paymentLabels.keys, ['efectivo', 'transferencia', 'credito', 'otro']);
      expect(paymentLabel('credito'), 'Crédito');
      expect(paymentLabel(null), '—');
      expect(idTypes, contains('NIT'));
    });
  });

  group('formulario de nueva venta', () {
    Future<Json?> openForm(WidgetTester tester, _FakeApi api) async {
      tester.view.physicalSize = const Size(900, 3200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute<String>(builder: (_) => CoffeeSaleFormScreen(api: api))),
                  child: const Text('abrir'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();
      return null;
    }

    testWidgets('sin inventario explica qué hacer y no muestra el formulario', (tester) async {
      await openForm(tester, _FakeApi());
      expect(find.text('No hay inventario disponible para vender'), findsOneWidget);
      expect(find.text('Registrar venta'), findsNothing);
    });

    testWidgets('registra una venta por carga con cliente y lote elegidos', (tester) async {
      final api = _FakeApi(items: [_lot(12, 'AGV-2026-000001', 1500), _lot(13, 'AGV-2026-000002', 800)]);
      await openForm(tester, api);

      await tester.tap(find.text('Toca para elegir de la lista'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Exportadora S.A.'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Toca para elegir el lote'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('AGV-2026-000001'));
      await tester.pumpAndSettle();

      await tester.enterText(find.widgetWithText(TextFormField, 'Kilos a vender'), '500');
      await tester.enterText(find.widgetWithText(TextFormField, 'Precio por carga (125 kg)'), '1100000');
      await tester.pump();

      // 500 kg × $1.100.000 por carga de 125 kg = $4.400.000, visible en la barra y en el resumen.
      expect(find.text(formatCop(4400000)), findsWidgets);

      await tester.tap(find.text('Registrar venta'));
      await tester.pumpAndSettle();

      final sent = api.sent!;
      expect(sent['customerId'], 3);
      expect(sent['paymentMethod'], 'efectivo');
      final line = (sent['items'] as List).single as Json;
      expect(line['inventoryLotId'], 12);
      expect(line['kg'], 500);
      expect(line['precioCarga'], 1100000);
      expect(line.containsKey('precioKg'), isFalse);
      expect(line['factor'], isNull);
      // La pantalla se cerró devolviendo el código de la venta.
      expect(find.text('Nueva venta'), findsNothing);
    });

    testWidgets('no deja vender más kilos de los disponibles', (tester) async {
      final api = _FakeApi(items: [_lot(12, 'AGV-2026-000001', 1500)]);
      await openForm(tester, api);

      await tester.tap(find.text('Toca para elegir de la lista'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Exportadora S.A.'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Toca para elegir el lote'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('AGV-2026-000001'));
      await tester.pumpAndSettle();

      await tester.enterText(find.widgetWithText(TextFormField, 'Kilos a vender'), '1600');
      await tester.enterText(find.widgetWithText(TextFormField, 'Precio por carga (125 kg)'), '1100000');
      await tester.tap(find.text('Registrar venta'));
      await tester.pumpAndSettle();

      expect(find.text('Máximo 1500'), findsOneWidget);
      expect(api.sent, isNull);
    });

    testWidgets('el atajo "Todo" llena los kilos disponibles', (tester) async {
      final api = _FakeApi(items: [_lot(12, 'AGV-2026-000001', 1500)]);
      await openForm(tester, api);

      await tester.tap(find.text('Toca para elegir el lote'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('AGV-2026-000001'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Todo'));
      await tester.pump();

      final field = tester.widget<TextFormField>(find.widgetWithText(TextFormField, 'Kilos a vender'));
      expect(field.controller!.text, '1500');
    });

    testWidgets('con datos escritos pide confirmar antes de salir', (tester) async {
      final api = _FakeApi(items: [_lot(12, 'AGV-2026-000001', 1500)]);
      await openForm(tester, api);

      await tester.tap(find.text('Toca para elegir el lote'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('AGV-2026-000001'));
      await tester.pumpAndSettle();

      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.text('¿Descartar la venta?'), findsOneWidget);

      await tester.tap(find.text('Seguir editando'));
      await tester.pumpAndSettle();
      expect(find.text('Nueva venta'), findsOneWidget);

      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Descartar'));
      await tester.pumpAndSettle();
      expect(find.text('Nueva venta'), findsNothing);
    });
  });
}
