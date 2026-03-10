import { HOUSEHOLD_ROLES } from "@/lib/constants";

export function parseKoreanMoney(input: string): number {
  const cleaned = input.replace(/,/g, "").replace(/\s+/g, "");

  if (!cleaned) {
    return 0;
  }

  if (/^\d+(\.\d+)?$/.test(cleaned)) {
    const numeric = Number(cleaned);
    return numeric <= 10_000 ? Math.round(numeric * 10_000) : Math.round(numeric);
  }

  let total = 0;
  const eokMatch = cleaned.match(/(\d+(?:\.\d+)?)억/);
  if (eokMatch) {
    total += Number(eokMatch[1]) * 100_000_000;
  }

  const cheonMatch = cleaned.match(/(\d+(?:\.\d+)?)천/);
  if (cheonMatch) {
    total += Number(cheonMatch[1]) * 10_000_000;
  }

  const baekMatch = cleaned.match(/(\d+(?:\.\d+)?)백/);
  if (baekMatch) {
    total += Number(baekMatch[1]) * 1_000_000;
  }

  const manMatch = cleaned.match(/(\d+(?:\.\d+)?)만/);
  if (manMatch) {
    total += Number(manMatch[1]) * 10_000;
  }

  return Math.round(total);
}

export function parseNumber(input: string): number {
  const matched = input.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return matched ? Number(matched[0]) : 0;
}

export function parseRegionList(input: string): string[] {
  return input
    .split(/[,\n/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildMemberIncomes(answers: Record<string, string>) {
  return HOUSEHOLD_ROLES.map((member) => ({
    name: member.name,
    roleLabel: member.roleLabel,
    monthlyNetIncome: parseKoreanMoney(
      answers[member.name === "현민" ? "hyunminMonthlyNetIncome" : "nuriMonthlyNetIncome"] ?? "",
    ),
    monthlyVariableIncome: parseKoreanMoney(
      answers[member.name === "현민" ? "hyunminMonthlyVariableIncome" : "nuriMonthlyVariableIncome"] ?? "",
    ),
    employmentType: "employee" as const,
  }));
}
