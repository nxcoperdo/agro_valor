import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';
import '../config.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Página completa del plan Pro: beneficios y el enlace a la web para pagar.
///
/// La app no procesa ningún pago propio a propósito: si vendiera contenido digital
/// dentro de la app tendría que pasar por Google Play Billing. Como Pro se cobra por
/// Mercado Pago, el botón abre el navegador externo hacia la web — el mismo patrón
/// que usan apps como Netflix o Spotify para evitar esa exigencia.
class ProScreen extends StatefulWidget {
  const ProScreen({super.key, required this.session});

  final Session session;

  @override
  State<ProScreen> createState() => _ProScreenState();
}

class _ProScreenState extends State<ProScreen> with WidgetsBindingObserver {
  /// AsyncView guarda su Future; cambiar la key lo obliga a volver a pedir el plan.
  int _reloadKey = 0;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Al volver del navegador (donde pagó), se refresca el plan solo, sin que el
    // usuario tenga que hacer pull-to-refresh para ver que ya es Pro.
    if (state == AppLifecycleState.resumed) {
      widget.session.refreshUser();
    }
  }

  Future<void> _openWebCheckout() async {
    final uri = Uri.parse('$apiBaseUrl/#/pro');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  /// Cancela la renovación en Mercado Pago. Pro sigue hasta el fin del mes ya pagado.
  Future<void> _confirmCancel(String? expiresAt) async {
    final until = expiresAt != null ? 'el ${formatDate(expiresAt)}' : 'el final del mes ya pagado';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancelar suscripción'),
        content: Text(
          'No se te volverá a cobrar. Sigues con Pro hasta $until; después dejarás de recibir las alertas por WhatsApp.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('No, seguir con Pro')),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: AvColors.danger),
            child: const Text('Sí, cancelar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await widget.session.api.cancelSubscription();
      await widget.session.refreshUser();
      if (!mounted) return;
      setState(() => _reloadKey++);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Suscripción cancelada. No se te volverá a cobrar.')),
      );
    } on ApiError catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Plan Pro')),
      body: ListenableBuilder(
        listenable: widget.session,
        builder: (context, _) => AsyncView<Json>(
          key: ValueKey(_reloadKey),
          load: widget.session.api.plan,
          builder: (context, data) {
            final pro = (data['plans'] as Json)['pro'] as Json;
            final features = (pro['features'] as List<dynamic>).cast<String>();
            final isPro = widget.session.isPro;
            final expiresAt = data['expiresAt'] as String?;

            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      const Pill(label: 'AgroValor Pro', color: AvColors.accent),
                      const SizedBox(height: 14),
                      const Text(
                        'Todo lo que necesitas para vender mejor tu café',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, height: 1.25),
                      ),
                      const SizedBox(height: 16),
                      if (isPro) ...[
                        Text(
                          expiresAt != null ? 'Ya eres Pro · vigente hasta el ${formatDate(expiresAt)}' : 'Ya eres Pro',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AvColors.positive, fontWeight: FontWeight.w600),
                        ),
                        if (data['mpSubscriptionActive'] == true) ...[
                          const SizedBox(height: 14),
                          const Muted('Se renueva sola cada mes con Mercado Pago.', size: 12),
                          TextButton(
                            onPressed: () => _confirmCancel(expiresAt),
                            style: TextButton.styleFrom(foregroundColor: AvColors.danger),
                            child: const Text('Cancelar suscripción'),
                          ),
                        ],
                        if (data['mpSubscriptionCancelled'] == true) ...[
                          const SizedBox(height: 8),
                          const Muted('Cancelaste la renovación: no se te volverá a cobrar.', size: 12),
                        ],
                      ] else ...[
                        const Text(
                          '\$12.000',
                          style: TextStyle(fontSize: 30, fontWeight: FontWeight.w700, fontFeatures: tabular),
                        ),
                        const Muted('COP / mes', size: 13),
                        const SizedBox(height: 4),
                        const Muted('cobro automático cada mes por Mercado Pago, cancelas cuando quieras', size: 12),
                        const SizedBox(height: 18),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: _openWebCheckout,
                            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                            child: const Text('Suscribirme en la web'),
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Muted('Se abre en el navegador. Al volver, ya quedas como Pro.', size: 12),
                      ],
                    ],
                  ),
                ),
                const SectionLabel('Qué incluye'),
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final f in features)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
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
              ],
            );
          },
        ),
      ),
    );
  }
}
