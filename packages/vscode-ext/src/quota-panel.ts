import * as vscode from 'vscode';
import type { HostMessage, PanelSnapshot, PanelTab, WebviewMessage } from './webview/protocol.js';

/** The one AI Quota Tool panel: Usage, Accounts, and Keys tabs in a single webview. */
export class QuotaPanel {
  static readonly viewType = 'aiQuotaTool.dashboard';

  private panel: vscode.WebviewPanel | null = null;
  private tab: PanelTab = 'usage';
  private snapshot: PanelSnapshot | null = null;
  private handler: ((msg: WebviewMessage) => void | Promise<void>) | null = null;

  constructor(private readonly extensionUri: vscode.Uri) {}

  onMessage(handler: (msg: WebviewMessage) => void | Promise<void>): void {
    this.handler = handler;
  }

  get isOpen(): boolean {
    return this.panel != null;
  }

  open(tab: PanelTab): void {
    this.tab = tab;
    if (this.panel) {
      this.panel.reveal();
      this.post({ type: 'show_tab', tab });
      return;
    }

    this.panel = vscode.window.createWebviewPanel(QuotaPanel.viewType, 'AI Quota Tool', vscode.ViewColumn.Two, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')],
      retainContextWhenHidden: true,
    });
    this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'icons', 'icon128.png');
    this.panel.webview.html = this.buildHtml();

    this.panel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      if (msg.type === 'ready') {
        this.post({ type: 'show_tab', tab: this.tab });
        if (this.snapshot) this.post({ type: 'snapshot', snapshot: this.snapshot });
      }
      await this.handler?.(msg);
    });

    this.panel.onDidDispose(() => {
      this.panel = null;
    });
  }

  pushSnapshot(snapshot: PanelSnapshot): void {
    this.snapshot = snapshot;
    this.post({ type: 'snapshot', snapshot });
  }

  post(msg: HostMessage): void {
    void this.panel?.webview.postMessage(msg);
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
