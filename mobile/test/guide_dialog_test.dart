import 'package:agro_valor/widgets/guide_dialog.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _app() => MaterialApp(
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: ElevatedButton(onPressed: () => showGuideDialog(context), child: const Text('abrir')),
          ),
        ),
      ),
    );

void main() {
  testWidgets('la guía se puede omitir desde el primer paso', (tester) async {
    await tester.pumpWidget(_app());
    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();
    expect(find.text('El precio al día'), findsOneWidget);

    await tester.tap(find.text('Omitir'));
    await tester.pumpAndSettle();
    expect(find.text('El precio al día'), findsNothing);
  });

  testWidgets('la guía recorre los 5 pasos y cierra con Empezar', (tester) async {
    await tester.pumpWidget(_app());
    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();

    for (var i = 0; i < 4; i++) {
      await tester.tap(find.text('Siguiente'));
      await tester.pumpAndSettle();
    }
    expect(find.text('Que el precio te avise'), findsOneWidget);
    expect(find.text('Siguiente'), findsNothing);

    await tester.tap(find.text('Empezar'));
    await tester.pumpAndSettle();
    expect(find.text('Que el precio te avise'), findsNothing);
  });
}
