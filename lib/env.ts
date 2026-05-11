/**
 * Read an env var and strip surrounding whitespace. Defensive against
 * values pasted with trailing newlines from CLI add commands.
 */
export function env(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  if (v == null) return fallback;
  return v.trim() || fallback;
}

export function requireEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`Env var ${name} is required`);
  return v;
}
