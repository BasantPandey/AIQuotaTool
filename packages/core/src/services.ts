export type ServiceAuth = 'session' | 'oauth' | 'api_key';

/**
 * Catalog of services the product knows about.
 * A new agent is a row here. Chrome also needs a fetcher factory in
 * `packages/chrome-ext/src/background/providers.ts` (the `Record<ChromeServiceId, …>`
 * check fails the build until that factory exists). Host permissions stay
 * an explicit manifest list.
 */
export const SERVICES = [
  {
    id: 'claude',
    label: 'Claude',
    color: '#1a1a2e',
    host: 'claude.ai',
    auth: 'session',
  },
  {
    id: 'copilot',
    label: 'Copilot',
    color: '#2ea44f',
    host: 'github.com',
    auth: 'oauth',
  },
  {
    id: 'codex',
    label: 'Codex',
    color: '#0066ff',
    host: 'chatgpt.com',
    auth: 'session',
  },
  {
    id: 'grok',
    label: 'Grok',
    // Elevated charcoal so the card reads on #0d1117 panels (not pure black).
    color: '#1c1c1e',
    host: 'grok.com',
    auth: 'session',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    color: '#131a33',
    host: 'gemini.google.com',
    auth: 'session',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    color: '#14120b',
    host: 'cursor.com',
    auth: 'session',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    color: '#1b2a6b',
    host: 'platform.deepseek.com',
    auth: 'api_key',
  },
  {
    id: 'kimi',
    label: 'Kimi',
    color: '#0b3d3e',
    host: 'platform.kimi.ai',
    auth: 'api_key',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    color: '#1e2140',
    host: 'openrouter.ai',
    auth: 'api_key',
    vscodeOnly: true,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    color: '#262420',
    host: 'console.anthropic.com',
    auth: 'api_key',
    vscodeOnly: true,
    adminKey: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    color: '#0d0d0d',
    host: 'platform.openai.com',
    auth: 'api_key',
    vscodeOnly: true,
    adminKey: true,
  },
] as const satisfies readonly {
  id: string;
  label: string;
  color: string;
  host: string;
  auth: ServiceAuth;
  /** Not in the Chrome extension. */
  vscodeOnly?: true;
  /** The Key must be an Admin key. It can manage the whole org, so the user confirms it. */
  adminKey?: true;
}[];

type ServiceRow = (typeof SERVICES)[number];

export type ServiceId = ServiceRow['id'];

/** Services that the Chrome extension knows. */
export type ChromeServiceId = Exclude<ServiceRow, { vscodeOnly: true }>['id'];

export const CHROME_SERVICES = SERVICES.filter(
  (service): service is Extract<ServiceRow, { id: ChromeServiceId }> => !('vscodeOnly' in service),
);

export const SERVICE_IDS: readonly ServiceId[] = SERVICES.map((service) => service.id);

export const SERVICE_LABELS = Object.fromEntries(
  SERVICES.map((service) => [service.id, service.label]),
) as Record<ServiceId, string>;

export const SERVICE_COLORS = Object.fromEntries(
  SERVICES.map((service) => [service.id, service.color]),
) as Record<ServiceId, string>;

/** Hostname only, no scheme. Callers prepend `https://` for links. */
export const SERVICE_URLS = Object.fromEntries(
  SERVICES.map((service) => [service.id, service.host]),
) as Record<ServiceId, string>;

export function serviceById(id: ServiceId): (typeof SERVICES)[number] {
  const found = SERVICES.find((service) => service.id === id);
  if (!found) throw new Error(`Unknown service ${id}`);
  return found;
}
