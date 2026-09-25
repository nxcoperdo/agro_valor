import 'package:flutter/material.dart';

import '../session.dart';
import '../theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.session});

  final Session session;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _fullName = TextEditingController();
  final _phone = TextEditingController();
  final _municipality = TextEditingController();

  bool _signup = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_username, _password, _fullName, _phone, _municipality]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_signup) {
        await widget.session.signup({
          'username': _username.text.trim(),
          'password': _password.text,
          'fullName': _fullName.text.trim(),
          'phone': _phone.text.trim(),
          'municipality': _municipality.text.trim(),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Icon(Icons.coffee_rounded, size: 56, color: AvColors.accent),
                    const SizedBox(height: 12),
                    const Text(
                      'AgroValor',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: AvColors.fg),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'El precio de tu café, por carga, todos los días.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AvColors.fgMuted),
                    ),
                    const SizedBox(height: 32),
                    TextFormField(
                      controller: _username,
                      decoration: const InputDecoration(labelText: 'Usuario'),
                      autocorrect: false,
                      textInputAction: TextInputAction.next,
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Escribe tu usuario' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _password,
                      decoration: const InputDecoration(labelText: 'Contraseña'),
                      obscureText: true,
                      textInputAction: _signup ? TextInputAction.next : TextInputAction.done,
                      onFieldSubmitted: (_) => _signup ? null : _submit(),
                      validator: (v) {
                        if (v == null || v.isEmpty) return 'Escribe tu contraseña';
                        if (_signup && v.length < 8) return 'Mínimo 8 caracteres';
                        return null;
                      },
                    ),
                    AnimatedSize(
                      duration: const Duration(milliseconds: 250),
                      curve: Curves.easeOutCubic,
                      child: _signup
                          ? Column(
                              children: [
                                const SizedBox(height: 12),
                                TextFormField(
                                  controller: _fullName,
                                  decoration: const InputDecoration(labelText: 'Nombre completo'),
                                  textCapitalization: TextCapitalization.words,
                                ),
                                const SizedBox(height: 12),
                                TextFormField(
                                  controller: _phone,
                                  decoration: const InputDecoration(
                                    labelText: 'Celular (WhatsApp)',
                                    helperText: 'Para las alertas de precio',
                                  ),
                                  keyboardType: TextInputType.phone,
                                ),
                                const SizedBox(height: 12),
                                TextFormField(
                                  controller: _municipality,
                                  decoration: const InputDecoration(labelText: 'Municipio'),
                                  textCapitalization: TextCapitalization.words,
                                ),
                              ],
                            )
                          : const SizedBox(width: double.infinity),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 16),
                      Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: AvColors.danger)),
                    ],
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                          : Text(_signup ? 'Crear cuenta' : 'Entrar'),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: _busy ? null : () => setState(() {
                        _signup = !_signup;
                        _error = null;
                      }),
                      child: Text(_signup ? 'Ya tengo cuenta' : 'Crear una cuenta gratis'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
