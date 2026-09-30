import type { QuotaState } from '@ai-quota-tool/core';
import { connectionIdOf, connectionKindOf } from '@ai-quota-tool/core';

export { describeKey as keyView } from '@ai-quota-tool/core';

export function keyReading(readings: QuotaState[], id: string): QuotaState | undefined {
  return readings.find((s) => connectionIdOf(s) === id && connectionKindOf(s) === 'key');
}
