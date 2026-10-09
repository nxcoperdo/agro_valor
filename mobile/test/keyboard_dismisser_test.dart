import 'package:agro_valor/widgets/keyboard_dismisser.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final first = FocusNode();
  final second = FocusNode();
  var pressed = 0;

  Widget app() => MaterialApp(
        builder: (context, child) => KeyboardDismisser(child: child ?? const SizedBox.shrink()),
        home: Scaffold(
          body: ListView(
            children: [
              TextField(key: const Key('first'), focusNode: first),
              TextField(key: const Key('second'), focusNode: second),
              ElevatedButton(onPressed: () => pressed++, child: const Text('Guardar')),
              const Text('Texto suelto'),
              for (var i = 0; i < 40; i++) SizedBox(height: 48, child: Text('Fila $i')),
            ],
          ),
        ),
      );

  setUp(() => pressed = 0);

  testWidgets('tocar fuera de un campo quita el foco', (tester) async {
    await tester.pumpWidget(app());
    await tester.tap(find.byKey(const Key('first')));
    await tester.pump();
    expect(first.hasFocus, isTrue);

    await tester.tap(find.text('Texto suelto'));
    await tester.pump();
    expect(first.hasFocus, isFalse);
  });

  testWidgets('arrastrar la lista quita el foco', (tester) async {
    await tester.pumpWidget(app());
    await tester.tap(find.byKey(const Key('first')));
    await tester.pump();
    expect(first.hasFocus, isTrue);

    await tester.drag(find.text('Fila 3'), const Offset(0, -150));
    await tester.pump();
    expect(first.hasFocus, isFalse);
  });

  testWidgets('tocar otro campo mueve el foco sin cerrarlo', (tester) async {
    await tester.pumpWidget(app());
    await tester.tap(find.byKey(const Key('first')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('second')));
    await tester.pump();
    expect(first.hasFocus, isFalse);
    expect(second.hasFocus, isTrue);
  });

  testWidgets('un botón sigue funcionando con un campo enfocado', (tester) async {
    await tester.pumpWidget(app());
    await tester.tap(find.byKey(const Key('first')));
    await tester.pump();

    await tester.tap(find.text('Guardar'));
    await tester.pump();
    expect(pressed, 1);
  });

  testWidgets('en iPhone con el teclado abierto aparece "Listo" y cierra el teclado', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    try {
      await tester.pumpWidget(app());
      expect(find.text('Listo'), findsNothing);

      await tester.tap(find.byKey(const Key('first')));
      tester.view.viewInsets = const FakeViewPadding(bottom: 300);
      addTearDown(tester.view.resetViewInsets);
      await tester.pump();
      expect(find.text('Listo'), findsOneWidget);

      await tester.tap(find.text('Listo'));
      await tester.pump();
      expect(first.hasFocus, isFalse);
    } finally {
      debugDefaultTargetPlatformOverride = null;
    }
  });

  testWidgets('en Android no aparece el botón "Listo"', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    try {
      await tester.pumpWidget(app());
      tester.view.viewInsets = const FakeViewPadding(bottom: 300);
      addTearDown(tester.view.resetViewInsets);
      await tester.pump();
      expect(find.text('Listo'), findsNothing);
    } finally {
      debugDefaultTargetPlatformOverride = null;
    }
  });
}
