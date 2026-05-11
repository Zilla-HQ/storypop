import Stripe from "stripe";
import { env } from "@/lib/env";

const key = env("STRIPE_SECRET_KEY");
if (!key) {
  // eslint-disable-next-line no-console
  console.warn("STRIPE_SECRET_KEY is not set — Stripe calls will fail at runtime.");
}

export const stripe = new Stripe(key ?? "sk_test_unset", {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

export function publicAppUrl(): string {
  return env("NEXT_PUBLIC_APP_URL", "http://localhost:3000")!;
}
