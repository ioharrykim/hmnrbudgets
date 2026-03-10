export function formatCurrency(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactKrw(value: number) {
  if (Math.abs(value) >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}억`;
  }

  if (Math.abs(value) >= 10_000) {
    return `${(value / 10_000).toFixed(0)}만`;
  }

  return `${Math.round(value)}`;
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function formatMonths(value: number) {
  if (value <= 0) {
    return "즉시 가능";
  }

  const years = Math.floor(value / 12);
  const months = value % 12;

  if (years === 0) {
    return `${months}개월`;
  }

  if (months === 0) {
    return `${years}년`;
  }

  return `${years}년 ${months}개월`;
}
