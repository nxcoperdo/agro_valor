/// Dirección del backend. Se cambia al compilar, sin tocar el código:
///   flutter run --dart-define=API_BASE_URL=https://otra-cosa.com
const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://agrovalor.tech',
);
