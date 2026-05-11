import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Home, Camera } from "lucide-react";

export const dynamic = "force-static";

export default function ChooserPage() {
  return (
    <section className="bg-gradient-to-b from-background to-muted/40 py-24">
      <div className="container max-w-4xl text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Realscale
        </div>
        <h1 className="mt-3 text-5xl font-bold tracking-tight sm:text-6xl">
          AI mockups for real estate.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground sm:text-xl">
          Pick your path — we'll show you what your property could be in under 90 seconds.
        </p>

        <div className="mx-auto mt-12 grid max-w-3xl gap-5 md:grid-cols-2">
          <Link href="/agents" className="group">
            <Card className="h-full overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl">
              <CardContent className="space-y-4 p-8 text-left">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Camera className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold">I sell homes.</h2>
                <p className="text-muted-foreground">
                  Stage your MLS photos. Twilight your exteriors. Get the full set back
                  in under 2 hours, NAR-disclosure stamped.
                </p>
                <div className="pt-2 font-semibold text-primary group-hover:underline">
                  Listing photo enhancement →
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/renovate" className="group">
            <Card className="h-full overflow-hidden border-emerald-500/40 transition-all hover:-translate-y-1 hover:shadow-xl">
              <CardContent className="space-y-4 p-8 text-left">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700">
                  <Home className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold">I own a home.</h2>
                <p className="text-muted-foreground">
                  See a pool in your backyard. Solar on your roof. Refreshed curb appeal.
                  Free mockups, contractor connections only when you're ready.
                </p>
                <div className="pt-2 font-semibold text-emerald-700 group-hover:underline">
                  Renovation mockups (free) →
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          Both paths use the same pipeline. Photos are real — no stock samples, no compositing tricks.
        </p>
      </div>
    </section>
  );
}
