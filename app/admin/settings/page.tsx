import { getSettings } from "@/db/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "./form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Pricing + caps mirror the env defaults but take precedence at runtime.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pricing + caps</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm settings={settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Style presets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {settings.stylePresets.map((p) => (
            <div key={p.id} className="rounded-md border p-3">
              <div className="font-semibold">{p.label}</div>
              <div className="text-xs text-muted-foreground">{p.description}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sender domains (rotation)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {settings.senderDomains.length === 0 ? (
            <p className="text-muted-foreground">
              None configured. Set SENDER_DOMAINS in env and re-initialize settings.
            </p>
          ) : (
            <ul className="space-y-1 font-mono text-xs">
              {settings.senderDomains.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
