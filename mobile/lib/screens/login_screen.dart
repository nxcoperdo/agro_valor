import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../session.dart';
import 'legal_screen.dart';
import 'reset_password_screen.dart';

/// Colores del login claro (mismo diseño que la web, css/login.css). El resto de la app es oscura.
class _C {
  static const topDark = Color(0xFF063421);
  static const topLight = Color(0xFF0A4A30);
  static const page = Color(0xFFF6F8F4);
  static const card = Color(0xFFFBFCFA);
  static const title = Color(0xFF0A2F21);
  static const brand = Color(0xFF093D29);
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
  static const divider = Color(0xFFE1E7E2);
  static const errorFg = Color(0xFF9B2C2C);
  static const errorBg = Color(0xFFFDF1F1);
  static const errorBorder = Color(0xFFF1C4C4);
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.session});

  final Session session;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  // Entrada escalonada: arranca mientras la intro se desvanece, así el video y el login quedan entrelazados.
  late final _entrance = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..forward();
  final _form = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();

  bool _signup = false;
  bool _busy = false;
  bool _showPassword = false;
  bool _acceptedTerms = false;
  DateTime? _birthDate;
  String? _error;

  @override
  void dispose() {
    _entrance.dispose();
    for (final c in [_username, _password, _email, _phone]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (_signup && !_acceptedTerms) {
      setState(() => _error = 'Debes aceptar los términos de uso y la política de privacidad');
      return;
    }
    if (_signup && (_birthDate == null || !_isAdult(_birthDate!))) {
      setState(() => _error = _birthDate == null
          ? 'Indica tu fecha de nacimiento'
          : 'Debes tener al menos 18 años para crear una cuenta');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_signup) {
        await widget.session.signup({
          'password': _password.text,
          'email': _email.text.trim(),
          'phone': _phone.text.trim(),
          'birthDate': _birthDate!.toIso8601String().substring(0, 10),
        });
      } else {
        await widget.session.login(_username.text.trim(), _password.text);
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Verificación de edad del registro: AgroValor es solo para mayores de 18 años (también cubre COPPA).
  static bool _isAdult(DateTime birth) {
    final now = DateTime.now();
    var age = now.year - birth.year;
    if (now.month < birth.month || (now.month == birth.month && now.day < birth.day)) age -= 1;
    return age >= 18;
  }

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthDate ?? DateTime(now.year - 30, now.month, now.day),
      firstDate: DateTime(now.year - 100),
      lastDate: now,
      helpText: 'Fecha de nacimiento',
    );
    if (picked != null) setState(() => _birthDate = picked);
  }

  Widget _birthRow() {
    final d = _birthDate;
    final label = d == null
        ? 'Fecha de nacimiento (debes ser mayor de 18 años)'
        : '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 4),
      child: OutlinedButton.icon(
        onPressed: _busy ? null : _pickBirthDate,
        icon: const Icon(Icons.cake_outlined, size: 20),
        label: Align(alignment: Alignment.centerLeft, child: Text(label, style: const TextStyle(fontSize: 14))),
        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52), foregroundColor: _C.focus),
      ),
    );
  }

  void _toggleMode() => setState(() {
    _signup = !_signup;
    _error = null;
    _acceptedTerms = false;
    _birthDate = null;
  });

  @override
  Widget build(BuildContext context) {
    final text = ThemeData().textTheme.apply(fontFamily: 'Inter');
    return AnnotatedRegion<SystemUiOverlayStyle>(
      // Íconos claros sobre la franja verde de arriba.
      value: SystemUiOverlayStyle.light,
      child: Theme(
        data: Theme.of(context).copyWith(
          textTheme: text,
          textSelectionTheme: const TextSelectionThemeData(cursorColor: _C.focus),
        ),
        child: Scaffold(
          backgroundColor: _C.page,
          body: Stack(
            children: [
              // Franja verde que ocupa ~29% de la pantalla, como en la versión móvil de la web.
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: SlideTransition(
                  position: Tween(begin: const Offset(0, -1), end: Offset.zero).animate(
                    CurvedAnimation(
                      parent: _entrance,
                      curve: const Interval(0, 0.45, curve: Curves.easeOutCubic),
                    ),
                  ),
                  child: const _TopBand(),
                ),
              ),
              SafeArea(
                child: Align(
                  alignment: Alignment.topCenter,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 28),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 440),
                      child: _Reveal(animation: _entrance, start: 0.15, distance: 0.06, child: _card()),
                    ),
                  ),
                ),
              ),
            ],
          ),
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
      child: AutofillGroup(
        child: Form(
          key: _form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _reveal(
                0,
                Row(
                  children: [
                    Image.asset('assets/branding/logo.png', width: 46, height: 46),
                    const SizedBox(width: 10),
                    const Text(
                      'AgroValor',
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.9, color: _C.brand),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 30),
              _reveal(
                1,
                Text(
                  (_signup ? 'Empieza gratis' : 'Bienvenido de nuevo').toUpperCase(),
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 2,
                    color: _C.eyebrow,
                  ),
                ),
              ),
              const SizedBox(height: 14),
              _reveal(
                2,
                Text(
                  _signup ? 'Crea tu cuenta' : 'Inicia sesión',
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -1.4,
                    height: 1.1,
                    color: _C.title,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              _reveal(
                3,
                Text(
                  _signup
                      ? 'Consulta el precio de tu café por carga, todos los días.'
                      : 'Ingresa tus datos para acceder a tu cuenta.',
                  style: const TextStyle(fontSize: 15, color: _C.muted, height: 1.4),
                ),
              ),
              const SizedBox(height: 28),
              // Al registrarse se pide primero el correo (que además funciona como
              // usuario) y su WhatsApp, y la contraseña de último. Al iniciar sesión
              // sigue siendo Correo y luego Contraseña.
              if (_signup) ...[
                _reveal(
                  4,
                  _Field(
                    label: 'Correo',
                    controller: _email,
                    icon: Icons.mail_outline_rounded,
                    hint: 'tu@correo.com',
                    keyboard: TextInputType.emailAddress,
                    autofill: const [AutofillHints.email],
                    validator: (v) {
                      final value = v?.trim() ?? '';
                      if (value.isEmpty) return 'Escribe tu correo';
                      if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value)) return 'Escribe un correo válido';
                      return null;
                    },
                  ),
                ),
                const SizedBox(height: 20),
                _reveal(
                  5,
                  _Field(
                    label: 'Celular (WhatsApp)',
                    controller: _phone,
                    icon: Icons.phone_iphone_rounded,
                    hint: '300 123 4567',
                    keyboard: TextInputType.phone,
                    autofill: const [AutofillHints.telephoneNumber],
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Escribe tu WhatsApp' : null,
                  ),
                ),
                const SizedBox(height: 20),
              ] else ...[
                _reveal(
                  4,
                  _Field(
                    label: 'Correo',
                    controller: _username,
                    icon: Icons.mail_outline_rounded,
                    hint: 'tu@correo.com',
                    keyboard: TextInputType.emailAddress,
                    autofill: const [AutofillHints.username],
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Escribe tu correo' : null,
                  ),
                ),
                const SizedBox(height: 20),
              ],
              _reveal(
                6,
                _Field(
                  label: 'Contraseña',
                  controller: _password,
                  icon: Icons.lock_outline_rounded,
                  hint: _signup ? 'Mínimo 8 caracteres' : 'Tu contraseña',
                  obscure: !_showPassword,
                  autofill: [_signup ? AutofillHints.newPassword : AutofillHints.password],
                  action: TextInputAction.done,
                  onSubmitted: (_) => _submit(),
                  trailing: IconButton(
                    onPressed: () => setState(() => _showPassword = !_showPassword),
                    tooltip: _showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña',
                    icon: Icon(
                      _showPassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                      size: 20,
                      color: const Color(0xFF6E8176),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Escribe tu contraseña';
                    if (_signup && v.length < 8) return 'Mínimo 8 caracteres';
                    return null;
                  },
                ),
              ),
              if (_signup) _birthRow(),
              if (_signup) _termsRow(),
              if (!_signup)
                AnimatedSize(
                  duration: const Duration(milliseconds: 250),
                  curve: Curves.easeOutCubic,
                  alignment: Alignment.topCenter,
                  child: _forgotRow(),
                ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                _Notice(text: _error!, fg: _C.errorFg, bg: _C.errorBg, border: _C.errorBorder),
              ],
              const SizedBox(height: 22),
              _reveal(
                6,
                _SubmitButton(
                  label: _signup ? 'Crear mi cuenta' : 'Entrar a mi cuenta',
                  busy: _busy,
                  onPressed: _submit,
                ),
              ),
              const SizedBox(height: 28),
              const Divider(height: 1, color: _C.divider),
              const SizedBox(height: 22),
              _reveal(
                7,
                Wrap(
                  alignment: WrapAlignment.center,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      _signup ? '¿Ya tienes una cuenta? ' : '¿Aún no tienes una cuenta? ',
                      style: const TextStyle(fontSize: 13, color: Color(0xFF66736B)),
                    ),
                    _Link(label: _signup ? 'Inicia sesión' : 'Crear cuenta', onTap: _busy ? null : _toggleMode),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Cada bloque de la tarjeta entra un poco después del anterior.
  Widget _reveal(int index, Widget child) =>
      _Reveal(animation: _entrance, start: 0.3 + index * 0.06, distance: 0.35, child: child);

  Widget _forgotRow() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerRight,
          child: _Link(
            label: '¿Olvidaste tu contraseña?',
            size: 12,
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => ResetPasswordScreen(session: widget.session)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _termsRow() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Checkbox(
          value: _acceptedTerms,
          onChanged: (v) => setState(() => _acceptedTerms = v ?? false),
          activeColor: _C.focus,
          visualDensity: VisualDensity.compact,
          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        const SizedBox(width: 4),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 13),
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const Text('Acepto los ', style: TextStyle(fontSize: 13, color: Color(0xFF66736B))),
                _Link(
                  label: 'términos de uso',
                  size: 13,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => LegalScreen(title: 'Términos de uso', load: widget.session.api.termsOfService),
                    ),
                  ),
                ),
                const Text(' y la ', style: TextStyle(fontSize: 13, color: Color(0xFF66736B))),
                _Link(
                  label: 'política de privacidad',
                  size: 13,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => LegalScreen(title: 'Política de privacidad', load: widget.session.api.privacyPolicy),
                    ),
                  ),
                ),
                const Text('.', style: TextStyle(fontSize: 13, color: Color(0xFF66736B))),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _TopBand extends StatelessWidget {
  const _TopBand();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.sizeOf(context).height * 0.29,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_C.topDark, _C.topLight],
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.controller,
    required this.icon,
    required this.hint,
    this.obscure = false,
    this.trailing,
    this.validator,
    this.keyboard,
    this.action = TextInputAction.next,
    this.onSubmitted,
    this.autofill,
  });

  final String label;
  final TextEditingController controller;
  final IconData icon;
  final String hint;
  final bool obscure;
  final Widget? trailing;
  final FormFieldValidator<String>? validator;
  final TextInputType? keyboard;
  final TextInputAction action;
  final ValueChanged<String>? onSubmitted;
  final Iterable<String>? autofill;

  OutlineInputBorder _border(Color color, [double width = 1]) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(14),
    borderSide: BorderSide(color: color, width: width),
  );

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: _C.label),
        ),
        const SizedBox(height: 9),
        TextFormField(
          controller: controller,
          obscureText: obscure,
          autocorrect: false,
          enableSuggestions: !obscure,
          keyboardType: keyboard,
          textInputAction: action,
          onFieldSubmitted: onSubmitted,
          autofillHints: autofill,
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
            enabledBorder: _border(_C.border),
            focusedBorder: _border(_C.focus, 1.5),
            errorBorder: _border(_C.errorFg),
            focusedErrorBorder: _border(_C.errorFg, 1.5),
            errorStyle: const TextStyle(color: _C.errorFg),
          ),
        ),
      ],
    );
  }
}

class _SubmitButton extends StatelessWidget {
  const _SubmitButton({required this.label, required this.busy, required this.onPressed});

  final String label;
  final bool busy;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        boxShadow: const [BoxShadow(color: Color(0x33B98608), blurRadius: 26, offset: Offset(0, 12))],
      ),
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(58),
          backgroundColor: _C.gold,
          foregroundColor: _C.onGold,
          disabledBackgroundColor: _C.gold.withValues(alpha: 0.75),
          disabledForegroundColor: _C.onGold,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w800),
        ),
        child: busy
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.4, color: _C.onGold),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [Text(label), const SizedBox(width: 10), const Icon(Icons.arrow_forward_rounded, size: 20)],
              ),
      ),
    );
  }
}

class _Link extends StatelessWidget {
  const _Link({required this.label, required this.onTap, this.size = 13});

  final String label;
  final VoidCallback? onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
        child: Text(
          label,
          style: TextStyle(fontSize: size, fontWeight: FontWeight.w700, color: _C.link),
        ),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text, required this.fg, required this.bg, required this.border});

  final String text;
  final Color fg;
  final Color bg;
  final Color border;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Text(text, style: TextStyle(fontSize: 13, height: 1.5, color: fg)),
    );
  }
}

/// Aparece subiendo levemente, en el tramo [start, start + 0.4] de la animación de entrada.
class _Reveal extends StatelessWidget {
  const _Reveal({required this.animation, required this.start, required this.distance, required this.child});

  final Animation<double> animation;
  final double start;

  /// Cuánto sube, en proporción al alto del propio bloque.
  final double distance;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: Interval(start.clamp(0.0, 1.0), (start + 0.4).clamp(0.0, 1.0), curve: Curves.easeOutCubic),
    );
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween(begin: Offset(0, distance), end: Offset.zero).animate(curved),
        child: child,
      ),
    );
  }
}
