import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Política de privacidad')),
      body: AsyncView<Json>(
        load: session.api.privacyPolicy,
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
