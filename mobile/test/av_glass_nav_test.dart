import 'package:agro_valor/widgets/av_glass_nav.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const _items = <AvNavItem>[
  (label: 'Precio', icon: Icons.show_chart_rounded),
  (label: 'Proyección', icon: Icons.calendar_month_rounded),
  (label: 'Cooperativas', icon: Icons.storefront_rounded),
  (label: 'Calcular', icon: Icons.calculate_rounded),
  (label: 'Alertas', icon: Icons.notifications_active_rounded),
  (label: 'Cuenta', icon: Icons.person_rounded),
];

Widget _app(ValueChanged<int> onTap, {int index = 0}) => MaterialApp(
      home: Scaffold(
        bottomNavigationBar: AvGlassNav(items: _items, index: index, onTap: onTap),
      ),
    );

void main() {
  testWidgets('tocar una pestaña la selecciona', (tester) async {
    int? tapped;
    await tester.pumpWidget(_app((i) => tapped = i));
    await tester.tap(find.text('Cooperativas'));
    await tester.pump();
    expect(tapped, 2);
  });

  testWidgets('arrastrar la burbuja hacia la derecha selecciona una pestaña posterior', (tester) async {
    int? selected;
    await tester.pumpWidget(_app((i) => selected = i));
    final from = tester.getCenter(find.text('Precio'));
    final to = tester.getCenter(find.text('Cuenta'));
    final gesture = await tester.startGesture(from);
    await tester.pump(const Duration(milliseconds: 100));
    final step = (to - from) / 10;
    for (var i = 0; i < 10; i++) {
      await gesture.moveBy(step);
      await tester.pump(const Duration(milliseconds: 16));
    }
    await gesture.up();
    await tester.pump();
    expect(selected, 5);
  });
}
