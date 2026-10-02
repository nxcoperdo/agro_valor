import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/api_client.dart';
import '../theme.dart';

/// Modal de bienvenida que se muestra una sola vez, justo al crear la cuenta.
Future<void> showTrialWelcomeDialog(BuildContext context, Json user) {
  final raw = user['expiresAt'] as String?;
  final expiry = raw == null ? null : DateFormat("d 'de' MMMM 'de' y", 'es').format(DateTime.parse(raw).toLocal());
  final features = ((user['limits'] as Map?)?['features'] as List?)?.cast<String>() ?? const <String>[];

  return showDialog<void>(
    context: context,
    builder: (ctx) => Dialog(
      backgroundColor: AvColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: AvColors.border),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AvColors.accent.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(99),
              ),
              child: const Text(
                '7 DÍAS GRATIS DE REGALO',
                style: TextStyle(color: AvColors.accent, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1),
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Ya tienes acceso a AgroValor Pro',
              style: TextStyle(color: AvColors.fg, fontSize: 22, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            Text(
              'Como bienvenida, activamos tu plan Pro gratis por 7 días'
              '${expiry != null ? ', hasta el $expiry' : ''}. Cuando termine, vuelves al plan gratis '
              'automáticamente; puedes pagar en cualquier momento desde Plan Pro para seguir sin interrupciones.',
              style: const TextStyle(color: AvColors.fgMuted, height: 1.4),
            ),
            if (features.isNotEmpty) ...[
              const SizedBox(height: 14),
              for (final f in features)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.check_rounded, size: 18, color: AvColors.positive),
                      const SizedBox(width: 8),
                      Expanded(child: Text(f, style: const TextStyle(color: AvColors.fg))),
                    ],
                  ),
                ),
            ],
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Empezar a usar Pro')),
            ),
          ],
        ),
      ),
    ),
  );
}
