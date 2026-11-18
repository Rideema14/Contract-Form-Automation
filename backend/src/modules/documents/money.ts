/**
 * Decimal-safe helpers for money strings such as "1200.5000". No floating
 * point is used: values are scaled integers (BigInt).
 */
const MONEY_RE = /^(-)?(\d+)(?:\.(\d+))?$/;

function toScaled(value: string, scale: number): bigint {
  const match = MONEY_RE.exec(value.trim());
  if (!match) throw new Error(`Invalid decimal value: "${value}"`);
  const [, sign, whole, frac = ''] = match;
  const scaled = BigInt(whole + frac.padEnd(scale, '0').slice(0, scale));
  return sign ? -scaled : scaled;
}

/** Adds decimal strings exactly and formats with a fixed number of decimals (default 2, rounded half up). */
export function sumMoney(values: string[], decimals = 2): string {
  const scale = Math.max(decimals, ...values.map((v) => MONEY_RE.exec(v.trim())?.[3]?.length ?? 0));
  const total = values.reduce((acc, v) => acc + toScaled(v, scale), 0n);
  return formatScaled(total, scale, decimals);
}

/** Formats one decimal string with a fixed number of decimals (rounded half up). */
export function formatMoney(value: string, decimals = 2): string {
  return sumMoney([value], decimals);
}

function formatScaled(value: bigint, scale: number, decimals: number): string {
  const negative = value < 0n;
  let abs = negative ? -value : value;
  if (scale > decimals) {
    const divisor = 10n ** BigInt(scale - decimals);
    abs = (abs + divisor / 2n) / divisor;
  }
  const digits = abs.toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals);
  const body = decimals > 0 ? `${whole}.${frac}` : whole;
  return negative && abs !== 0n ? `-${body}` : body;
}
