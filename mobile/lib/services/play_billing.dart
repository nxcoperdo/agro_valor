import 'dart:async';

import 'package:in_app_purchase/in_app_purchase.dart';

import '../api/api_client.dart';

/// Debe coincidir exactamente con el ID del producto de suscripción creado en Play Console.
const proProductId = 'agrovalor_pro_mensual';

/// Cobro de Pro dentro de la app vía Google Play Billing. La web sigue cobrando por
/// Nequi/Daviplata con activación manual; esto es solo para la app.
class PlayBilling {
  PlayBilling(this.api, {required this.onActivated}) {
    _subscription = InAppPurchase.instance.purchaseStream.listen(_onPurchaseUpdate);
  }

  final ApiClient api;

  /// Se llama después de verificar una compra con el server, para refrescar el plan del usuario.
  final Future<void> Function() onActivated;

  StreamSubscription<List<PurchaseDetails>>? _subscription;

  Future<ProductDetails?> loadProduct() async {
    if (!await InAppPurchase.instance.isAvailable()) return null;

    final response = await InAppPurchase.instance.queryProductDetails({proProductId});
    if (response.productDetails.isEmpty) return null;
    return response.productDetails.first;
  }

  Future<void> buy(ProductDetails product) {
    return InAppPurchase.instance.buyNonConsumable(purchaseParam: PurchaseParam(productDetails: product));
  }

  Future<void> _onPurchaseUpdate(List<PurchaseDetails> purchases) async {
    for (final purchase in purchases) {
      if (purchase.status == PurchaseStatus.purchased || purchase.status == PurchaseStatus.restored) {
        try {
          await api.verifyPlayPurchase(purchase.verificationData.serverVerificationData, purchase.productID);
          await onActivated();
          if (purchase.pendingCompletePurchase) {
            await InAppPurchase.instance.completePurchase(purchase);
          }
        } catch (_) {
          // No se completa: Play la vuelve a entregar en la próxima consulta y se reintenta.
        }
      } else if (purchase.status == PurchaseStatus.error && purchase.pendingCompletePurchase) {
        await InAppPurchase.instance.completePurchase(purchase);
      }
    }
  }

  void dispose() => _subscription?.cancel();
}
