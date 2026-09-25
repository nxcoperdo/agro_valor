/// Dirección del backend. Se cambia al compilar, sin tocar el código:
///   flutter run --dart-define=API_BASE_URL=https://agrovalor.co
const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://2.25.80.190:3000',
);
