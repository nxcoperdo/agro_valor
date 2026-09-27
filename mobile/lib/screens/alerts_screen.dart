import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/forms.dart';
import 'pro_screen.dart';
import 'profile_screen.dart';

const _typeLabels = {
  'above': 'Cuando suba de',
  'below': 'Cuando baje de',
  'daily': 'Resumen diario',
  'weekly': 'Resumen semanal',
};

/// Avisos por la app y por WhatsApp cuando el precio de referencia cruza el valor que le sirve al caficultor.
class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key, required this.session});

  final Session session;

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  // Cambiar la llave obliga al AsyncView a volver a cargar después de crear o borrar.
  Key _viewKey = UniqueKey();
  bool _testing = false;

  ApiClient get _api => widget.session.api;

  void _reload() => setState(() => _viewKey = UniqueKey());

  Future<void> _run(Future<void> Function() action, {String? success}) async {
    try {
      await action();
      if (mounted && success != null) showMessage(context, success);
      _reload();
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    }
  }

  Future<void> _sendTest() async {
    setState(() => _testing = true);
    try {
      final res = await _api.testAlert();
      if (mounted) showMessage(context, res['message'] as String? ?? 'Mensaje enviado');
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _testing = false);
    }
  }

  Future<void> _newAlert() async {
    final created = await showFormSheet<bool>(context, title: 'Nueva alerta', child: _NewAlertForm(api: _api));
    if (created == true) {
      if (mounted) showMessage(context, 'Alerta creada. Te avisaremos apenas se cumpla.');
      _reload();
    }
  }

  Future<void> _enablePush() async {
    final push = widget.session.push;
    if (!push.available) {
      showMessage(context, 'Esta versión de la app todavía no tiene notificaciones', error: true);
      return;
    }
    final ok = await push.register();
    if (!mounted) return;
    if (ok) {
      showMessage(context, 'Notificaciones activadas en este teléfono');
      _reload();
    } else {
      showMessage(context, 'Activa los permisos de notificación de AgroValor en los ajustes del teléfono', error: true);
    }
  }

  Future<void> _editProfile() async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProfileScreen(session: widget.session)));
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    final pro = widget.session.isPro;
    return Scaffold(
      appBar: AppBar(title: const Text('Alertas de precio')),
      floatingActionButton: pro
          ? FloatingActionButton.extended(
              onPressed: _newAlert,
              icon: const Icon(Icons.add_alert_rounded),
              label: const Text('Nueva alerta'),
            )
          : null,
      body: !pro
          ? ProUpsell(
              title: 'Alertas de precio',
              body: 'Te avisamos al celular, con notificación y por WhatsApp, cuando el precio suba o baje del valor que te sirve, '
                  'o te mandamos un resumen diario o semanal.',
              icon: Icons.notifications_active_rounded,
              onUpgrade: () =>
                  Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProScreen(session: widget.session))),
            )
          : AsyncView<Json>(
              key: _viewKey,
              load: _api.alerts,
              builder: (context, data) => _body(data),
            ),
    );
  }

  Widget _body(Json data) {
    final alerts = (data['alerts'] as List<dynamic>? ?? const []).cast<Json>();
    final deliveries = (data['deliveries'] as List<dynamic>? ?? const []).cast<Json>();

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      children: [
        _ChannelsCard(
          data: data,
          testing: _testing,
          onTest: _sendTest,
          onEdit: _editProfile,
          onEnablePush: _enablePush,
        ),
        const SectionLabel('Mis alertas'),
        if (alerts.isEmpty) const Muted('Todavía no tienes alertas. Crea una con el botón de abajo.'),
        for (final a in alerts) ...[
          _AlertTile(
            alert: a,
            onToggle: (active) => _run(() => _api.setAlertActive(a['id'] as int, active)),
            onDelete: () => _run(() => _api.deleteAlert(a['id'] as int), success: 'Alerta eliminada'),
          ),
          const SizedBox(height: 8),
        ],
        if (deliveries.isNotEmpty) ...[
          const SectionLabel('Últimos envíos'),
          for (final d in deliveries) _DeliveryTile(delivery: d),
        ],
      ],
    );
  }
}

class _AlertTile extends StatelessWidget {
  const _AlertTile({required this.alert, required this.onToggle, required this.onDelete});

  final Json alert;
  final ValueChanged<bool> onToggle;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final threshold = alert['thresholdCopCarga'] as num?;
    final active = alert['active'] == true;
    final last = alert['lastTriggeredAt'] as String?;

    return SectionCard(
      padding: const EdgeInsets.fromLTRB(16, 10, 4, 10),
      child: Row(
        children: [
          Icon(
            switch (alert['type']) {
              'above' => Icons.trending_up_rounded,
              'below' => Icons.trending_down_rounded,
              _ => Icons.schedule_rounded,
            },
            color: active ? AvColors.accent : AvColors.fgFaint,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Opacity(
              opacity: active ? 1 : 0.5,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_typeLabels[alert['type']] ?? '${alert['type']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                  if (threshold != null) Text('${formatCop(threshold)} por carga', style: mono(size: 13)),
                  Muted(last != null ? 'Último aviso ${timeAgo(last)}' : 'Todavía no se ha disparado', size: 12),
                ],
              ),
            ),
          ),
          Switch(value: active, onChanged: onToggle),
          IconButton(
            tooltip: 'Eliminar',
            onPressed: onDelete,
            icon: const Icon(Icons.delete_outline_rounded, color: AvColors.fgMuted),
          ),
        ],
      ),
    );
  }
}

class _DeliveryTile extends StatelessWidget {
  const _DeliveryTile({required this.delivery});

  final Json delivery;

  @override
  Widget build(BuildContext context) {
    final sent = delivery['status'] == 'sent';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            delivery['channel'] == 'push' ? Icons.notifications_rounded : Icons.chat_rounded,
            size: 18,
            color: sent ? AvColors.positive : AvColors.danger,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  delivery['message'] as String? ?? '',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13),
                ),
                Muted(
                  '${timeAgo(delivery['createdAt'] as String?)}'
                  '${delivery['error'] != null ? ' · ${delivery['error']}' : ''}',
                  size: 12,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NewAlertForm extends StatefulWidget {
  const _NewAlertForm({required this.api});

  final ApiClient api;

  @override
  State<_NewAlertForm> createState() => _NewAlertFormState();
}

class _NewAlertFormState extends State<_NewAlertForm> {
  final _form = GlobalKey<FormState>();
  final _threshold = TextEditingController();
  String _type = 'above';
  bool _busy = false;

  bool get _needsThreshold => _type == 'above' || _type == 'below';

  @override
  void dispose() {
    _threshold.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await widget.api.createAlert({
        'type': _type,
        if (_needsThreshold) 'thresholdCopCarga': parseCop(_threshold.text),
      });
      if (mounted) Navigator.of(context).pop(true);
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'above', label: Text('Sube')),
              ButtonSegment(value: 'below', label: Text('Baja')),
              ButtonSegment(value: 'daily', label: Text('Diario')),
              ButtonSegment(value: 'weekly', label: Text('Semanal')),
            ],
            selected: {_type},
            showSelectedIcon: false,
            onSelectionChanged: (s) => setState(() => _type = s.first),
          ),
          const SizedBox(height: 16),
          if (_needsThreshold)
            NumberField(
              controller: _threshold,
              label: _type == 'above' ? 'Avísame cuando la carga suba de' : 'Avísame cuando la carga baje de',
              kind: NumberKind.cop,
              required: true,
              min: 1,
            )
          else
            Muted(
              _type == 'daily'
                  ? 'Cada mañana te llega el precio de referencia del día.'
                  : 'Una vez por semana te llega cómo se movió el precio.',
            ),
          const SizedBox(height: 20),
          BusyButton(label: 'Crear alerta', busy: _busy, onPressed: _save),
        ],
      ),
    );
  }
}

/// Por dónde le llegan los avisos: la app (push) y WhatsApp.
class _ChannelsCard extends StatelessWidget {
  const _ChannelsCard({
    required this.data,
    required this.testing,
    required this.onTest,
    required this.onEdit,
    required this.onEnablePush,
  });

  final Json data;
  final bool testing;
  final VoidCallback onTest;
  final VoidCallback onEdit;
  final VoidCallback onEnablePush;

  @override
  Widget build(BuildContext context) {
    final phone = data['phone'] as String?;
    final devices = data['deviceCount'] as int? ?? 0;
    final pushOn = data['notifyPush'] != false;
    final whatsappOn = data['notifyWhatsapp'] != false;

    final pushStatus = !pushOn
        ? 'Apagadas'
        : devices == 0
            ? 'Sin activar en este teléfono'
            : devices == 1
                ? 'Activas en 1 teléfono'
                : 'Activas en $devices teléfonos';
    final whatsappStatus = !whatsappOn ? 'Apagado' : phone ?? 'Falta tu número';

    return SectionCard(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ChannelRow(
            icon: Icons.notifications_rounded,
            color: AvColors.accent,
            title: 'Notificaciones en la app',
            status: pushStatus,
            ok: pushOn && devices > 0,
            action: pushOn && devices == 0 ? TextButton(onPressed: onEnablePush, child: const Text('Activar')) : null,
          ),
          if (data['pushConfigured'] == false)
            const Padding(
              padding: EdgeInsets.only(left: 36, bottom: 4),
              child: Muted('El servidor todavía no envía notificaciones push.', size: 12),
            ),
          _ChannelRow(
            icon: Icons.chat_rounded,
            color: AvColors.positive,
            title: 'WhatsApp',
            status: whatsappStatus,
            ok: whatsappOn && phone != null,
            action: whatsappOn && phone == null ? TextButton(onPressed: onEdit, child: const Text('Agregar')) : null,
          ),
          if (data['whatsappConfigured'] == false)
            const Padding(
              padding: EdgeInsets.only(left: 36, bottom: 4),
              child: Muted('El envío de WhatsApp todavía no está conectado en el servidor.', size: 12),
            ),
          const Divider(height: 16),
          Row(
            children: [
              TextButton.icon(
                onPressed: onEdit,
                icon: const Icon(Icons.tune_rounded, size: 18),
                label: const Text('Elegir canales'),
              ),
              const Spacer(),
              TextButton.icon(
                onPressed: testing ? null : onTest,
                icon: const Icon(Icons.send_rounded, size: 18),
                label: Text(testing ? 'Enviando…' : 'Enviar prueba'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ChannelRow extends StatelessWidget {
  const _ChannelRow({
    required this.icon,
    required this.color,
    required this.title,
    required this.status,
    required this.ok,
    this.action,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String status;
  final bool ok;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, color: ok ? color : AvColors.fgFaint),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                Text(status, style: TextStyle(fontSize: 13, color: ok ? AvColors.fg : AvColors.fgMuted)),
              ],
            ),
          ),
          ?action,
        ],
      ),
    );
  }
}
