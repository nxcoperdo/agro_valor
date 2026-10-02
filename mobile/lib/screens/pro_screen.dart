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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Plan Pro')),
      body: ListenableBuilder(
        listenable: widget.session,
        builder: (context, _) => AsyncView<Json>(
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
                      ] else ...[
                        const Text(
                          '\$150.000',
                          style: TextStyle(fontSize: 30, fontWeight: FontWeight.w700, fontFeatures: tabular),
                        ),
                        const Muted('COP / año', size: 13),
                        const SizedBox(height: 4),
                        const Muted('pago único por Mercado Pago, válido por 1 año', size: 12),
                        const SizedBox(height: 18),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: _openWebCheckout,
                            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                            child: const Text('Pagar en la web'),
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
