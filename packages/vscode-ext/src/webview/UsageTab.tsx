import type { QuotaState } from '@ai-quota-tool/core';
import { connectionIdOf, connectionKindOf, SERVICE_LABELS } from '@ai-quota-tool/core';
import { level, LowestLimit, Meter, ProviderCard, ProviderLogo } from '@ai-quota-tool/ui';
import type { KeyRow, PanelSnapshot, PanelTab } from './protocol.js';
import { keyReading, keyView } from './key-view.js';

const ENDED_HINT = 'Your session ended. Sign in again on the Accounts tab.';
const WAITING_HINT = 'Reading your usage. This can take a few seconds.';

function accountReading(readings: QuotaState[], service: string): QuotaState | undefined {
  return readings.find((s) => connectionIdOf(s) === service && connectionKindOf(s) === 'account');
}

function KeyChip({ row, reading }: { row: KeyRow; reading: QuotaState | undefined }) {
  const view = keyView(reading);
  return (
    <div className="chip" title={`${SERVICE_LABELS[row.service]} - ends ${row.last4}`} {...(view.pct != null ? { 'data-level': level(view.pct) } : {})}>
      <div className="chip-row">
        <ProviderLogo service={row.service} size={18} />
        <span className="grow ellipsis">
          {row.name}
          <span className="sub">{view.detail}</span>
        </span>
        <span className={view.empty ? 'num chip-value zero' : 'num chip-value'}>{view.headline}</span>
      </div>
      {view.pct != null && <Meter pct={view.pct} label={row.name} thin />}
    </div>
  );
}

export function UsageTab({ snapshot, onTab }: { snapshot: PanelSnapshot; onTab: (tab: PanelTab) => void }) {
  const accounts = snapshot.accounts.filter((a) => a.status !== 'none');
  const accountReadings = accounts.flatMap((a) => {
    const reading = accountReading(snapshot.readings, a.service);
    return a.status === 'connected' && reading != null ? [reading] : [];
  });

  if (accounts.length === 0 && snapshot.keys.length === 0) {
    return (
      <div className="empty">
        <h2>No accounts or keys yet</h2>
        <p>Sign in to an Account to see plan limits. Add a Key to see API balance.</p>
        <button className="btn btn-primary" onClick={() => onTab('accounts')}>
          Set up accounts
        </button>
      </div>
    );
  }

  return (
    <>
      <LowestLimit states={accountReadings} />
      {accounts.length > 0 && (
        <>
          <div className="kicker">Accounts</div>
          <div className="cards">
            {accounts.map((a) => {
              const reading = accountReading(snapshot.readings, a.service);
              if (a.status === 'ended') {
                return (
                  <ProviderCard
                    key={a.service}
                    service={a.service}
                    state={{ service: a.service, honesty: 'session_expired', lastUpdated: Date.now() }}
                    hint={ENDED_HINT}
                    action={
                      <button className="btn btn-primary" onClick={() => onTab('accounts')}>
                        Sign in again
                      </button>
                    }
                  />
                );
              }
              return (
                <ProviderCard
                  key={a.service}
                  service={a.service}
                  {...(reading != null ? { state: reading } : {})}
                  hint={WAITING_HINT}
                  pendingText="Waiting for data"
                />
              );
            })}
          </div>
        </>
      )}
      {snapshot.keys.length > 0 && (
        <>
          <div className="kicker">Keys</div>
          <div className="chips">
            {snapshot.keys.map((row) => (
              <KeyChip key={row.id} row={row} reading={keyReading(snapshot.readings, row.id)} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
