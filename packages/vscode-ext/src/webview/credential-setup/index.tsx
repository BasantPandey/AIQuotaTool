import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

declare const acquireVsCodeApi: () => { postMessage(msg: unknown): void };
const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

type ServiceTab = 'claude' | 'codex' | 'github';
type StatusKind = 'idle' | 'testing' | 'ok' | 'error';

interface CredStatus {
  status: StatusKind;
  detail: string | undefined;
}

const TAB_LABELS: Record<ServiceTab, string> = {
  claude: 'Claude',
  codex: 'Codex / ChatGPT',
  github: 'GitHub Copilot',
};

const TABS = Object.keys(TAB_LABELS) as ServiceTab[];

function tabIcon(s: CredStatus): string {
  if (s.status === 'ok') return '✓';
  if (s.status === 'error') return '✗';
  return '○';
}

function StatusBadge({ s }: { s: CredStatus }) {
  const color =
    s.status === 'ok'
      ? 'var(--vscode-charts-green, #4ec9b0)'
      : s.status === 'error'
        ? 'var(--vscode-errorForeground, #f48771)'
        : 'var(--vscode-descriptionForeground, #8b949e)';
  const icon = s.status === 'ok' ? '✓' : s.status === 'error' ? '✗' : s.status === 'testing' ? '…' : '○';
  const label =
    s.detail ??
    (s.status === 'idle' ? 'Not configured (optional)' : s.status === 'testing' ? 'Testing…' : '');
  return (
    <span style={{ color, fontSize: 13 }}>
      {icon} {label}
    </span>
  );
}

function CredentialSetup() {
  const [activeTab, setActiveTab] = useState<ServiceTab>('claude');
  const [claudeKey, setClaudeKey] = useState('');
  const [codexToken, setCodexToken] = useState('');
  const [claudeStatus, setClaudeStatus] = useState<CredStatus>({ status: 'idle', detail: undefined });
  const [codexStatus, setCodexStatus] = useState<CredStatus>({ status: 'idle', detail: undefined });
  const [githubStatus, setGithubStatus] = useState<CredStatus>({ status: 'idle', detail: undefined });

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data as { type?: string; service?: string; status?: string; detail?: string };
      if (msg.type === 'credential_status' && msg.service && msg.status) {
        const update: CredStatus = { status: msg.status as StatusKind, detail: msg.detail || undefined };
        if (msg.service === 'claude') setClaudeStatus(update);
        else if (msg.service === 'codex') setCodexStatus(update);
        else if (msg.service === 'github') setGithubStatus(update);
      }
    };
    window.addEventListener('message', handler);
    vscode?.postMessage({ type: 'credential_setup_ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  const statusOf: Record<ServiceTab, CredStatus> = {
    claude: claudeStatus,
    codex: codexStatus,
    github: githubStatus,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border, #3c3c3c)',
    borderRadius: 3,
    padding: '5px 8px',
    fontSize: 13,
    marginTop: 8,
    outline: 'none',
    fontFamily: 'var(--vscode-editor-font-family)',
  };

  const btnStyle: React.CSSProperties = {
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: 3,
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: 13,
  };

  const secondaryBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)',
  };

  return (
    <div style={{ padding: 24, fontFamily: 'var(--vscode-font-family)', color: 'var(--vscode-foreground)', maxWidth: 520 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>AI Quota Tool — Account Setup</h2>
      <p style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginBottom: 20 }}>
        Each service is <strong>optional</strong> — set up only what you use. Quota appears as soon as one account is connected.
      </p>

      {/* Tab bar — shows ✓/○/✗ status on each tab */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--vscode-panel-border, #3c3c3c)', marginBottom: 24, gap: 0 }}>
        {TABS.map((tab) => {
          const active = activeTab === tab;
          const s = statusOf[tab];
          const iconColor =
            s.status === 'ok'
              ? 'var(--vscode-charts-green, #4ec9b0)'
              : s.status === 'error'
                ? 'var(--vscode-errorForeground, #f48771)'
                : 'var(--vscode-descriptionForeground, #8b949e)';
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'transparent',
                color: active ? 'var(--vscode-foreground)' : 'var(--vscode-tab-inactiveForeground, #8b949e)',
                border: 'none',
                borderBottom: active ? '2px solid var(--vscode-focusBorder, #0078d4)' : '2px solid transparent',
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: 13,
                marginBottom: -1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ color: iconColor, fontSize: 11 }}>{tabIcon(s)}</span>
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      {/* Claude tab */}
      {activeTab === 'claude' && (
        <div>
          <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
            Authenticate with your <strong>Anthropic API key</strong>. Create one at{' '}
            <strong>console.anthropic.com</strong> under API Keys.
          </p>
          <ol style={{ paddingLeft: 18, fontSize: 13, lineHeight: 2.2 }}>
            <li>Go to <strong>console.anthropic.com</strong> and sign in</li>
            <li>Open <strong>Settings → API Keys</strong></li>
            <li>Click <strong>Create Key</strong>, copy it, paste below</li>
          </ol>
          <div style={{ marginTop: 14 }}>
            <button
              style={secondaryBtnStyle}
              onClick={() => vscode?.postMessage({ type: 'open_external', url: 'https://console.anthropic.com/settings/keys' })}
            >
              Open Anthropic Console
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)' }}>API Key</label>
            <input
              type="password"
              style={inputStyle}
              placeholder="sk-ant-api03-…"
              value={claudeKey}
              onChange={(e) => setClaudeKey(e.target.value)}
            />
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              style={{ ...btnStyle, opacity: claudeKey.trim() ? 1 : 0.5 }}
              disabled={!claudeKey.trim()}
              onClick={() => {
                setClaudeStatus({ status: 'testing', detail: undefined });
                vscode?.postMessage({ type: 'save_test_claude', key: claudeKey.trim() });
              }}
            >
              Save &amp; Test
            </button>
            <StatusBadge s={claudeStatus} />
          </div>
        </div>
      )}

      {/* Codex tab */}
      {activeTab === 'codex' && (
        <div>
          <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
            Sign in to <strong>chatgpt.com</strong> with Google (or any method), then copy your session token:
          </p>
          <ol style={{ paddingLeft: 18, fontSize: 13, lineHeight: 2.2 }}>
            <li>Open <strong>chatgpt.com</strong> in your browser and sign in</li>
            <li>Press <code>F12</code> → <strong>Application</strong> tab → Cookies → <code>https://chatgpt.com</code></li>
            <li>Copy the value of <code>__Secure-next-auth.session-token</code></li>
          </ol>
          <div style={{ marginTop: 14 }}>
            <button
              style={secondaryBtnStyle}
              onClick={() => vscode?.postMessage({ type: 'open_external', url: 'https://chatgpt.com' })}
            >
              Open chatgpt.com
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)' }}>Session Token</label>
            <input
              type="password"
              style={inputStyle}
              placeholder="eyJhbGci…"
              value={codexToken}
              onChange={(e) => setCodexToken(e.target.value)}
            />
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              style={{ ...btnStyle, opacity: codexToken.trim() ? 1 : 0.5 }}
              disabled={!codexToken.trim()}
              onClick={() => {
                setCodexStatus({ status: 'testing', detail: undefined });
                vscode?.postMessage({ type: 'save_test_codex', token: codexToken.trim() });
              }}
            >
              Save &amp; Test
            </button>
            <StatusBadge s={codexStatus} />
          </div>
        </div>
      )}

      {/* GitHub tab */}
      {activeTab === 'github' && (
        <div>
          <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            Sign in with your <strong>GitHub account</strong>. VS Code handles the OAuth flow — no token copying required.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              style={btnStyle}
              onClick={() => {
                setGithubStatus({ status: 'testing', detail: undefined });
                vscode?.postMessage({ type: 'github_signin' });
              }}
            >
              Sign in with GitHub
            </button>
            <StatusBadge s={githubStatus} />
          </div>
          {githubStatus.status === 'ok' && (
            <p style={{ marginTop: 14, fontSize: 12, color: 'var(--vscode-descriptionForeground)', lineHeight: 1.5 }}>
              GitHub Copilot quota will appear in the dashboard. If you don't have an active Copilot subscription it will show as unavailable.
            </p>
          )}
        </div>
      )}

      {/* Done button */}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--vscode-panel-border, #3c3c3c)' }}>
        <button
          style={secondaryBtnStyle}
          onClick={() => vscode?.postMessage({ type: 'close_panel' })}
        >
          Done — open dashboard
        </button>
        <span style={{ marginLeft: 14, fontSize: 12, color: 'var(--vscode-descriptionForeground)' }}>
          Connected services show quota immediately. Skipped services show as pending.
        </span>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

createRoot(root).render(
  <StrictMode>
    <CredentialSetup />
  </StrictMode>,
);
