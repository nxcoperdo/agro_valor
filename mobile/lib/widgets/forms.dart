import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart' hide TextDirection;

import '../theme.dart';

final _thousands = NumberFormat.decimalPattern('es_CO');

/// Pone los puntos de miles mientras se escribe ("2270000" → "2.270.000"), como se leen los precios en Colombia.
class CopInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return const TextEditingValue();
    final text = _thousands.format(int.parse(digits));
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}

String copInputText(num? value) => value == null ? '' : _thousands.format(value.round());

/// Pesos escritos con puntos de miles.
double? parseCop(String text) {
  final digits = text.replaceAll(RegExp(r'[^0-9]'), '');
  return digits.isEmpty ? null : double.parse(digits);
}

final _thousandsGroups = RegExp(r'^[1-9]\d{0,2}(\.\d{3})+$');

/// Misma regla que parseNumber en la web: la coma es el decimal; el punto solo es miles cuando agrupa
/// de a 3 dígitos ("1.250" = 1250), si no es decimal ("12.5", "9500.5", "0.500").
double? parseDecimal(String text) {
  final raw = text.replaceAll(RegExp(r'\s'), '');
  final String clean;
  if (raw.contains(',')) {
    clean = raw.replaceAll('.', '').replaceFirst(',', '.');
  } else if (_thousandsGroups.hasMatch(raw)) {
    clean = raw.replaceAll('.', '');
  } else {
    clean = raw;
  }
  return double.tryParse(clean);
}

String decimalInputText(num? value) {
  if (value == null) return '';
  return value == value.roundToDouble() ? '${value.round()}' : '$value'.replaceAll('.', ',');
}

enum NumberKind { cop, decimal }

class NumberField extends StatelessWidget {
  const NumberField({
    super.key,
    required this.controller,
    required this.label,
    this.kind = NumberKind.decimal,
    this.hint,
    this.helper,
    this.suffix,
    this.required = false,
    this.min,
    this.max,
  });

  final TextEditingController controller;
  final String label;
  final NumberKind kind;
  final String? hint;
  final String? helper;
  final String? suffix;
  final bool required;
  final double? min;
  final double? max;

  String? _validate(String? text) {
    final raw = text?.trim() ?? '';
    if (raw.isEmpty) return required ? 'Obligatorio' : null;
    final value = kind == NumberKind.cop ? parseCop(raw) : parseDecimal(raw);
    if (value == null) return 'Escribe un número';
    if (min != null && value < min!) return 'Mínimo ${decimalInputText(min)}';
    if (max != null && value > max!) return 'Máximo ${decimalInputText(max)}';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final cop = kind == NumberKind.cop;
    return TextFormField(
      controller: controller,
      keyboardType: TextInputType.numberWithOptions(decimal: !cop),
      textInputAction: TextInputAction.done,
      inputFormatters: cop ? [CopInputFormatter()] : [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
      style: mono(size: 16),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        helperText: helper,
        helperMaxLines: 2,
        prefixText: cop ? r'$ ' : null,
        suffixText: suffix,
      ),
      validator: _validate,
    );
  }
}

void showMessage(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        backgroundColor: error ? AvColors.danger : AvColors.surfaceAlt,
      ),
    );
}

/// Hoja inferior con el teclado respetado, para formularios cortos (nueva alerta, nueva venta).
Future<T?> showFormSheet<T>(BuildContext context, {required String title, required Widget child}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: AvColors.surface,
    builder: (context) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    ),
  );
}

class BusyButton extends StatelessWidget {
  const BusyButton({super.key, required this.label, required this.busy, required this.onPressed, this.icon});

  final String label;
  final bool busy;
  final VoidCallback onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return FilledButton.icon(
      onPressed: busy ? null : onPressed,
      icon: busy
          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
          : Icon(icon ?? Icons.check_rounded),
      label: Text(label),
    );
  }
}
