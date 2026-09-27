import * as vscode from 'vscode';
import type { QuotaState, ServiceId } from '@ai-quota-tool/core';

const CONFIGURE_COMMAND = 'aiQuotaTool.configure';

/** Hosts the shared React UI bundle inside a VS Code webview panel. */
export class QuotaPanel {
  static readonly viewType = 'aiQuotaTool.dashboard';

  private panel: vscode.WebviewPanel | null = null;
  private readonly extensionUri: vscode.Uri;
  private latestStates: QuotaState[] = [];
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

    // Webview signals readiness after React mounts. Send the current state at once.
    this.panel.webview.onDidReceiveMessage((msg: { type: string }) => {
      if (msg.type === 'webview_ready') this.pushStates(this.latestStates, this.latestReauth);
      if (msg.type === 'open_setup') void vscode.commands.executeCommand(CONFIGURE_COMMAND);
    });

    this.panel.onDidDispose(() => {
      this.panel = null;
    });
  }

  pushStates(states: QuotaState[], reauthServices: ServiceId[] = []): void {
    this.latestStates = states;
    this.latestReauth = reauthServices;
    this.panel?.webview.postMessage({ type: 'quota_update', payload: states, reauthServices });
  }

  private buildHtml(): string {
    const webview = this.panel!.webview;
    const asset = (name: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', name));
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};" />
  <link rel="stylesheet" href="${asset('webview.css')}" />
  <title>AI Quota Tool</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${asset('index.js')}"></script>
</body>
</html>`;
  }
}
