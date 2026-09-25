import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../session.dart';
import '../widgets/common.dart';
import '../widgets/forms.dart';

/// Datos del caficultor: WhatsApp para las alertas y los valores que la calculadora usa por defecto.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mis datos')),
      body: AsyncView<Json>(
        load: session.api.profile,
        builder: (context, profile) => _ProfileForm(session: session, profile: profile),
      ),
    );
  }
}

class _ProfileForm extends StatefulWidget {
  const _ProfileForm({required this.session, required this.profile});

  final Session session;
  final Json profile;

  @override
  State<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends State<_ProfileForm> {
  final _form = GlobalKey<FormState>();
  late final _fullName = TextEditingController(text: widget.profile['fullName'] as String? ?? '');
  late final _phone = TextEditingController(text: widget.profile['phone'] as String? ?? '');
  late final _municipality = TextEditingController(text: widget.profile['municipality'] as String? ?? '');
  late final _factor = TextEditingController(text: decimalInputText(widget.profile['defaultFactor'] as num?));
  late final _humidity = TextEditingController(text: decimalInputText(widget.profile['defaultHumidity'] as num?));
  late final _transport = TextEditingController(text: copInputText(widget.profile['transportCostCopCarga'] as num?));
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_fullName, _phone, _municipality, _factor, _humidity, _transport]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    try {
      await widget.session.api.updateProfile({
        'fullName': _fullName.text.trim(),
        'phone': _phone.text.trim(),
        'municipality': _municipality.text.trim(),
        'defaultFactor': parseDecimal(_factor.text),
        'defaultHumidity': parseDecimal(_humidity.text),
        'transportCostCopCarga': parseCop(_transport.text),
      });
      await widget.session.refreshUser();
      if (!mounted) return;
      showMessage(context, 'Datos guardados');
      Navigator.of(context).pop();
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          SectionCard(
            child: Column(
              children: [
                TextFormField(
                  controller: _fullName,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Nombre'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'WhatsApp',
                    hintText: '300 123 4567',
                    helperText: 'Aquí te llegan las alertas de precio',
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _municipality,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Municipio'),
                ),
              ],
            ),
          ),
          const SectionLabel('Mi café (para la calculadora)'),
          SectionCard(
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(child: NumberField(controller: _factor, label: 'Factor', hint: '94', min: 60, max: 140)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: NumberField(controller: _humidity, label: 'Humedad', hint: '12', suffix: '%', min: 0, max: 30),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                NumberField(
                  controller: _transport,
                  label: 'Transporte por carga',
                  kind: NumberKind.cop,
                  hint: '0',
                  helper: 'Lo que te cuesta llevar una carga hasta el punto de compra',
                  max: 1000000,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          BusyButton(label: 'Guardar', busy: _busy, onPressed: _save),
        ],
      ),
    );
  }
}
