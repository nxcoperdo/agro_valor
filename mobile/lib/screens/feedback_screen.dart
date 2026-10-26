import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/forms.dart';

/// Debe coincidir con `version:` del pubspec; llega al panel de administración con cada mensaje.
const _appVersion = '1.0.0+1';

const _types = [
  (id: 'sugerencia', label: 'Sugerencia'),
  (id: 'error', label: 'Algo falla'),
  (id: 'otro', label: 'Otro'),
];

const _statusLabels = {'nuevo': 'Recibido', 'en_revision': 'En revisión', 'resuelto': 'Resuelto'};

/// Sugerencias y reportes de problemas. Es gratis y abierto a todos los usuarios con cuenta.
class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key, required this.session});

  final Session session;

  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  final _message = TextEditingController();
  String _type = 'sugerencia';
  bool _busy = false;
  late Future<Json> _mine = _api.myFeedback();

  ApiClient get _api => widget.session.api;

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _message.text.trim();
    if (text.length < 5) {
      showMessage(context, 'Cuéntanos un poco más para poder ayudarte.', error: true);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    try {
      final res = await _api.sendFeedback({
        'type': _type,
        'message': text,
        'platform': defaultTargetPlatform.name.toLowerCase(),
        'appVersion': _appVersion,
      });
      if (!mounted) return;
      _message.clear();
      setState(() => _mine = _api.myFeedback());
      showMessage(context, res['message'] as String? ?? 'Gracias, lo vamos a revisar.');
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sugerencias y reportes')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          const Muted('¿Una idea para mejorar AgroValor o algo que no funciona? Escríbenos, lo leemos todo.'),
          const SizedBox(height: 16),
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(
                  spacing: 8,
                  children: [
                    for (final t in _types)
                      ChoiceChip(
                        label: Text(t.label),
                        selected: _type == t.id,
                        onSelected: (_) => setState(() => _type = t.id),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _message,
                  minLines: 4,
                  maxLines: 8,
                  maxLength: 1000,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(hintText: 'Cuéntanos qué pasó o qué te gustaría ver'),
                ),
                const SizedBox(height: 8),
                BusyButton(label: 'Enviar', icon: Icons.send_rounded, busy: _busy, onPressed: _submit),
              ],
            ),
          ),
          const SectionLabel('Mis mensajes'),
          FutureBuilder<Json>(
            future: _mine,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) {
                return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
              }
              if (snap.hasError) return Muted('${snap.error}');
              final items = (snap.data?['feedback'] as List<dynamic>? ?? const []).cast<Json>();
              if (items.isEmpty) return const Muted('Todavía no has enviado mensajes.');
              return Column(children: [for (final f in items) _FeedbackRow(item: f)]);
            },
          ),
        ],
      ),
    );
  }
}

class _FeedbackRow extends StatelessWidget {
  const _FeedbackRow({required this.item});

  final Json item;

  @override
  Widget build(BuildContext context) {
    // Este endpoint devuelve las filas tal cual la base de datos (snake_case).
    final status = item['status'] as String? ?? 'nuevo';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(item['message'] as String? ?? '', maxLines: 3, overflow: TextOverflow.ellipsis)),
          const SizedBox(width: 12),
          Pill(
            label: _statusLabels[status] ?? status,
            color: status == 'resuelto' ? AvColors.positive : AvColors.fgMuted,
          ),
        ],
      ),
    );
  }
}
