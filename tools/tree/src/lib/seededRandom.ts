export function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function stableId(prefix: string, seed: string): string {
  return `${prefix}_${hashString(seed).toString(36)}`;
}

export function seeded01(seed: string): number {
  const hash = hashString(seed);
  return (hash % 100000) / 100000;
}

export function seededRange(seed: string, min: number, max: number): number {
  return min + (max - min) * seeded01(seed);
}

export function pickStable<T>(items: T[], seed: string, offset = 0): T {
  return items[(hashString(`${seed}:${offset}`) + offset) % items.length];
}

export function nowIso(): string {
  return new Date().toISOString();
}
