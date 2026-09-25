import 'package:flutter/material.dart';

import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        final user = session.user ?? const {};
        final limits = user['limits'] as Map<String, dynamic>?;
        final features = (limits?['features'] as List<dynamic>? ?? const []).cast<String>();

        return RefreshIndicator(
          onRefresh: session.refreshUser,
          color: AvColors.accent,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      (user['fullName'] as String?) ?? (user['username'] as String? ?? ''),
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 4),
                    Muted('@${user['username']}${user['municipality'] != null ? ' · ${user['municipality']}' : ''}'),
                    if (user['phone'] != null) Muted('WhatsApp: ${user['phone']}'),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            limits?['name'] as String? ?? 'Plan',
                            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                          ),
                        ),
                        Pill(
                          label: session.isPro ? 'Pro' : 'Gratis',
                          color: session.isPro ? AvColors.accent : AvColors.fgMuted,
                        ),
                      ],
                    ),
                    if (user['expiresAt'] != null) Muted('Vigente hasta el ${formatDate(user['expiresAt'] as String)}'),
                    const SizedBox(height: 12),
                    for (final f in features)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.check_rounded, size: 18, color: AvColors.positive),
                            const SizedBox(width: 8),
                            Expanded(child: Text(f)),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              OutlinedButton.icon(
                onPressed: session.logout,
                icon: const Icon(Icons.logout_rounded),
                label: const Text('Cerrar sesión'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  foregroundColor: AvColors.fg,
                  side: const BorderSide(color: AvColors.border),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
