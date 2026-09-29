import type { QuotaState } from '@ai-quota-tool/core';
import {
  connectionIdOf,
  connectionKindOf,
  formatAccountBalance,
  isConnectedReading,
  QUOTA_HONESTY_LABELS,
  SERVICE_LABELS,
} from '@ai-quota-tool/core';
import { LowestLimit, ProviderCard, ProviderLogo } from '@ai-quota-tool/ui';
import type { KeyRow, PanelSnapshot, PanelTab } from './protocol.js';

const ENDED_HINT = 'Your session ended. Sign in again on the Accounts tab.';
const WAITING_HINT = 'Reading your usage. This can take a few seconds.';

function readingOf(readings: QuotaState[], id: string, kind: 'account' | 'key'): QuotaState | undefined {
  return readings.find((s) => connectionIdOf(s) === id && connectionKindOf(s) === kind);
}

/** The one number a Key chip shows. */
export function keyHeadline(reading: QuotaState | undefined): string {
  if (reading == null) return 'Waiting';
  const balance = reading.balance?.infos[0];
  if (balance != null && isConnectedReading(reading)) return formatAccountBalance(balance.total, balance.currency);
  if (reading.honesty === 'api_key_invalid') return 'Key rejected';
  if (reading.honesty != null) return QUOTA_HONESTY_LABELS[reading.honesty];
  return 'No data';
}

function KeyChip({ row, reading }: { row: KeyRow; reading: QuotaState | undefined }) {
  const zero = reading?.honesty === 'balance_empty';
  return (
    <div className="chip" title={`${SERVICE_LABELS[row.service]} - ends ${row.last4}`}>
      <ProviderLogo service={row.service} size={18} />
      <span className="grow ellipsis">{row.name}</span>
      <span className={zero ? 'num chip-value zero' : 'num chip-value'}>{keyHeadline(reading)}</span>
    </div>
  );
}

export function UsageTab({ snapshot, onTab }: { snapshot: PanelSnapshot; onTab: (tab: PanelTab) => void }) {
  const accounts = snapshot.accounts.filter((a) => a.status !== 'none');
  const accountReadings = accounts.flatMap((a) => {
    const reading = readingOf(snapshot.readings, a.service, 'account');
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
              const reading = readingOf(snapshot.readings, a.service, 'account');
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
              <KeyChip key={row.id} row={row} reading={readingOf(snapshot.readings, row.id, 'key')} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
