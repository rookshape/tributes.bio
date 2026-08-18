/**
 * Spin amounts are nearly always whole dollars, and "$45.00" on a stream
 * overlay reads as clutter — so cents only appear when there are cents.
 */
export function formatMoney(cents: number) {
  const whole = cents % 100 === 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}
