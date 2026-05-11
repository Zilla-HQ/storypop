/**
 * Buy-now-pay-later payment method config for Stripe Checkout.
 *
 * Klarna, Afterpay/Clearpay, and Affirm all convert measurably better
 * on SMB-targeted SaaS + DFY products. SiteGrid's split-test showed
 * a +6% checkout-completion lift when BNPL was added to a $199 SKU.
 *
 * Constraints:
 *   - Klarna: USD or EUR amounts; min $10 / max $4,000 USD.
 *   - Afterpay: USD-only; min $1 / max $2,000 USD.
 *   - Affirm: USD-only; min $50 / max $30,000 USD.
 *
 * Stripe enables BNPL on the account; you don't need to "install" it
 * per merchant beyond toggling on the option in the Stripe dashboard.
 * After that, `payment_method_types` carries the activation per session.
 */

export type PaymentMethodType =
  | "card"
  | "klarna"
  | "afterpay_clearpay"
  | "affirm"
  | "cashapp"
  | "link";

/**
 * Choose the right BNPL set based on price + currency.
 *
 * Pass amountCents in cents and currency as the ISO code (lowercase).
 * Returns the list of methods to pass into `stripe.checkout.sessions
 * .create({ payment_method_types })`. Always includes 'card'; BNPL is
 * additive.
 */
export function bnplMethodsFor(args: {
  amountCents: number;
  currency: string; // 'usd', 'eur', etc.
}): PaymentMethodType[] {
  const out: PaymentMethodType[] = ["card", "link"];
  const usd = args.currency.toLowerCase() === "usd";
  const eur = args.currency.toLowerCase() === "eur";

  if (usd) {
    if (args.amountCents >= 1_000 && args.amountCents <= 400_000) out.push("klarna");
    if (args.amountCents >= 100 && args.amountCents <= 200_000) out.push("afterpay_clearpay");
    if (args.amountCents >= 5_000 && args.amountCents <= 3_000_000) out.push("affirm");
    out.push("cashapp");
  }
  if (eur && args.amountCents >= 1_000 && args.amountCents <= 400_000) {
    out.push("klarna");
  }
  return out;
}

/**
 * Disable BNPL entirely for a given session — e.g. for refundable
 * pre-orders where Klarna's refund handling is painful, or for
 * recurring subscriptions where Afterpay isn't supported.
 */
export const CARD_ONLY: PaymentMethodType[] = ["card", "link"];
