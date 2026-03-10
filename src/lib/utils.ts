export function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function roundTo(value: number, unit: number) {
  if (unit === 0) {
    return value;
  }

  return Math.round(value / unit) * unit;
}

export function nowIso() {
  return new Date().toISOString();
}
