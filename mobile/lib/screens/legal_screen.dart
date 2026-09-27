import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Pantalla genérica para cualquier texto legal (privacidad, términos): mismo layout,
/// distinto título y distinta llamada. La app no tiene política de cookies porque no
/// usa cookies (eso es solo de la web); acá basta con privacidad y términos.
class LegalScreen extends StatelessWidget {
  const LegalScreen({super.key, required this.title, required this.load});

  final String title;
  final Future<Json> Function() load;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: AsyncView<Json>(
        load: load,
        builder: (context, data) {
          final sections = (data['sections'] as List<dynamic>? ?? const []).cast<Json>();
          final updatedAt = data['updatedAt'] as String?;

          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              if (updatedAt != null) Muted('Última actualización: ${formatDate(updatedAt)}'),
              const SizedBox(height: 12),
              for (final section in sections)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: SectionCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          section['heading'] as String? ?? '',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          section['body'] as String? ?? '',
                          style: const TextStyle(color: AvColors.fgMuted, height: 1.4),
                        ),
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
