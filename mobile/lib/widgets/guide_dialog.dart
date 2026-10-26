import 'package:flutter/material.dart';

import '../theme.dart';

typedef _Step = ({IconData icon, String title, String body});

const _steps = <_Step>[
  (
    icon: Icons.show_chart_rounded,
    title: 'El precio al día',
    body: 'En Precio ves cuánto vale hoy la carga de café y, con el selector de arriba, también el cacao. '
        'Toca el gráfico para ver cada día.',
  ),
  (
    icon: Icons.calendar_month_rounded,
    title: 'Hacia dónde va el mercado',
    body: 'Proyección muestra la curva de futuros y un rango de precio probable. '
        'Es una guía para decidir cuándo vender, no un precio seguro.',
  ),
  (
    icon: Icons.storefront_rounded,
    title: 'Quién paga mejor',
    body: 'Cooperativas compara lo que paga cada una. Si tú pagas un mejor precio, '
        'cuéntalo desde Cuenta > Reportar precio.',
  ),
  (
    icon: Icons.calculate_rounded,
    title: 'Tus cuentas en un solo lugar',
    body: 'En Calcular haces la cuenta de una compra, registras tus compras y ventas, '
        'y controlas lo que tienes en Procesamiento. Con Pro lo guardas todo.',
  ),
  (
    icon: Icons.notifications_active_rounded,
    title: 'Que el precio te avise',
    body: 'Crea una alerta en Alertas y te avisamos cuando el precio llegue a tu meta. '
        'Esta guía la puedes volver a abrir desde Cuenta.',
  ),
];

/// Tutorial de 5 pasos para quien acaba de crear su cuenta; se puede omitir en cualquier momento.
Future<void> showGuideDialog(BuildContext context) {
  return showDialog<void>(
    context: context,
    builder: (_) => const _GuideDialog(),
  );
}

class _GuideDialog extends StatefulWidget {
  const _GuideDialog();

  @override
  State<_GuideDialog> createState() => _GuideDialogState();
}

class _GuideDialogState extends State<_GuideDialog> {
  final _controller = PageController();
  int _page = 0;

  bool get _last => _page == _steps.length - 1;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _next() {
    if (_last) {
      Navigator.of(context).pop();
    } else {
      _controller.nextPage(duration: const Duration(milliseconds: 280), curve: Curves.easeOutCubic);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: AvColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: AvColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text('Omitir', style: TextStyle(color: AvColors.fgMuted)),
              ),
            ),
            SizedBox(
              height: 230,
              child: PageView.builder(
                controller: _controller,
                itemCount: _steps.length,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (_, i) {
                  final step = _steps[i];
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AvColors.accent.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Icon(step.icon, size: 30, color: AvColors.accent),
                      ),
                      const SizedBox(height: 18),
                      Text(step.title, style: TextStyle(color: AvColors.fg, fontSize: 22, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      Text(step.body, style: TextStyle(color: AvColors.fgMuted, height: 1.45)),
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < _steps.length; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: i == _page ? 18 : 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: i == _page ? AvColors.accent : AvColors.fgFaint,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton(onPressed: _next, child: Text(_last ? 'Empezar' : 'Siguiente')),
            ),
          ],
        ),
      ),
    );
  }
}
