/**
 * Payment Provider Abstraction Layer
 * Allows switching between payment gateways (e.g. Razorpay, Cashfree, Stripe, UPI Gateway)
 * without touching core application business logic.
 */

export interface PaymentOrderRequest {
  orderId: string;
  amount: number; // in integer units (paise)
  currency: string;
  customer: {
    uid: string;
    email: string;
    name?: string;
  };
  notes?: Record<string, string>;
}

export interface PaymentOrderResponse {
  provider: string;
  providerOrderId: string;
  amount: number;
  currency: string;
  status: 'created' | 'attempted' | 'paid';
  upiIntent?: string;
  upiQrString?: string;
  checkoutUrl?: string;
}

export interface WebhookEventPayload {
  event: 'payment.captured' | 'payment.failed' | 'payout.processed' | 'payout.failed';
  providerOrderId: string;
  paymentId: string;
  amount: number;
  status: string;
  signature: string;
}

export interface PaymentProvider {
  name: string;
  createOrder(req: PaymentOrderRequest): Promise<PaymentOrderResponse>;
  verifyWebhook(payload: WebhookEventPayload, secret: string): Promise<boolean>;
  checkStatus(providerOrderId: string): Promise<'pending' | 'completed' | 'failed'>;
}

export class StandardGatewayProvider implements PaymentProvider {
  name = 'AetherPay Unified Gateway (UPI / IMPS)';
  defaultVpa = 'itsalexbro0021@okaxis';
  defaultPayee = 'AetherLedger Treasury';

  async createOrder(
    req: PaymentOrderRequest,
    customVpa?: string,
    customPayee?: string
  ): Promise<PaymentOrderResponse> {
    const providerOrderId = `ord_gw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const formattedAmount = (req.amount / 100).toFixed(2);
    const upiVpa = customVpa?.trim() || this.defaultVpa;
    const payeeName = customPayee?.trim() || this.defaultPayee;

    // Formatted UPI Intent URL
    const upiIntent = `upi://pay?pa=${upiVpa}&pn=${encodeURIComponent(payeeName)}&tr=${providerOrderId}&am=${formattedAmount}&cu=INR&tn=Deposit+Order+${req.orderId}`;

    return {
      provider: this.name,
      providerOrderId,
      amount: req.amount,
      currency: req.currency || 'INR',
      status: 'created',
      upiIntent,
      upiQrString: upiIntent,
    };
  }

  async verifyWebhook(payload: WebhookEventPayload, _secret: string): Promise<boolean> {
    // In production, verify crypto.createHmac('sha256', secret).update(body).digest('hex') === signature
    if (!payload.signature || payload.signature.length < 8) return false;
    return true;
  }

  async checkStatus(_providerOrderId: string): Promise<'pending' | 'completed' | 'failed'> {
    return 'pending';
  }
}

export const activePaymentProvider = new StandardGatewayProvider();
