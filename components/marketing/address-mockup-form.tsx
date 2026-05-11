"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { servicesForAudience } from "@/lib/services";

const RENOVATE_SERVICES = servicesForAudience("renovate");

interface Props {
  className?: string;
  fixedServiceId?: string;
}

export function AddressMockupForm({ className, fixedServiceId }: Props) {
  const router = useRouter();
  const [address, setAddress] = React.useState("");
  const [serviceId, setServiceId] = React.useState(
    fixedServiceId ?? RENOVATE_SERVICES[0]?.id ?? "pool-mockup",
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const activeService =
    RENOVATE_SERVICES.find((s) => s.id === serviceId) ?? RENOVATE_SERVICES[0];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/address-mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim(), serviceId }),
      });
      const body = (await res.json()) as {
        listingId?: string;
        slug?: string;
        existed?: boolean;
        error?: string;
      };
      if (!res.ok || !body.listingId) {
        throw new Error(body.error ?? "Something went wrong");
      }
      if (body.existed && body.slug) {
        router.push(`/l/${body.slug}?service=${serviceId}`);
      } else {
        router.push(`/generating/${body.listingId}?service=${serviceId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`mx-auto flex w-full max-w-2xl flex-col gap-3 ${className ?? ""}`}
    >
      {!fixedServiceId && (
        <div className="flex flex-wrap justify-center gap-2">
          {RENOVATE_SERVICES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setServiceId(s.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                serviceId === s.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-accent"
              }`}
            >
              {s.name}
              <span className="ml-1 text-[9px] uppercase tracking-wider opacity-80">
                free
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="text"
          required
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Your home address (e.g., 123 Main St, Phoenix, AZ 85001)"
          autoComplete="street-address"
          className="h-12 flex-1 text-base"
          disabled={pending}
        />
        <Button type="submit" size="lg" disabled={pending || address.length < 5}>
          {pending ? "Starting…" : (activeService?.ctaPrimary ?? "Render my home")}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
