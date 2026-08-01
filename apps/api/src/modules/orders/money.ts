export function multiplyPriceToCents(
  unitPrice: string,
  quantity: string,
): bigint {
  const price = parseScaled(unitPrice, 4);
  const amount = parseScaled(quantity, 3);
  const raw = price * amount;
  return (raw + 50_000n) / 100_000n;
}

export function centsToAmount(cents: bigint): string {
  const absolute = cents < 0n ? -cents : cents;
  const sign = cents < 0n ? '-' : '';
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

function parseScaled(value: string, scale: number): bigint {
  const [integer = '0', decimal = ''] = value.split('.');
  const fraction = decimal.padEnd(scale, '0').slice(0, scale);
  return BigInt(integer) * 10n ** BigInt(scale) + BigInt(fraction || '0');
}
