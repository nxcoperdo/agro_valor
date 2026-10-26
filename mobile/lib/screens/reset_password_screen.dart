import 'package:flutter/material.dart';

import '../session.dart';

/// Mismos colores del login claro (login_screen.dart es privado a su archivo, así que
/// se repite aquí el subconjunto que hace falta para que se vea igual).
class _C {
  static const topDark = Color(0xFF063421);
  static const topLight = Color(0xFF0A4A30);
  static const page = Color(0xFFF6F8F4);
  static const card = Color(0xFFFBFCFA);
  static const title = Color(0xFF0A2F21);
  static const eyebrow = Color(0xFFBB8B1D);
  static const label = Color(0xFF293C31);
  static const muted = Color(0xFF738078);
  static const hint = Color(0xFF9BA8A0);
  static const icon = Color(0xFF789083);
  static const border = Color(0xFFDCE4DE);
  static const focus = Color(0xFF1B704C);
  static const link = Color(0xFF0C6543);
  static const gold = Color(0xFFEDB72A);
  static const onGold = Color(0xFF142818);
  static const errorFg = Color(0xFF9B2C2C);
  static const errorBg = Color(0xFFFDF1F1);
  static const errorBorder = Color(0xFFF1C4C4);
  static const noteFg = Color(0xFF185C3E);
  static const noteBg = Color(0xFFEFF8F2);
  static const noteBorder = Color(0xFFBFDDC9);
}

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, required this.session});

  final Session session;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

enum _Step { request, confirm, done }

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _code = TextEditingController();
  final _newPassword = TextEditingController();

  _Step _step = _Step.request;
  bool _busy = false;
  bool _showPassword = false;
  String? _error;
  String? _note;

  @override
  void dispose() {
    _username.dispose();
    _code.dispose();
    _newPassword.dispose();
    super.dispose();
  }

  Future<void> _submitRequest() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
      _note = null;
    });
    try {
      final result = await widget.session.api.requestPasswordReset(_username.text.trim());
      if (result['sent'] == true) {
        setState(() => _step = _Step.confirm);
      } else if (result['reason'] == 'no_phone') {
        setState(
          () => _note =
              'No tienes un WhatsApp registrado para recibir el código. Escríbele al equipo de AgroValor con tu '
              'correo y te ayudamos a mano.',
        );
      } else {
        setState(() => _error = 'Ese correo no existe.');
      }
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submitConfirm() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.session.api.confirmPasswordReset(
        _username.text.trim(),
        _code.text.trim(),
        _newPassword.text,
      );
      setState(() => _step = _Step.done);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(textTheme: ThemeData().textTheme.apply(fontFamily: 'Inter')),
      child: Scaffold(
        backgroundColor: _C.page,
        body: Stack(
          children: [
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Container(
                height: MediaQuery.sizeOf(context).height * 0.24,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [_C.topDark, _C.topLight],
                  ),
                ),
              ),
            ),
            SafeArea(
              child: Column(
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                    ),
                  ),
                  Expanded(
                    child: Align(
                      alignment: Alignment.topCenter,
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 440),
                          child: _card(),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _card() {
    return Container(
      padding: const EdgeInsets.fromLTRB(22, 24, 22, 26),
      decoration: BoxDecoration(
        color: _C.card,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: const Color(0x120F3D28)),
        boxShadow: const [BoxShadow(color: Color(0x2E032618), blurRadius: 60, offset: Offset(0, 22))],
      ),
      child: switch (_step) {
        _Step.request => _requestForm(),
        _Step.confirm => _confirmForm(),
        _Step.done => _doneMessage(),
      },
    );
  }

  Widget _requestForm() {
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'RECUPERA TU CUENTA',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 2, color: _C.eyebrow),
          ),
          const SizedBox(height: 14),
          const Text(
            '¿Olvidaste tu contraseña?',
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, letterSpacing: -1, height: 1.1, color: _C.title),
          ),
          const SizedBox(height: 10),
          const Text(
            'Escribe tu correo y te mandamos un código por WhatsApp.',
            style: TextStyle(fontSize: 15, color: _C.muted, height: 1.4),
          ),
          const SizedBox(height: 24),
          _field(
            label: 'Correo',
            controller: _username,
            icon: Icons.mail_outline_rounded,
            hint: 'tu@correo.com',
            keyboard: TextInputType.emailAddress,
            action: TextInputAction.done,
            onSubmitted: (_) => _submitRequest(),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Escribe tu correo' : null,
          ),
          if (_note != null) ...[
            const SizedBox(height: 16),
            _notice(_note!, fg: _C.noteFg, bg: _C.noteBg, border: _C.noteBorder),
          ],
          if (_error != null) ...[
            const SizedBox(height: 16),
            _notice(_error!, fg: _C.errorFg, bg: _C.errorBg, border: _C.errorBorder),
          ],
          const SizedBox(height: 22),
          _submitButton('Enviar código', _submitRequest),
        ],
      ),
    );
  }

  Widget _confirmForm() {
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'REVISA TU WHATSAPP',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 2, color: _C.eyebrow),
          ),
          const SizedBox(height: 14),
          const Text(
            'Escribe el código',
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, letterSpacing: -1, height: 1.1, color: _C.title),
          ),
          const SizedBox(height: 10),
          const Text(
            'Te llegó un código de 6 dígitos. Vence en 15 minutos.',
            style: TextStyle(fontSize: 15, color: _C.muted, height: 1.4),
          ),
          const SizedBox(height: 24),
          _field(
            label: 'Código',
            controller: _code,
            icon: Icons.pin_outlined,
            hint: '123456',
            keyboard: TextInputType.number,
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Escribe el código' : null,
          ),
          const SizedBox(height: 20),
          _field(
            label: 'Nueva contraseña',
            controller: _newPassword,
            icon: Icons.lock_outline_rounded,
            hint: 'Mínimo 8 caracteres',
            obscure: !_showPassword,
            action: TextInputAction.done,
            onSubmitted: (_) => _submitConfirm(),
            trailing: IconButton(
              onPressed: () => setState(() => _showPassword = !_showPassword),
              tooltip: _showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña',
              icon: Icon(
                _showPassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                size: 20,
                color: const Color(0xFF6E8176),
              ),
            ),
            validator: (v) => (v == null || v.length < 8) ? 'Mínimo 8 caracteres' : null,
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            _notice(_error!, fg: _C.errorFg, bg: _C.errorBg, border: _C.errorBorder),
          ],
          const SizedBox(height: 22),
          _submitButton('Cambiar contraseña', _submitConfirm),
          const SizedBox(height: 16),
          Center(
            child: TextButton(
              onPressed: _busy ? null : () => setState(() => _step = _Step.request),
              child: const Text('Pedir otro código', style: TextStyle(color: _C.link, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _doneMessage() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'LISTO',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 2, color: _C.eyebrow),
        ),
        const SizedBox(height: 14),
        const Text(
          'Tu contraseña se cambió',
          style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, letterSpacing: -1, height: 1.1, color: _C.title),
        ),
        const SizedBox(height: 10),
        const Text(
          'Ya puedes iniciar sesión con tu nueva contraseña.',
          style: TextStyle(fontSize: 15, color: _C.muted, height: 1.4),
        ),
        const SizedBox(height: 22),
        _submitButton('Ir a iniciar sesión', () => Navigator.of(context).pop()),
      ],
    );
  }

  Widget _field({
    required String label,
    required TextEditingController controller,
    required IconData icon,
    required String hint,
    bool obscure = false,
    Widget? trailing,
    FormFieldValidator<String>? validator,
    TextInputType? keyboard,
    TextInputAction action = TextInputAction.next,
    ValueChanged<String>? onSubmitted,
  }) {
    OutlineInputBorder border(Color color, [double width = 1]) =>
        OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: color, width: width));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: _C.label)),
        const SizedBox(height: 9),
        TextFormField(
          controller: controller,
          obscureText: obscure,
          autocorrect: false,
          enableSuggestions: !obscure,
          keyboardType: keyboard,
          textInputAction: action,
          onFieldSubmitted: onSubmitted,
          validator: validator,
          style: const TextStyle(fontSize: 16, color: Color(0xFF12291D)),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: _C.hint),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(vertical: 17),
            prefixIcon: Padding(
              padding: const EdgeInsets.only(left: 16, right: 10),
              child: Icon(icon, size: 21, color: _C.icon),
            ),
            prefixIconConstraints: const BoxConstraints(minWidth: 47),
            suffixIcon: trailing,
            enabledBorder: border(_C.border),
            focusedBorder: border(_C.focus, 1.5),
            errorBorder: border(_C.errorFg),
            focusedErrorBorder: border(_C.errorFg, 1.5),
            errorStyle: const TextStyle(color: _C.errorFg),
          ),
        ),
      ],
    );
  }

  Widget _notice(String text, {required Color fg, required Color bg, required Color border}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12), border: Border.all(color: border)),
      child: Text(text, style: TextStyle(fontSize: 13, height: 1.5, color: fg)),
    );
  }

  Widget _submitButton(String label, VoidCallback onPressed) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        boxShadow: const [BoxShadow(color: Color(0x33B98608), blurRadius: 26, offset: Offset(0, 12))],
      ),
      child: FilledButton(
        onPressed: _busy ? null : onPressed,
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(58),
          backgroundColor: _C.gold,
          foregroundColor: _C.onGold,
          disabledBackgroundColor: _C.gold.withValues(alpha: 0.75),
          disabledForegroundColor: _C.onGold,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w800),
        ),
        child: _busy
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.4, color: _C.onGold),
              )
            : Text(label),
      ),
    );
  }
}
