import { ServicesGrid } from "@/components/marketing/services-grid";

export const metadata = { title: "Services — Realscale" };

export default function ServicesIndexPage() {
  return (
    <div className="container max-w-6xl py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">Services</h1>
        <p className="mt-3 text-muted-foreground">
          Every Realscale service is automated end-to-end: scrape, generate, deliver.
          Pick a service to see how it works and what it costs.
        </p>
      </div>
      <div className="mt-12">
        <ServicesGrid />
      </div>
    </div>
  );
}
