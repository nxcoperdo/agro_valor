import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../session.dart';
import '../theme.dart';
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
  late bool _notifyWhatsapp = widget.profile['notifyWhatsapp'] != false;
  late bool _notifyPush = widget.profile['notifyPush'] != false;
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
        'notifyWhatsapp': _notifyWhatsapp,
        'notifyPush': _notifyPush,
      });
      final push = widget.session.push;
      if (_notifyPush && push.available) {
        final ok = await push.register();
        if (!ok && mounted) {
          showMessage(context, 'Activa los permisos de notificación de AgroValor en los ajustes del teléfono', error: true);
        }
      }
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
          const SectionLabel('Cómo te avisamos'),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                SwitchListTile.adaptive(
                  value: _notifyPush,
                  onChanged: (v) => setState(() => _notifyPush = v),
                  secondary: Icon(Icons.notifications_rounded, color: AvColors.accent),
                  title: const Text('Notificaciones en la app'),
                  subtitle: Text(
                    widget.session.push.available
                        ? 'Llegan a este teléfono, sin costo'
                        : 'Esta versión de la app todavía no tiene notificaciones',
                    style: TextStyle(color: AvColors.fgMuted, fontSize: 12),
                  ),
                ),
                SwitchListTile.adaptive(
                  value: _notifyWhatsapp,
                  onChanged: (v) => setState(() => _notifyWhatsapp = v),
                  secondary: Icon(Icons.chat_rounded, color: AvColors.positive),
                  title: const Text('WhatsApp'),
                  subtitle: Text(
                    'Al número de arriba',
                    style: TextStyle(color: AvColors.fgMuted, fontSize: 12),
                  ),
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
          const SectionLabel('Seguridad'),
          _ChangePasswordCard(session: widget.session),
        ],
      ),
    );
  }
}

class _ChangePasswordCard extends StatefulWidget {
  const _ChangePasswordCard({required this.session});

  final Session session;

  @override
  State<_ChangePasswordCard> createState() => _ChangePasswordCardState();
}

class _ChangePasswordCardState extends State<_ChangePasswordCard> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _newPassword = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _current.dispose();
    _newPassword.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    try {
      await widget.session.api.changePassword(_current.text, _newPassword.text);
      _current.clear();
      _newPassword.clear();
      if (mounted) showMessage(context, 'Contraseña cambiada');
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: _current,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Contraseña actual'),
              validator: (v) => (v == null || v.isEmpty) ? 'Escribe tu contraseña actual' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _newPassword,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Contraseña nueva', helperText: 'Mínimo 8 caracteres'),
              validator: (v) => (v == null || v.length < 8) ? 'Mínimo 8 caracteres' : null,
            ),
            const SizedBox(height: 16),
            BusyButton(label: 'Cambiar contraseña', busy: _busy, onPressed: _submit),
          ],
        ),
      ),
    );
  }
}
