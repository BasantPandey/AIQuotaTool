import * as vscode from 'vscode';
import type { QuotaState, ServiceId } from '@ai-quota-tool/core';

/** Hosts the shared React UI bundle inside a VS Code webview panel. */
export class QuotaPanel {
  static readonly viewType = 'aiQuotaTool.dashboard';

  private panel: vscode.WebviewPanel | null = null;
  private readonly extensionUri: vscode.Uri;
  private latestStates: QuotaState[] = [];
  private latestDisconnected = false;
  private latestReauth: ServiceId[] = [];

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  open(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      QuotaPanel.viewType,
      'AI Quota Tool',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')],
        retainContextWhenHidden: true,
      },
    );

    this.panel.webview.html = this.buildHtml();

    // Webview signals readiness after React mounts — send current state immediately
    this.panel.webview.onDidReceiveMessage((msg: { type: string }) => {
      if (msg.type === 'webview_ready') {
        this.pushStates(this.latestStates, this.latestDisconnected, this.latestReauth);
      }
    });

    this.panel.onDidDispose(() => {
      this.panel = null;
    });
  }

  pushStates(
    states: QuotaState[],
    disconnected = false,
    reauthServices: ServiceId[] = [],
  ): void {
    this.latestStates = states;
    this.latestDisconnected = disconnected;
    this.latestReauth = reauthServices;
    this.panel?.webview.postMessage({
      type: 'quota_update',
      payload: states,
      disconnected,
      reauthServices,
    });
  }

  private buildHtml(): string {
    const webview = this.panel!.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'index.js'),
    );
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};" />
  <style>* { box-sizing: border-box; margin: 0; padding: 0; } body { background: #0d1117; font-family: system-ui, sans-serif; }</style>
  <title>AI Quota Tool</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
