/**
 * Format a provider decimal amount with its currency code.
 * Unknown currency codes fall back to "110.00 XYZ" rather than throwing.
 */
export function formatAccountBalance(amount: string, currency: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${currency}`;
  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const symbol = formatter.formatToParts(value).find((part) => part.type === 'currency')?.value;
    // Intl prints an unknown code back as the symbol ("XYZ 110.00") instead of throwing.
    if (symbol == null || symbol.toUpperCase() === currency.toUpperCase()) {
      return `${amount} ${currency}`;
    }
    return formatter.format(value);
  } catch {
    return `${amount} ${currency}`;
  }
}
