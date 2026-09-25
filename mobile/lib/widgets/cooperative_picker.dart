import 'package:flutter/material.dart';

import '../api/api_client.dart';

/// Selector de cooperativa que se llena con el mismo ranking que ve el usuario.
class CooperativePicker extends StatelessWidget {
  const CooperativePicker({
    super.key,
    required this.future,
    required this.value,
    required this.onChanged,
    this.required = false,
  });

  final Future<Json> future;
  final int? value;
  final ValueChanged<int?> onChanged;
  final bool required;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Json>(
      future: future,
      builder: (context, snap) {
        final coops = (snap.data?['cooperatives'] as List<dynamic>? ?? const []).cast<Json>();
        return DropdownButtonFormField<int>(
          initialValue: value,
          isExpanded: true,
          decoration: InputDecoration(
            labelText: required ? 'Cooperativa' : 'Cooperativa (opcional)',
            helperText: snap.hasError ? 'No se pudieron cargar las cooperativas' : null,
          ),
          items: [
            for (final c in coops)
              DropdownMenuItem(value: c['id'] as int, child: Text(c['name'] as String, overflow: TextOverflow.ellipsis)),
          ],
          onChanged: onChanged,
          validator: required ? (v) => v == null ? 'Elige la cooperativa' : null : null,
        );
      },
    );
  }
}
