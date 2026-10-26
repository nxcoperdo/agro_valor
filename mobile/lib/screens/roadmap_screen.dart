import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';

const _statusLabels = {'en_desarrollo': 'En desarrollo', 'planeado': 'Planeado', 'pronto': 'Muy pronto'};

/// Próximas funciones. La lista vive en el servidor para poder cambiarla sin publicar la app.
class RoadmapScreen extends StatelessWidget {
  const RoadmapScreen({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Próximamente')),
      body: AsyncView<Json>(
        load: session.api.roadmap,
        builder: (context, data) {
          final items = (data['items'] as List<dynamic>? ?? const []).cast<Json>();
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              const Muted('Esto es lo que estamos preparando. ¿Falta algo que necesites? Cuéntanoslo en Sugerencias.'),
              const SizedBox(height: 16),
              for (final item in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: SectionCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                item['title'] as String? ?? '',
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                              ),
                            ),
                            Pill(
                              label: _statusLabels[item['status']] ?? '${item['status']}',
                              color: item['status'] == 'en_desarrollo' ? AvColors.accent : AvColors.fgMuted,
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Muted(item['description'] as String? ?? ''),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
