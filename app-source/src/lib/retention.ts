/*
  MARUTI CRM, RETENTION & PMS GAIN/LOSS ENGINE (IDEA-020, IDEA-021, IDEA-022, IDEA-023)
  -------------------------------------------------------------------------------------
  Level 5 IIMK Human standard:
  - What it is: Pure, deterministic calculation engine for workshop customer retention,
    PMS gain/loss waterfalls, active-customer cohorts (54k-55k base), and multi-dimensional
    CRM calling priority.
  - Why we need it: Calling every customer in random order wastes SMRE hours on 3-year-old
    dormant records while urgent 0-15 month PMS customers slip away. Also, adding noisy
    dimensions to a calling score must never pull down a genuinely urgent customer.
  - Controls:
    1. Self, Parent (W2), and Zone (West) retention are nested levels (Self <= W2 <= West),
       never summed together.
    2. Customers beyond 36 months move to the Archive / New Sales Lead lane so they do not
       clog the daily service calling queue.
    3. No-Pull-Down Rule: secondary or noisy dimensions can break ties upward (+0..5 pts)
       but never reduce a high-urgency customer's core PMS score.
*/

export type CustomerCohort =
  | "focused"
  | "very_high_running"
  | "future_due_focused"
  | "non_focused"
  | "archive_sales_lead";

export const COHORT_META: Record<
  CustomerCohort,
  { label: string; windowLabel: string; conversionHint: string; badgeTone: "ok" | "brand" | "warn" | "danger" | "muted" }
> = {
  focused: {
    label: "Focused Active (0–15m)",
    windowLabel: "Visited within 0–15 months",
    conversionHint: "~90% conversion likelihood · primary SMR queue",
    badgeTone: "ok",
  },
  very_high_running: {
    label: "Very High Running",
    windowLabel: ">= 1,500 km/month usage",
    conversionHint: "Accelerated wear · call before standard date window",
    badgeTone: "brand",
  },
  future_due_focused: {
    label: "Future Due Focused",
    windowLabel: "PMS / FR due in next 30 days",
    conversionHint: "Pre-booking window · lock appointment early",
    badgeTone: "warn",
  },
  non_focused: {
    label: "Non-Focused Winback (15–36m)",
    windowLabel: "15–36 months since last visit",
    conversionHint: "Dedicated winback campaign · separate from daily PMS",
    badgeTone: "danger",
  },
  archive_sales_lead: {
    label: "Archive / New Sales Lead (>36m)",
    windowLabel: "> 36 months dormant",
    conversionHint: "Excluded from service calling · route to Exchange / Sales",
    badgeTone: "muted",
  },
};

export interface CustomerScoringInput {
  id: string;
  regNo: string;
  customerName: string;
  mobile: string;
  workshopCode: string;
  workshopName: string;
  model: string;
  monthsSinceLastVisit: number;
  runningKmPerMonth: number;
  daysToNextDue: number;
  lastServiceStage: "FR1" | "FR2" | "FR3" | "PMS1" | "PMS2" | "PMS3+";
  /** 0..100 each */
  dimensions: {
    recency: number;
    running_km: number;
    pms_continuity: number;
    psf_satisfaction: number;
    visit_tat: number;
    whatsapp_pingmate: number;
  };
  convertedInWindow?: boolean;
}

export type ScoreDimensionKey = keyof CustomerScoringInput["dimensions"];

export const DIMENSION_LABELS: Record<ScoreDimensionKey, { label: string; role: "core" | "tie_breaker" }> = {
  recency: { label: "Recency & Due Window", role: "core" },
  running_km: { label: "Running KM / Day Pace", role: "core" },
  pms_continuity: { label: "PMS / FR Continuity", role: "core" },
  psf_satisfaction: { label: "Past PSF Satisfaction", role: "tie_breaker" },
  visit_tat: { label: "Workshop Visit TAT", role: "tie_breaker" },
  whatsapp_pingmate: { label: "Pingmate WhatsApp Read", role: "tie_breaker" },
};

/**
 * IDEA-023: Classify a vehicle/customer into one of the 5 operational cohorts.
 * Precedence:
 * 1. > 36 months -> archive_sales_lead (never mix with active service calling)
 * 2. Due within -15..+30 days and active (<= 15m) -> future_due_focused
 * 3. Running >= 1,500 km/month and <= 24m -> very_high_running
 * 4. <= 15 months -> focused
 * 5. 15..36 months -> non_focused
 */
export function classifyCustomerCohort(c: Pick<CustomerScoringInput, "monthsSinceLastVisit" | "runningKmPerMonth" | "daysToNextDue">): CustomerCohort {
  const months = Math.max(0, Number(c.monthsSinceLastVisit) || 0);
  const kmPerMonth = Math.max(0, Number(c.runningKmPerMonth) || 0);
  const daysDue = Number.isFinite(c.daysToNextDue) ? c.daysToNextDue : 999;

  if (months > 36) return "archive_sales_lead";
  if (months <= 15 && daysDue >= -15 && daysDue <= 30) return "future_due_focused";
  if (months <= 24 && kmPerMonth >= 1500) return "very_high_running";
  if (months <= 15) return "focused";
  return "non_focused";
}

export interface ActiveBaseWaterfallInput {
  monthLabel: string;
  openingActiveBase: number;
  newFirstFreeEntries: number;
  reactivatedFromNonFocused: number;
  transferredInFromCluster: number;
  lapsedBeyond15m: number;
  movedToArchiveBeyond36m: number;
}

export interface ActiveBaseWaterfallResult extends ActiveBaseWaterfallInput {
  totalInflows: number;
  totalOutflows: number;
  netChange: number;
  closingActiveBase: number;
  withinTargetBand: boolean;
  targetBandLabel: string;
}

/**
 * IDEA-023: Monthly Active-Customer Base Waterfall (~54k-55k rolling base).
 */
export function computeActiveBaseWaterfall(input: ActiveBaseWaterfallInput): ActiveBaseWaterfallResult {
  const opening = Math.max(0, Math.round(input.openingActiveBase));
  const inNew = Math.max(0, Math.round(input.newFirstFreeEntries));
  const inReact = Math.max(0, Math.round(input.reactivatedFromNonFocused));
  const inCluster = Math.max(0, Math.round(input.transferredInFromCluster));
  const outLapsed = Math.max(0, Math.round(input.lapsedBeyond15m));
  const outArchive = Math.max(0, Math.round(input.movedToArchiveBeyond36m));

  const totalInflows = inNew + inReact + inCluster;
  const totalOutflows = outLapsed + outArchive;
  const netChange = totalInflows - totalOutflows;
  const closingActiveBase = Math.max(0, opening + netChange);
  const withinTargetBand = closingActiveBase >= 54000 && closingActiveBase <= 55500;

  return {
    ...input,
    openingActiveBase: opening,
    newFirstFreeEntries: inNew,
    reactivatedFromNonFocused: inReact,
    transferredInFromCluster: inCluster,
    lapsedBeyond15m: outLapsed,
    movedToArchiveBeyond36m: outArchive,
    totalInflows,
    totalOutflows,
    netChange,
    closingActiveBase,
    withinTargetBand,
    targetBandLabel: "54,000 – 55,500 active vehicles",
  };
}

export interface DimensionUpliftRow {
  key: ScoreDimensionKey;
  label: string;
  role: "core" | "tie_breaker";
  convertedAvgScore: number;
  nonConvertedAvgScore: number;
  scoreSeparation: number;
  highBandConversionPct: number;
  lowBandConversionPct: number;
  upliftPctPoints: number;
  noisy: boolean;
  recommendedWeight: number;
}

/**
 * IDEA-022: Compare converted vs non-converted outcomes across each dimension.
 * Identifies which dimensions genuinely separate converters from non-converters,
 * and flags noisy dimensions (uplift <= 5 percentage points) so they cannot dilute
 * the core calling priority score.
 */
export function computeDimensionUplift(samples: CustomerScoringInput[]): DimensionUpliftRow[] {
  const keys: ScoreDimensionKey[] = [
    "recency",
    "running_km",
    "pms_continuity",
    "psf_satisfaction",
    "visit_tat",
    "whatsapp_pingmate",
  ];

  const rows: DimensionUpliftRow[] = keys.map((key) => {
    const meta = DIMENSION_LABELS[key];
    const withOutcome = samples.filter((s) => typeof s.convertedInWindow === "boolean");
    const conv = withOutcome.filter((s) => s.convertedInWindow === true);
    const nonConv = withOutcome.filter((s) => s.convertedInWindow === false);

    const avg = (arr: CustomerScoringInput[]) =>
      arr.length ? Math.round((arr.reduce((acc, r) => acc + (Number(r.dimensions[key]) || 0), 0) / arr.length) * 10) / 10 : 0;

    const convertedAvgScore = avg(conv);
    const nonConvertedAvgScore = avg(nonConv);
    const scoreSeparation = Math.round((convertedAvgScore - nonConvertedAvgScore) * 10) / 10;

    const highBand = withOutcome.filter((s) => (Number(s.dimensions[key]) || 0) >= 70);
    const lowBand = withOutcome.filter((s) => (Number(s.dimensions[key]) || 0) < 70);

    const rate = (arr: CustomerScoringInput[]) =>
      arr.length ? Math.round((arr.filter((x) => x.convertedInWindow).length / arr.length) * 1000) / 10 : 0;

    const highBandConversionPct = rate(highBand);
    const lowBandConversionPct = rate(lowBand);
    const upliftPctPoints = Math.round((highBandConversionPct - lowBandConversionPct) * 10) / 10;

    const noisy = upliftPctPoints <= 5 || scoreSeparation <= 4;
    const recommendedWeight = noisy ? 0 : meta.role === "core" ? Math.max(15, Math.min(45, Math.round(upliftPctPoints))) : 5;

    return {
      key,
      label: meta.label,
      role: meta.role,
      convertedAvgScore,
      nonConvertedAvgScore,
      scoreSeparation,
      highBandConversionPct,
      lowBandConversionPct,
      upliftPctPoints,
      noisy,
      recommendedWeight,
    };
  });

  return rows;
}

export interface ScoredCustomer extends CustomerScoringInput {
  cohort: CustomerCohort;
  coreUrgencyScore: number;
  tieBreakerBonus: number;
  naiveAllDimensionAverage: number;
  finalPriorityScore: number;
  protectedFromPullDown: boolean;
  callAction: string;
}

/**
 * IDEA-022: Score and rank customers for SMR calling with No-Pull-Down Protection.
 * Core score = 45% Recency + 30% Running KM + 25% PMS Continuity.
 * Secondary dimensions (PSF, Visit TAT, Pingmate) only add a bounded +0..5 tie-breaker
 * bonus and NEVER pull a customer below their coreUrgencyScore.
 */
export function scoreCustomerPriority(c: CustomerScoringInput): ScoredCustomer {
  const clamp = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
  const rec = clamp(c.dimensions.recency);
  const run = clamp(c.dimensions.running_km);
  const pms = clamp(c.dimensions.pms_continuity);
  const psf = clamp(c.dimensions.psf_satisfaction);
  const tat = clamp(c.dimensions.visit_tat);
  const wa = clamp(c.dimensions.whatsapp_pingmate);

  const cohort = classifyCustomerCohort(c);
  const coreUrgencyScore = Math.round((rec * 0.45 + run * 0.3 + pms * 0.25) * 10) / 10;
  const secondaryAvg = (psf + tat + wa) / 3;
  const naiveAllDimensionAverage = Math.round(((rec + run + pms + psf + tat + wa) / 6) * 10) / 10;

  // Tie-breaker bonus is strictly non-negative (0 to +5.0 points)
  const tieBreakerBonus = Math.round(Math.max(0, ((secondaryAvg - 50) / 50) * 5) * 10) / 10;
  const rawFinal = Math.min(100, Math.round((coreUrgencyScore + tieBreakerBonus) * 10) / 10);

  // Archive (>36m) is deprioritized from service calling queue
  const finalPriorityScore = cohort === "archive_sales_lead" ? Math.min(25, rawFinal) : rawFinal;
  const protectedFromPullDown = cohort !== "archive_sales_lead" && coreUrgencyScore > naiveAllDimensionAverage;

  let callAction = "Standard SMR follow-up";
  if (cohort === "archive_sales_lead") {
    callAction = "Do NOT call for PMS · Hand off to Exchange / New Car Sales";
  } else if (cohort === "future_due_focused") {
    callAction = `Book slot now · Due in ${c.daysToNextDue} days`;
  } else if (cohort === "very_high_running") {
    callAction = `High usage (${c.runningKmPerMonth} km/m) · Offer express PMS bay`;
  } else if (cohort === "focused") {
    callAction = "Core 0–15m active · Confirm pickup / appointment";
  } else {
    callAction = "15–36m Winback · Offer health check & labour voucher";
  }

  return {
    ...c,
    cohort,
    coreUrgencyScore,
    tieBreakerBonus,
    naiveAllDimensionAverage,
    finalPriorityScore,
    protectedFromPullDown,
    callAction,
  };
}

export function rankCallQueue(customers: CustomerScoringInput[]): ScoredCustomer[] {
  return customers
    .map(scoreCustomerPriority)
    .sort((a, b) => {
      if (a.cohort === "archive_sales_lead" && b.cohort !== "archive_sales_lead") return 1;
      if (b.cohort === "archive_sales_lead" && a.cohort !== "archive_sales_lead") return -1;
      return b.finalPriorityScore - a.finalPriorityScore || a.daysToNextDue - b.daysToNextDue;
    });
}

export interface NestedRetentionInput {
  workshopCode: string;
  workshopName: string;
  totalEligibleVehicles: number;
  retainedAtSelfWorkshop: number;
  retainedWithinParentW2: number;
  retainedWithinWestZone: number;
}

export interface NestedRetentionResult extends NestedRetentionInput {
  selfRetentionPct: number;
  parentW2RetentionPct: number;
  westZoneRetentionPct: number;
  servicedAtSisterW2Workshop: number;
  leakedToCompetitorDealerInWest: number;
  lostOutsideZoneOrIndependent: number;
}

/**
 * IDEA-021: Self vs Parent (W2) vs Zone (West) nested retention calculator.
 * Enforces monotonic nesting: Self <= Parent W2 <= West Zone <= Eligible.
 * Never sums the three percentages together.
 */
export function computeNestedRetention(input: NestedRetentionInput): NestedRetentionResult {
  const eligible = Math.max(1, Math.round(input.totalEligibleVehicles));
  const selfRet = Math.max(0, Math.min(eligible, Math.round(input.retainedAtSelfWorkshop)));
  const w2Ret = Math.max(selfRet, Math.min(eligible, Math.round(input.retainedWithinParentW2)));
  const westRet = Math.max(w2Ret, Math.min(eligible, Math.round(input.retainedWithinWestZone)));

  const pct = (n: number) => Math.round((n / eligible) * 1000) / 10;

  return {
    ...input,
    totalEligibleVehicles: eligible,
    retainedAtSelfWorkshop: selfRet,
    retainedWithinParentW2: w2Ret,
    retainedWithinWestZone: westRet,
    selfRetentionPct: pct(selfRet),
    parentW2RetentionPct: pct(w2Ret),
    westZoneRetentionPct: pct(westRet),
    servicedAtSisterW2Workshop: w2Ret - selfRet,
    leakedToCompetitorDealerInWest: westRet - w2Ret,
    lostOutsideZoneOrIndependent: eligible - westRet,
  };
}

export interface WorkshopPmsGainLossRow {
  workshopCode: string;
  workshopName: string;
  cluster: "Pune West" | "Pune East" | "PCMC";
  period: "Month (Oct 2026)" | "YTD (Apr–Oct 2026)";
  eligibleDueBase: number;
  retainedOwnCustomers: number;
  gainedFromSisterW2: number;
  gainedFromCompetitorDealer: number;
  reactivatedWinback: number;
  lostToSisterW2: number;
  lostToCompetitorOrLapsed: number;
}

export interface WorkshopPmsGainLossComputed extends WorkshopPmsGainLossRow {
  totalPmsDone: number;
  grossGains: number;
  grossLosses: number;
  netPmsGainLoss: number;
  selfRetentionPct: number;
  netCapturePct: number;
}

/**
 * IDEA-021: Compute PMS Gain/Loss waterfall per workshop for Month and YTD.
 */
export function computePmsGainLoss(row: WorkshopPmsGainLossRow): WorkshopPmsGainLossComputed {
  const base = Math.max(1, Math.round(row.eligibleDueBase));
  const retained = Math.max(0, Math.round(row.retainedOwnCustomers));
  const gainSister = Math.max(0, Math.round(row.gainedFromSisterW2));
  const gainComp = Math.max(0, Math.round(row.gainedFromCompetitorDealer));
  const gainWinback = Math.max(0, Math.round(row.reactivatedWinback));
  const lossSister = Math.max(0, Math.round(row.lostToSisterW2));
  const lossComp = Math.max(0, Math.round(row.lostToCompetitorOrLapsed));

  const grossGains = gainSister + gainComp + gainWinback;
  const grossLosses = lossSister + lossComp;
  const totalPmsDone = retained + grossGains;
  const netPmsGainLoss = grossGains - grossLosses;

  return {
    ...row,
    totalPmsDone,
    grossGains,
    grossLosses,
    netPmsGainLoss,
    selfRetentionPct: Math.round((retained / base) * 1000) / 10,
    netCapturePct: Math.round((totalPmsDone / base) * 1000) / 10,
  };
}

export interface FrMaturitySummary {
  stage: "FR1 (2 Months)" | "FR2 (8 Months)" | "FR3 (14 Months)" | "FR3 → PMS1 Paid Conversion";
  maturedDeliveries: number;
  completedOnTime: number;
  completedLate: number;
  missedOrPending: number;
  conversionPct: number;
}

export function computeFrMaturity(
  stage: FrMaturitySummary["stage"],
  maturedDeliveries: number,
  completedOnTime: number,
  completedLate: number,
): FrMaturitySummary {
  const mat = Math.max(1, Math.round(maturedDeliveries));
  const onTime = Math.max(0, Math.min(mat, Math.round(completedOnTime)));
  const late = Math.max(0, Math.min(mat - onTime, Math.round(completedLate)));
  const missed = Math.max(0, mat - onTime - late);
  const conversionPct = Math.round(((onTime + late) / mat) * 1000) / 10;
  return {
    stage,
    maturedDeliveries: mat,
    completedOnTime: onTime,
    completedLate: late,
    missedOrPending: missed,
    conversionPct,
  };
}

// ---------------------------------------------------------------------------
// Seeded Dealership Reference Data (7 Sehgal Autoriders Maruti Workshops)
// ---------------------------------------------------------------------------

export const DEFAULT_WATERFALL_INPUT: ActiveBaseWaterfallInput = {
  monthLabel: "October 2026 (Rolling 15-Month Active Window)",
  openingActiveBase: 54420,
  newFirstFreeEntries: 1840,
  reactivatedFromNonFocused: 490,
  transferredInFromCluster: 215,
  lapsedBeyond15m: 1680,
  movedToArchiveBeyond36m: 410,
};

export const NESTED_RETENTION_ROWS: NestedRetentionInput[] = [
  {
    workshopCode: "1913",
    workshopName: "1913 · PMB (Pimpri Main)",
    totalEligibleVehicles: 11200,
    retainedAtSelfWorkshop: 8064,
    retainedWithinParentW2: 9408,
    retainedWithinWestZone: 10192,
  },
  {
    workshopCode: "19NE",
    workshopName: "19NE · PUO (Pune Outlet)",
    totalEligibleVehicles: 8600,
    retainedAtSelfWorkshop: 6106,
    retainedWithinParentW2: 7224,
    retainedWithinWestZone: 7826,
  },
  {
    workshopCode: "BSV1",
    workshopName: "BSV1 · Bavdhan Workshop",
    totalEligibleVehicles: 9400,
    retainedAtSelfWorkshop: 7050,
    retainedWithinParentW2: 8178,
    retainedWithinWestZone: 8648,
  },
  {
    workshopCode: "BZK1",
    workshopName: "BZK1 · Chinchwad Workshop",
    totalEligibleVehicles: 7800,
    retainedAtSelfWorkshop: 5616,
    retainedWithinParentW2: 6630,
    retainedWithinWestZone: 7098,
  },
  {
    workshopCode: "CEA1",
    workshopName: "CEA1 · Manjri Workshop",
    totalEligibleVehicles: 6900,
    retainedAtSelfWorkshop: 5106,
    retainedWithinParentW2: 5934,
    retainedWithinWestZone: 6348,
  },
  {
    workshopCode: "CGA1",
    workshopName: "CGA1 · Wagholi Workshop",
    totalEligibleVehicles: 5600,
    retainedAtSelfWorkshop: 3976,
    retainedWithinParentW2: 4704,
    retainedWithinWestZone: 5096,
  },
  {
    workshopCode: "CGAN",
    workshopName: "CGAN · Nexa Service",
    totalEligibleVehicles: 5375,
    retainedAtSelfWorkshop: 4139,
    retainedWithinParentW2: 4676,
    retainedWithinWestZone: 4999,
  },
];

export const WORKSHOP_PMS_ROWS: WorkshopPmsGainLossRow[] = [
  {
    workshopCode: "1913",
    workshopName: "1913 · PMB (Pimpri Main)",
    cluster: "PCMC",
    period: "Month (Oct 2026)",
    eligibleDueBase: 940,
    retainedOwnCustomers: 695,
    gainedFromSisterW2: 68,
    gainedFromCompetitorDealer: 54,
    reactivatedWinback: 42,
    lostToSisterW2: 51,
    lostToCompetitorOrLapsed: 94,
  },
  {
    workshopCode: "19NE",
    workshopName: "19NE · PUO (Pune Outlet)",
    cluster: "Pune West",
    period: "Month (Oct 2026)",
    eligibleDueBase: 720,
    retainedOwnCustomers: 518,
    gainedFromSisterW2: 49,
    gainedFromCompetitorDealer: 38,
    reactivatedWinback: 31,
    lostToSisterW2: 44,
    lostToCompetitorOrLapsed: 78,
  },
  {
    workshopCode: "BSV1",
    workshopName: "BSV1 · Bavdhan Workshop",
    cluster: "Pune West",
    period: "Month (Oct 2026)",
    eligibleDueBase: 810,
    retainedOwnCustomers: 615,
    gainedFromSisterW2: 62,
    gainedFromCompetitorDealer: 59,
    reactivatedWinback: 39,
    lostToSisterW2: 38,
    lostToCompetitorOrLapsed: 67,
  },
  {
    workshopCode: "BZK1",
    workshopName: "BZK1 · Chinchwad Workshop",
    cluster: "PCMC",
    period: "Month (Oct 2026)",
    eligibleDueBase: 650,
    retainedOwnCustomers: 468,
    gainedFromSisterW2: 44,
    gainedFromCompetitorDealer: 36,
    reactivatedWinback: 28,
    lostToSisterW2: 39,
    lostToCompetitorOrLapsed: 63,
  },
  {
    workshopCode: "CEA1",
    workshopName: "CEA1 · Manjri Workshop",
    cluster: "Pune East",
    period: "Month (Oct 2026)",
    eligibleDueBase: 590,
    retainedOwnCustomers: 442,
    gainedFromSisterW2: 37,
    gainedFromCompetitorDealer: 48,
    reactivatedWinback: 34,
    lostToSisterW2: 29,
    lostToCompetitorOrLapsed: 55,
  },
  {
    workshopCode: "CGA1",
    workshopName: "CGA1 · Wagholi Workshop",
    cluster: "Pune East",
    period: "Month (Oct 2026)",
    eligibleDueBase: 480,
    retainedOwnCustomers: 341,
    gainedFromSisterW2: 31,
    gainedFromCompetitorDealer: 39,
    reactivatedWinback: 24,
    lostToSisterW2: 27,
    lostToCompetitorOrLapsed: 52,
  },
  {
    workshopCode: "CGAN",
    workshopName: "CGAN · Nexa Service",
    cluster: "Pune West",
    period: "Month (Oct 2026)",
    eligibleDueBase: 460,
    retainedOwnCustomers: 358,
    gainedFromSisterW2: 29,
    gainedFromCompetitorDealer: 41,
    reactivatedWinback: 22,
    lostToSisterW2: 19,
    lostToCompetitorOrLapsed: 38,
  },
  // YTD rows
  {
    workshopCode: "1913",
    workshopName: "1913 · PMB (Pimpri Main)",
    cluster: "PCMC",
    period: "YTD (Apr–Oct 2026)",
    eligibleDueBase: 6420,
    retainedOwnCustomers: 4686,
    gainedFromSisterW2: 448,
    gainedFromCompetitorDealer: 372,
    reactivatedWinback: 285,
    lostToSisterW2: 350,
    lostToCompetitorOrLapsed: 644,
  },
  {
    workshopCode: "19NE",
    workshopName: "19NE · PUO (Pune Outlet)",
    cluster: "Pune West",
    period: "YTD (Apr–Oct 2026)",
    eligibleDueBase: 4950,
    retainedOwnCustomers: 3564,
    gainedFromSisterW2: 332,
    gainedFromCompetitorDealer: 264,
    reactivatedWinback: 210,
    lostToSisterW2: 298,
    lostToCompetitorOrLapsed: 530,
  },
  {
    workshopCode: "BSV1",
    workshopName: "BSV1 · Bavdhan Workshop",
    cluster: "Pune West",
    period: "YTD (Apr–Oct 2026)",
    eligibleDueBase: 5540,
    retainedOwnCustomers: 4188,
    gainedFromSisterW2: 412,
    gainedFromCompetitorDealer: 398,
    reactivatedWinback: 268,
    lostToSisterW2: 260,
    lostToCompetitorOrLapsed: 462,
  },
  {
    workshopCode: "BZK1",
    workshopName: "BZK1 · Chinchwad Workshop",
    cluster: "PCMC",
    period: "YTD (Apr–Oct 2026)",
    eligibleDueBase: 4480,
    retainedOwnCustomers: 3225,
    gainedFromSisterW2: 304,
    gainedFromCompetitorDealer: 248,
    reactivatedWinback: 192,
    lostToSisterW2: 268,
    lostToCompetitorOrLapsed: 435,
  },
  {
    workshopCode: "CEA1",
    workshopName: "CEA1 · Manjri Workshop",
    cluster: "Pune East",
    period: "YTD (Apr–Oct 2026)",
    eligibleDueBase: 4060,
    retainedOwnCustomers: 3024,
    gainedFromSisterW2: 254,
    gainedFromCompetitorDealer: 326,
    reactivatedWinback: 228,
    lostToSisterW2: 198,
    lostToCompetitorOrLapsed: 382,
  },
  {
    workshopCode: "CGA1",
    workshopName: "CGA1 · Wagholi Workshop",
    cluster: "Pune East",
    period: "YTD (Apr–Oct 2026)",
    eligibleDueBase: 3310,
    retainedOwnCustomers: 2350,
    gainedFromSisterW2: 212,
    gainedFromCompetitorDealer: 268,
    reactivatedWinback: 164,
    lostToSisterW2: 186,
    lostToCompetitorOrLapsed: 360,
  },
  {
    workshopCode: "CGAN",
    workshopName: "CGAN · Nexa Service",
    cluster: "Pune West",
    period: "YTD (Apr–Oct 2026)",
    eligibleDueBase: 3180,
    retainedOwnCustomers: 2464,
    gainedFromSisterW2: 198,
    gainedFromCompetitorDealer: 284,
    reactivatedWinback: 152,
    lostToSisterW2: 132,
    lostToCompetitorOrLapsed: 264,
  },
];

export const FR_MATURITY_ROWS: FrMaturitySummary[] = [
  computeFrMaturity("FR1 (2 Months)", 1920, 1748, 96),
  computeFrMaturity("FR2 (8 Months)", 1810, 1575, 118),
  computeFrMaturity("FR3 (14 Months)", 1690, 1402, 135),
  computeFrMaturity("FR3 → PMS1 Paid Conversion", 1537, 1168, 154),
];

export const SAMPLE_COHORT_CUSTOMERS: CustomerScoringInput[] = [
  {
    id: "cust-001",
    regNo: "MH12XY4821",
    customerName: "Rajesh Kulkarni (Test Frame)",
    mobile: "8888869529",
    workshopCode: "BSV1",
    workshopName: "BSV1 · Bavdhan Workshop",
    model: "Grand Vitara Zeta",
    monthsSinceLastVisit: 5.5,
    runningKmPerMonth: 1850,
    daysToNextDue: 6,
    lastServiceStage: "FR3",
    dimensions: {
      recency: 96,
      running_km: 94,
      pms_continuity: 92,
      psf_satisfaction: 42,
      visit_tat: 38,
      whatsapp_pingmate: 45,
    },
    convertedInWindow: true,
  },
  {
    id: "cust-002",
    regNo: "MH14KL9032",
    customerName: "Sandeep Deshmukh (Test Frame)",
    mobile: "8888881327",
    workshopCode: "1913",
    workshopName: "1913 · PMB (Pimpri Main)",
    model: "Brezza ZXi",
    monthsSinceLastVisit: 11.2,
    runningKmPerMonth: 920,
    daysToNextDue: 14,
    lastServiceStage: "PMS1",
    dimensions: {
      recency: 88,
      running_km: 76,
      pms_continuity: 90,
      psf_satisfaction: 85,
      visit_tat: 80,
      whatsapp_pingmate: 78,
    },
    convertedInWindow: true,
  },
  {
    id: "cust-003",
    regNo: "MH12AB7719",
    customerName: "Amita Joshi (Test Frame)",
    mobile: "8888869529",
    workshopCode: "CEA1",
    workshopName: "CEA1 · Manjri Workshop",
    model: "Ertiga VXi CNG",
    monthsSinceLastVisit: 8.0,
    runningKmPerMonth: 2150,
    daysToNextDue: 35,
    lastServiceStage: "PMS2",
    dimensions: {
      recency: 82,
      running_km: 98,
      pms_continuity: 86,
      psf_satisfaction: 74,
      visit_tat: 70,
      whatsapp_pingmate: 68,
    },
    convertedInWindow: true,
  },
  {
    id: "cust-004",
    regNo: "MH14GH3310",
    customerName: "Vikram Shinde (Test Frame)",
    mobile: "8888881327",
    workshopCode: "BZK1",
    workshopName: "BZK1 · Chinchwad Workshop",
    model: "Swift VXi",
    monthsSinceLastVisit: 10.5,
    runningKmPerMonth: 780,
    daysToNextDue: 42,
    lastServiceStage: "PMS1",
    dimensions: {
      recency: 79,
      running_km: 68,
      pms_continuity: 84,
      psf_satisfaction: 82,
      visit_tat: 76,
      whatsapp_pingmate: 72,
    },
    convertedInWindow: true,
  },
  {
    id: "cust-005",
    regNo: "MH12PQ6104",
    customerName: "Prashant More (Test Frame)",
    mobile: "8888869529",
    workshopCode: "19NE",
    workshopName: "19NE · PUO (Pune Outlet)",
    model: "Baleno Alpha",
    monthsSinceLastVisit: 21.4,
    runningKmPerMonth: 640,
    daysToNextDue: -110,
    lastServiceStage: "PMS2",
    dimensions: {
      recency: 45,
      running_km: 52,
      pms_continuity: 48,
      psf_satisfaction: 78,
      visit_tat: 74,
      whatsapp_pingmate: 70,
    },
    convertedInWindow: false,
  },
  {
    id: "cust-006",
    regNo: "MH12CD1198",
    customerName: "NitinPatil Fleet (Test Frame)",
    mobile: "8888881327",
    workshopCode: "CGA1",
    workshopName: "CGA1 · Wagholi Workshop",
    model: "WagonR ZXi",
    monthsSinceLastVisit: 41.0,
    runningKmPerMonth: 510,
    daysToNextDue: -480,
    lastServiceStage: "PMS3+",
    dimensions: {
      recency: 18,
      running_km: 40,
      pms_continuity: 22,
      psf_satisfaction: 80,
      visit_tat: 79,
      whatsapp_pingmate: 65,
    },
    convertedInWindow: false,
  },
];
