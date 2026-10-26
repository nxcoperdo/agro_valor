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
            final isTrialing = data['isTrialing'] == true;
            final expiresAt = data['expiresAt'] as String?;

            if (isPro && !isTrialing) {
              return _PaidState(expiresAt: expiresAt, features: features);
            }

            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
              children: [
                _Hero(
                  features: features,
                  isTrialing: isTrialing,
                  expiresAt: expiresAt,
                  onPay: _openWebCheckout,
                ),
                const SizedBox(height: 28),
                _BenefitsGrid(
                  title: isTrialing ? 'Lo que perderías si no activas tu plan' : null,
                ),
                if (!isTrialing) ...[
                  const SizedBox(height: 28),
                  const _HowTo(),
                  const SizedBox(height: 28),
                  const _Faq(),
                  const SizedBox(height: 20),
                  _FinalCta(onPay: _openWebCheckout),
                ],
                const SizedBox(height: 16),
                const Muted(
                  '¿Prefieres pagar por Nequi o Daviplata? Escríbenos por WhatsApp y te activamos '
                  'el plan a mano desde tu cuenta.',
                  size: 12,
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// --- Encabezado: copy + tarjeta de precio -----------------------------------------

class _Hero extends StatelessWidget {
  const _Hero({required this.features, required this.isTrialing, required this.expiresAt, required this.onPay});

  final List<String> features;
  final bool isTrialing;
  final String? expiresAt;
  final Future<void> Function() onPay;

  static const _bulletLabels = ['Alertas por WhatsApp', 'Cálculo de precio neto', 'Comparación entre cooperativas'];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _EyebrowBadge(isTrialing ? 'Prueba gratis activa' : 'AgroValor Pro · 1 año'),
        const SizedBox(height: 14),
        if (isTrialing) ...[
          const Text(
            'Ya tienes acceso a AgroValor Pro',
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, height: 1.1, letterSpacing: -0.5),
          ),
          const SizedBox(height: 10),
          Text(
            expiresAt != null
                ? 'Tu prueba gratis de 7 días está activa hasta el ${formatDate(expiresAt)}. Paga ahora '
                    'para seguir con Pro sin interrupciones cuando termine.'
                : 'Tu prueba gratis está activa. Paga ahora para seguir con Pro sin interrupciones.',
            style: TextStyle(color: AvColors.fgMuted, fontSize: 15, height: 1.4),
          ),
        ] else ...[
          Text.rich(
            TextSpan(
              style: TextStyle(
                color: AvColors.fg,
                fontSize: 30,
                fontWeight: FontWeight.w800,
                height: 1.08,
                letterSpacing: -0.5,
              ),
              children: [
                TextSpan(text: 'Vende tu café con más certeza y '),
                TextSpan(text: 'mejores decisiones', style: TextStyle(color: AvColors.accent)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Convierte precios, factor y humedad en información útil para saber cuándo vender, '
            'dónde te conviene y cuánto recibirás.',
            style: TextStyle(color: AvColors.fgMuted, fontSize: 15, height: 1.4),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 18,
            runSpacing: 10,
            children: [for (final label in _bulletLabels) _CheckBullet(label)],
          ),
        ],
        const SizedBox(height: 24),
        _PriceCard(
          features: features,
          badgeLabel: isTrialing ? 'Asegura tu Pro' : 'Acceso inmediato',
          buttonLabel: isTrialing ? 'Pagar ahora' : 'Quiero vender mejor',
          onPay: onPay,
        ),
      ],
    );
  }
}

class _EyebrowBadge extends StatelessWidget {
  const _EyebrowBadge(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AvColors.accent.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AvColors.accent.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: AvColors.accent, shape: BoxShape.circle)),
          const SizedBox(width: 8),
          Text(
            label.toUpperCase(),
            style: TextStyle(color: AvColors.accent, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.6),
          ),
        ],
      ),
    );
  }
}

class _CheckBullet extends StatelessWidget {
  const _CheckBullet(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(color: AvColors.positive, shape: BoxShape.circle),
          child: const Icon(Icons.check_rounded, size: 14, color: Colors.white),
        ),
        const SizedBox(width: 8),
        Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
      ],
    );
  }
}

class _PriceCard extends StatelessWidget {
  const _PriceCard({required this.features, required this.badgeLabel, required this.buttonLabel, required this.onPay});

  final List<String> features;
  final String badgeLabel;
  final String buttonLabel;
  final Future<void> Function() onPay;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          margin: const EdgeInsets.only(top: 14),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AvColors.surfaceAlt,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AvColors.border),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.35), blurRadius: 40, offset: const Offset(0, 20))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Un año para vender con más información', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    '\$150.000',
                    style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800, fontFeatures: tabular, letterSpacing: -0.5),
                  ),
                  const SizedBox(width: 6),
                  Padding(
                    padding: EdgeInsets.only(bottom: 5),
                    child: Text('COP', style: TextStyle(color: AvColors.fgMuted, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Muted('Pago único · equivale a \$12.500 al mes', size: 12.5),
              const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Divider(height: 1)),
              const Text('Tu plan incluye:', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
              const SizedBox(height: 10),
              for (final f in features)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: EdgeInsets.only(top: 2),
                        child: Icon(Icons.check_rounded, size: 16, color: AvColors.accent),
                      ),
                      const SizedBox(width: 8),
                      Expanded(child: Text(f, style: const TextStyle(fontSize: 13.5))),
                    ],
                  ),
                ),
              const SizedBox(height: 12),
              SizedBox(width: double.infinity, child: FilledButton(onPressed: onPay, child: Text(buttonLabel))),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.shield_rounded, size: 14, color: AvColors.fgMuted),
                  SizedBox(width: 6),
                  Muted('Pago seguro con Mercado Pago', size: 11.5),
                ],
              ),
              const SizedBox(height: 4),
              const Center(child: Muted('No se renueva automáticamente', size: 11)),
              const SizedBox(height: 10),
              const Muted(
                'Condiciones: \$150.000 COP, un solo pago por 1 año de Pro. No es una suscripción: no se renueva ni se '
                'cobra de nuevo, y no hay nada que cancelar; al vencer vuelves al plan gratis. Puedes pagar de nuevo '
                'cuando quieras. Para pedir reembolso (retracto de 5 días hábiles) o eliminar tu cuenta, escríbenos por '
                'WhatsApp o usa Perfil → Mi cuenta. Más detalle en los Términos de uso.',
                size: 11,
              ),
            ],
          ),
        ),
        Positioned(
          top: 0,
          right: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
            decoration: BoxDecoration(
              color: AvColors.accent,
              borderRadius: BorderRadius.circular(999),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 14, offset: const Offset(0, 6))],
            ),
            child: Text(
              badgeLabel.toUpperCase(),
              style: TextStyle(color: AvColors.onAccent, fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.4),
            ),
          ),
        ),
      ],
    );
  }
}

// --- Beneficios --------------------------------------------------------------------

class _BenefitsGrid extends StatelessWidget {
  const _BenefitsGrid({this.title});

  final String? title;

  static const _items = [
    (Icons.notifications_active_rounded, 'Vende en el momento indicado',
        'Recibe alertas por WhatsApp cuando el precio llegue al valor que te conviene.'),
    (Icons.calculate_rounded, 'Conoce cuánto recibirás',
        'Calcula tu precio neto con factor y humedad. Sin cuentas confusas ni sorpresas.'),
    (Icons.bar_chart_rounded, 'Compara antes de decidir',
        'Revisa cuánto te queda en cada cooperativa y elige con información clara.'),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title == null) ...[
          Text('MENOS DUDAS. MÁS CONTROL.', style: TextStyle(color: AvColors.accent, fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
          const SizedBox(height: 6),
          const Text('Todo lo que necesitas antes de decir «vendo»', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
        ] else ...[
          Text(title!, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          const SizedBox(height: 14),
        ],
        for (final (icon, title, body) in _items)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AvColors.accent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(icon, color: AvColors.accent, size: 22),
                  ),
                  const SizedBox(height: 12),
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 4),
                  Muted(body, size: 13),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

// --- Cómo funciona -------------------------------------------------------------

class _HowTo extends StatelessWidget {
  const _HowTo();

  static const _steps = [
    ('1', 'Activa tu plan', 'Haz un único pago seguro.'),
    ('2', 'Configura tus datos', 'Define tu factor, humedad y transporte habituales.'),
    ('3', 'Decide con claridad', 'Compara cooperativas y elige cuándo vender.'),
  ];

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('UNA INVERSIÓN SIMPLE', style: TextStyle(color: AvColors.accent, fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
          const SizedBox(height: 6),
          const Text('Una buena decisión puede hacer la diferencia', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Muted(
            'AgroValor Pro te acompaña durante 1 año para que cada venta esté respaldada por '
            'números claros, no por suposiciones.',
            size: 13,
          ),
          const SizedBox(height: 16),
          for (final (n, title, body) in _steps)
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 26,
                    height: 26,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: AvColors.accent, shape: BoxShape.circle),
                    child: Text(n, style: TextStyle(color: AvColors.onAccent, fontWeight: FontWeight.w800, fontSize: 12)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                        const SizedBox(height: 2),
                        Muted(body, size: 12.5),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// --- Preguntas frecuentes ------------------------------------------------------

class _Faq extends StatelessWidget {
  const _Faq();

  static const _items = [
    ('¿Se renueva automáticamente?', 'No. Pagas una sola vez y tienes AgroValor Pro activo durante 1 año.'),
    ('¿Cuándo puedo empezar a usarlo?', 'Tu acceso se activa apenas se confirma el pago.'),
    ('¿Cómo se realiza el pago?', 'Con el checkout de Mercado Pago: tarjeta, PSE o el medio que prefieras ahí.'),
    ('¿Prefieres Nequi o Daviplata?', 'Escríbenos por WhatsApp y te ayudamos con la activación manual.'),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Antes de activar tu plan', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
        const SizedBox(height: 14),
        for (final (q, a) in _items)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(q, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                  const SizedBox(height: 4),
                  Muted(a, size: 13),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

// --- Banner final de CTA --------------------------------------------------------

class _FinalCta extends StatelessWidget {
  const _FinalCta({required this.onPay});

  final Future<void> Function() onPay;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: AvColors.accent, borderRadius: BorderRadius.circular(24)),
      child: Column(
        children: [
          Text(
            'TU PRÓXIMA VENTA EMPIEZA CON UNA MEJOR DECISIÓN',
            textAlign: TextAlign.center,
            style: TextStyle(color: AvColors.onAccent, fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.6),
          ),
          const SizedBox(height: 10),
          Text(
            'Ten la información lista cuando llegue el momento de vender',
            textAlign: TextAlign.center,
            style: TextStyle(color: AvColors.onAccent, fontSize: 18, fontWeight: FontWeight.w800, height: 1.2),
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onPay,
              style: FilledButton.styleFrom(backgroundColor: AvColors.bg, foregroundColor: AvColors.fg),
              child: const Text('Activar AgroValor Pro'),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            '\$150.000 COP por 1 año · Pago único',
            style: TextStyle(color: AvColors.onAccent, fontSize: 11.5, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

// --- Estado ya pagado (sin trial) -----------------------------------------------

class _PaidState extends StatelessWidget {
  const _PaidState({required this.expiresAt, required this.features});

  final String? expiresAt;
  final List<String> features;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Pill(label: 'AgroValor Pro', color: AvColors.accent),
              const SizedBox(height: 14),
              const Text('Ya eres Pro', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Text(
                expiresAt != null ? 'Tu plan está activo hasta el ${formatDate(expiresAt)}.' : 'Tu plan está activo.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AvColors.fgMuted),
              ),
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
                      Icon(Icons.check_rounded, size: 18, color: AvColors.positive),
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
  }
}
