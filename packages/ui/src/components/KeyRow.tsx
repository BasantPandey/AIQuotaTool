import type React from 'react';
import type { QuotaState, ServiceId } from '@ai-quota-tool/core';
import { describeKey, SERVICE_LABELS } from '@ai-quota-tool/core';
import { freshness } from './ProviderCard.js';
import { ProviderLogo } from './ProviderLogo.js';
import { Meter } from './UsageBar.js';

export interface KeyItem {
  id: string;
  name: string;
  last4: string;
  state?: QuotaState;
}

/** One named API key inside its provider card: name, last 4 characters, and its number. Pure display. */
export function KeyRow({ item, action }: { item: KeyItem; action?: React.ReactNode }) {
  const view = describeKey(item.state);
  const rejected = item.state?.honesty === 'api_key_invalid';
  const tone = rejected || view.empty ? ' bad' : item.state == null ? ' faint' : '';
  // The card header already says "Account balance" or "spend". A row adds words only when they add facts.
  const plain = view.shows === 'Account balance' || view.shows === 'Spend only';
  // "312 requests": a large number with a small unit, like the small "%" of the plan cards.
  const unit = /^([\d.,]+) (\D+)$/.exec(view.headline);
  return (
    <li className={action != null ? 'key-row with-action' : 'key-row'}>
      <div className="key-main">
        <div className="key-title">{item.name}</div>
        <div className="key-sub">
          <span className="key-tail num">····{item.last4}</span>
          {!plain && <> · {view.detail}</>}
        </div>
      </div>
      <div className={`key-value num${tone}`}>
        {rejected ? (
          'Rejected'
        ) : unit != null ? (
          <>
            {unit[1]}
            <span className="key-unit">{unit[2]}</span>
          </>
        ) : (
          view.headline
        )}
      </div>
      {action}
      {view.pct != null && (
        <div className="key-meter">
          <Meter pct={view.pct} label={item.name} thin />
        </div>
      )}
    </li>
  );
}

function GroupPill({ items }: { items: KeyItem[] }) {
  if (items.some((item) => item.state?.honesty === 'api_key_invalid')) {
    return (
      <span className="pill">
        <span className="dot warn" />
        Key rejected
      </span>
    );
  }
  const updated = items.flatMap((item) => item.state?.lastUpdated ?? []);
  if (updated.length === 0) {
    return (
      <span className="pill">
        <span className="dot" />
        Waiting
      </span>
    );
  }
  return (
    <span className="pill">
      <span className="dot ok" />
      {freshness(Math.min(...updated))}
    </span>
  );
}

interface GroupProps {
  service: ServiceId;
  /** What the keys of this provider show, for example "Account balance". */
  caption: string;
  items: KeyItem[];
  /** Host-owned control in the header. Default: the freshness pill. */
  action?: React.ReactNode;
  /** Host-owned control at the end of each key row. */
  rowAction?: (item: KeyItem) => React.ReactNode;
  /** Host-owned replacement for a row, for example an edit form. */
  renderRow?: (item: KeyItem) => React.ReactNode | undefined;
}

/** One card for each key provider, with one row for each of its keys. Pure display. */
export function KeyGroupCard({ service, caption, items, action, rowAction, renderRow }: GroupProps) {
  const count = items.length === 1 ? '1 key' : `${items.length} keys`;
  return (
    <section className="card key-group" aria-label={`${SERVICE_LABELS[service]} API keys`}>
      <header className="card-head">
        <ProviderLogo service={service} size={30} />
        <span className="card-title">
          {SERVICE_LABELS[service]}
          <span className="card-caption">
            {caption} · {count}
          </span>
        </span>
        {action ?? <GroupPill items={items} />}
      </header>
      <ul className="key-list" aria-label={`${SERVICE_LABELS[service]} keys`}>
        {items.map(
          (item) =>
            renderRow?.(item) ?? <KeyRow key={item.id} item={item} {...(rowAction ? { action: rowAction(item) } : {})} />,
        )}
      </ul>
    </section>
  );
}
