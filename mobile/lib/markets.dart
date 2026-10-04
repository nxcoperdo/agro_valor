/// Mercados disponibles en la app. Espejo ligero de server/config/markets.js: aquí solo van
/// los textos que se muestran; los precios y la proyección los calcula el servidor.
class Market {
  const Market({required this.id, required this.name, required this.emoji, required this.thresholdUnit});

  final String id;
  final String name;
  final String emoji;

  /// Unidad en que se define el umbral de una alerta: "carga" en café, "kilo" en cacao.
  final String thresholdUnit;
}

const kMarkets = [
  Market(id: 'coffee', name: 'Café', emoji: '☕', thresholdUnit: 'carga'),
  Market(id: 'cocoa', name: 'Cacao', emoji: '🍫', thresholdUnit: 'kilo'),
];

const kDefaultMarket = 'coffee';

Market marketById(String? id) => kMarkets.firstWhere((m) => m.id == id, orElse: () => kMarkets.first);
