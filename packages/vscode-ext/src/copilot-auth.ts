import * as vscode from 'vscode';

const SIGNED_IN_KEY = 'aiQuotaTool.copilotSignedIn';
const SCOPES = ['read:user'];

/**
 * Copilot uses the VS Code built-in GitHub sign-in. GitHub answers `copilot_internal/user` only for
 * tokens of its own apps, so our own device-flow token does not work there. VS Code keeps the token.
 * The extension keeps only a flag that says the user chose to connect Copilot.
 */
export class CopilotAuth {
  constructor(private readonly state: vscode.Memento) {}

  isSignedIn(): boolean {
    return this.state.get<boolean>(SIGNED_IN_KEY) === true;
  }

  /** Shows the one VS Code consent dialog. Throws when the user cancels. */
  async signIn(): Promise<void> {
    await vscode.authentication.getSession('github', SCOPES, { createIfNone: true });
    await this.state.update(SIGNED_IN_KEY, true);
  }

  /** Stops the use of the GitHub session. The VS Code GitHub account stays signed in. */
  async signOut(): Promise<void> {
    await this.state.update(SIGNED_IN_KEY, undefined);
  }

  /** The token, with no dialog. Undefined when the user did not connect, or the VS Code session ended. */
  async token(): Promise<string | undefined> {
    if (!this.isSignedIn()) return undefined;
    const session = await vscode.authentication.getSession('github', SCOPES, { silent: true });
    return session?.accessToken;
  }
}
