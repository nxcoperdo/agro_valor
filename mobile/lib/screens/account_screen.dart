import 'package:flutter/material.dart';

import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'alerts_screen.dart';
import 'privacy_screen.dart';
import 'profile_screen.dart';
import 'report_screen.dart';
import 'sales_screen.dart';

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
              const SizedBox(height: 12),
              Card(
                clipBehavior: Clip.antiAlias,
                child: Column(
                  children: [
                    _MenuTile(
                      icon: Icons.badge_rounded,
                      title: 'Mis datos',
                      subtitle: 'WhatsApp, notificaciones y datos de tu café',
                      open: () => ProfileScreen(session: session),
                    ),
                    _MenuTile(
                      icon: Icons.notifications_active_rounded,
                      title: 'Alertas de precio',
                      subtitle: 'Notificación y WhatsApp cuando el precio te convenga',
                      pro: !session.isPro,
                      open: () => AlertsScreen(session: session),
                    ),
                    _MenuTile(
                      icon: Icons.receipt_long_rounded,
                      title: 'Mis ventas',
                      subtitle: 'Historial frente al precio de referencia',
                      pro: !session.isPro,
                      open: () => SalesScreen(session: session),
                    ),
                    _MenuTile(
                      icon: Icons.campaign_rounded,
                      title: 'Reportar precio',
                      subtitle: 'Cuéntanos cuánto te pagó una cooperativa',
                      open: () => ReportScreen(session: session),
                    ),
                    _MenuTile(
                      icon: Icons.privacy_tip_outlined,
                      title: 'Política de privacidad',
                      subtitle: 'Qué datos guardamos y para qué',
                      open: () => PrivacyScreen(session: session),
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
              const SizedBox(height: 28),
              const Divider(color: AvColors.border),
              const SizedBox(height: 12),
              const Text('Zona de peligro', style: TextStyle(fontWeight: FontWeight.w700, color: AvColors.danger)),
              const SizedBox(height: 4),
              const Muted('Elimina tu cuenta, tus alertas y tu historial de ventas. No se puede deshacer.', size: 12),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => _confirmDeleteAccount(context, session),
                icon: const Icon(Icons.delete_forever_rounded, color: AvColors.danger),
                label: const Text('Eliminar mi cuenta', style: TextStyle(color: AvColors.danger)),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  side: const BorderSide(color: AvColors.danger),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _confirmDeleteAccount(BuildContext context, Session session) async {
    final password = TextEditingController();
    var busy = false;
    String? error;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setState) => AlertDialog(
          title: const Text('Eliminar mi cuenta'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Esto no se puede deshacer. Escribe tu contraseña para confirmar.'),
              const SizedBox(height: 16),
              TextField(
                controller: password,
                obscureText: true,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Contraseña'),
              ),
              if (error != null) ...[
                const SizedBox(height: 8),
                Text(error!, style: const TextStyle(color: AvColors.danger, fontSize: 13)),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: busy ? null : () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: busy
                  ? null
                  : () async {
                      if (password.text.isEmpty) return;
                      setState(() => busy = true);
                      try {
                        await session.deleteAccount(password.text);
                        if (dialogContext.mounted) Navigator.of(dialogContext).pop();
                      } catch (e) {
                        setState(() {
                          busy = false;
                          error = '$e';
                        });
                      }
                    },
              style: FilledButton.styleFrom(backgroundColor: AvColors.danger),
              child: busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Eliminar'),
            ),
          ],
        ),
      ),
    );

    password.dispose();
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({required this.icon, required this.title, required this.subtitle, required this.open, this.pro = false});

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget Function() open;
  final bool pro;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: AvColors.accent),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(subtitle, style: const TextStyle(color: AvColors.fgMuted, fontSize: 12)),
      trailing: pro
          ? const Pill(label: 'Pro', color: AvColors.accent)
          : const Icon(Icons.chevron_right_rounded, color: AvColors.fgMuted),
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => open())),
    );
  }
}
