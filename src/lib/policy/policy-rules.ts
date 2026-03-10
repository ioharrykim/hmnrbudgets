import type { FinancialSnapshot, MarketSnapshot, PolicyLoanEligibility, PolicySnapshot } from "@/lib/types";

function annualRecognizedIncome(financialSnapshot: FinancialSnapshot) {
  const monthlyIncome = financialSnapshot.members.reduce((sum, member) => {
    return sum + member.monthlyNetIncome + member.monthlyVariableIncome * 0.7;
  }, 0);

  return monthlyIncome * 12 + financialSnapshot.expectedAnnualBonus * 0.7;
}

function totalAssets(financialSnapshot: FinancialSnapshot) {
  return (
    financialSnapshot.cashAssets +
    financialSnapshot.subscriptionSavings +
    financialSnapshot.jeonseReturnAmount +
    financialSnapshot.otherInvestableAssets
  );
}

function housePriceHint(markets: MarketSnapshot[]) {
  if (markets.length === 0) {
    return 800_000_000;
  }

  return Math.min(...markets.map((market) => market.priceBandLow));
}

export function evaluatePolicyEligibility(
  financialSnapshot: FinancialSnapshot,
  policySnapshot: PolicySnapshot,
  markets: MarketSnapshot[],
): PolicyLoanEligibility[] {
  const recognizedIncome = annualRecognizedIncome(financialSnapshot);
  const assets = totalAssets(financialSnapshot);
  const representativeHousePrice = housePriceHint(markets);
  const isNewlywed = true;

  const bogeumjariIncomeLimit = isNewlywed
    ? policySnapshot.bogeumjari.newlywedIncomeLimit
    : policySnapshot.bogeumjari.maxIncome;
  const bogeumjariEligible =
    recognizedIncome <= bogeumjariIncomeLimit &&
    representativeHousePrice <= policySnapshot.bogeumjari.maxHousePrice;

  const bogeumjari: PolicyLoanEligibility = {
    product: "bogeumjari",
    eligible: bogeumjariEligible,
    reason: bogeumjariEligible
      ? "수도권 고정금리 대안으로 검토 가능한 수준입니다."
      : "소득 또는 목표 주택가격이 보금자리론 기준을 초과합니다.",
    maxLoanAmount: bogeumjariEligible
      ? Math.min(policySnapshot.bogeumjari.firstHomeMaxLoan, representativeHousePrice * policySnapshot.bogeumjari.capitalAreaFirstHomeLtv)
      : 0,
    rate: policySnapshot.bogeumjari.baseRate,
    ltvLimit: policySnapshot.bogeumjari.capitalAreaFirstHomeLtv,
    dtiLimit: policySnapshot.bogeumjari.dti,
  };

  const didimdolIncomeLimit = isNewlywed
    ? policySnapshot.didimdol.newlywedIncome
    : policySnapshot.didimdol.maxIncome;
  const didimdolHousePriceLimit = isNewlywed
    ? policySnapshot.didimdol.newlywedMaxHousePrice
    : policySnapshot.didimdol.maxHousePrice;

  const didimdolEligible =
    recognizedIncome <= didimdolIncomeLimit &&
    representativeHousePrice <= didimdolHousePriceLimit &&
    assets <= policySnapshot.didimdol.assetLimit;

  const didimdol: PolicyLoanEligibility = {
    product: "didimdol",
    eligible: didimdolEligible,
    reason: didimdolEligible
      ? "신혼가구 디딤돌/구입자금 요건에 근접하거나 충족합니다."
      : "주택가격, 소득, 순자산 중 하나가 디딤돌 기준을 초과합니다.",
    maxLoanAmount: didimdolEligible ? policySnapshot.didimdol.newlywedMaxLoan : 0,
    rate: policySnapshot.didimdol.representativeRate,
    ltvLimit: policySnapshot.didimdol.ltv,
    dtiLimit: policySnapshot.didimdol.dti,
  };

  return [bogeumjari, didimdol];
}

export function calculateRecognizedMonthlyIncome(financialSnapshot: FinancialSnapshot) {
  return annualRecognizedIncome(financialSnapshot) / 12;
}

export function calculateTotalOwnFunds(financialSnapshot: FinancialSnapshot) {
  return totalAssets(financialSnapshot);
}
