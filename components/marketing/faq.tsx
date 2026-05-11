import { Card, CardContent } from "@/components/ui/card";
import type { Audience } from "@/lib/services";

const AUDIENCE_A_ITEMS = [
  { q: "[Audience A FAQ Q1]", a: "[Answer.]" },
  { q: "[Audience A FAQ Q2]", a: "[Answer.]" },
  { q: "[Audience A FAQ Q3]", a: "[Answer.]" },
  { q: "[Audience A FAQ Q4]", a: "[Answer.]" },
  { q: "[Audience A FAQ Q5]", a: "[Answer.]" },
];

const AUDIENCE_B_ITEMS = [
  { q: "[Audience B FAQ Q1 — usually about pricing / monetization model]", a: "[Answer.]" },
  { q: "[Audience B FAQ Q2 — about partners / referrals]", a: "[Answer.]" },
  { q: "[Audience B FAQ Q3 — about data privacy]", a: "[Answer.]" },
  { q: "[Audience B FAQ Q4]", a: "[Answer.]" },
  { q: "[Audience B FAQ Q5]", a: "[Answer.]" },
];

const PREVIEW_ITEMS = [...AUDIENCE_A_ITEMS.slice(0, 3), ...AUDIENCE_B_ITEMS.slice(0, 3)];

const ITEMS_BY_AUDIENCE: Record<Audience | "preview", typeof AUDIENCE_A_ITEMS> = {
  "audience-a": AUDIENCE_A_ITEMS,
  "audience-b": AUDIENCE_B_ITEMS,
  both: AUDIENCE_A_ITEMS,
  preview: PREVIEW_ITEMS,
  // Vertical-specific audiences mirrored from Relist (see lib/services.ts).
  // No template-level copy lives here — each forked merchant should swap in
  // their own questions. Falls back to AUDIENCE_A copy until then.
  agents: AUDIENCE_A_ITEMS,
  renovate: AUDIENCE_B_ITEMS,
};

interface Props {
  audience?: Audience | "preview";
}

export function FAQ({ audience = "audience-a" }: Props) {
  const items = ITEMS_BY_AUDIENCE[audience] ?? AUDIENCE_A_ITEMS;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <Card key={item.q}>
          <CardContent className="space-y-2 p-6">
            <h3 className="font-semibold">{item.q}</h3>
            <p className="text-sm text-muted-foreground">{item.a}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
