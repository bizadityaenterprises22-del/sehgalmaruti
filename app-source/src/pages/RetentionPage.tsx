import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Badge, Button, Note, Section, Segmented, Select, Stat, Table, Td } from "@/components/ui";
import {
  COHORT_META,
  DEFAULT_WATERFALL_INPUT,
  FR_MATURITY_ROWS,
  NESTED_RETENTION_ROWS,
  SAMPLE_COHORT_CUSTOMERS,
  WORKSHOP_PMS_ROWS,
  computeActiveBaseWaterfall,
  computeDimensionUplift,
  computeNestedRetention,
  computePmsGainLoss,
  rankCallQueue,
  type CustomerCohort,
} from "@/lib/retention";

type RetTab = "pms" | "cohorts" | "uplift" | "queue";

const WORKSHOPS = [
  { code: "ALL", label: "All 7 Workshops (W2 Group)" },
  { code: "1913", label: "1913 · PMB (Pimpri Main)" },
  { code: "19NE", label: "19NE · PUO (Pune Outlet)" },
  { code: "BSV1", label: "BSV1 · Bavdhan Workshop" },
  { code: "BZK1", label: "BZK1 · Chinchwad Workshop" },
  { code: "CEA1", label: "CEA1 · Manjri Workshop" },
  { code: "CGA1", label: "CGA1 · Wagholi Workshop" },
  { code: "CGAN", label: "CGAN · Nexa Service" },
] as const;

export default function RetentionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as RetTab | null) ?? "pms";
  const tab: RetTab = ["pms", "cohorts", "uplift", "queue"].includes(initialTab) ? initialTab : "pms";

  const [workshopCode, setWorkshopCode] = useState<string>("ALL");
  const [period, setPeriod] = useState<"Month (Oct 2026)" | "YTD (Apr–Oct 2026)">("Month (Oct 2026)");
  const [cohortFilter, setCohortFilter] = useState<CustomerCohort | "ALL">("ALL");
  const [loggedCalls, setLoggedCalls] = useState<Record<string, string>>({});

  function setTab(next: RetTab) {
    setSearchParams({ tab: next }, { replace: true });
  }

  const waterfall = useMemo(() => computeActiveBaseWaterfall(DEFAULT_WATERFALL_INPUT), []);

  const nestedRows = useMemo(() => {
    const src =
      workshopCode === "ALL"
        ? NESTED_RETENTION_ROWS
        : NESTED_RETENTION_ROWS.filter((r) => r.workshopCode === workshopCode);
    return src.map(computeNestedRetention);
  }, [workshopCode]);

  const pmsRows = useMemo(() => {
    return WORKSHOP_PMS_ROWS.filter(
      (r) => r.period === period && (workshopCode === "ALL" || r.workshopCode === workshopCode),
    ).map(computePmsGainLoss);
  }, [period, workshopCode]);

  const pmsTotals = useMemo(() => {
    return pmsRows.reduce(
      (acc, r) => ({
        eligible: acc.eligible + r.eligibleDueBase,
        retained: acc.retained + r.retainedOwnCustomers,
        gains: acc.gains + r.grossGains,
        losses: acc.losses + r.grossLosses,
        totalDone: acc.totalDone + r.totalPmsDone,
        net: acc.net + r.netPmsGainLoss,
      }),
      { eligible: 0, retained: 0, gains: 0, losses: 0, totalDone: 0, net: 0 },
    );
  }, [pmsRows]);

  const upliftRows = useMemo(() => computeDimensionUplift(SAMPLE_COHORT_CUSTOMERS), []);

  const rankedQueue = useMemo(() => {
    const all = rankCallQueue(SAMPLE_COHORT_CUSTOMERS);
    return all.filter(
      (c) =>
        (workshopCode === "ALL" || c.workshopCode === workshopCode) &&
        (cohortFilter === "ALL" || c.cohort === cohortFilter),
    );
  }, [workshopCode, cohortFilter]);

  return (
    <div className="mx-auto max-w-[1180px] space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-extrabold text-brand dark:text-accent">
            Retention, PMS Gain/Loss & SMR Cohort Engine
          </h1>
          <p className="text-[12.5px] text-muted">
            West2 Portal RetentionFinal1 + CRM Calling · Self vs Parent (W2) vs West Zone · 54k–55k Active Base
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={workshopCode}
            onChange={(e) => setWorkshopCode(e.target.value)}
            aria-label="Filter workshop"
            className="w-auto min-w-[210px] py-1.5 text-[13px] font-bold"
          >
            {WORKSHOPS.map((w) => (
              <option key={w.code} value={w.code}>
                {w.label}
              </option>
            ))}
          </Select>
          <Segmented<RetTab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "pms", label: "📊 PMS & Gain/Loss" },
              { value: "cohorts", label: "🎯 Active Cohorts (54k)" },
              { value: "uplift", label: "📈 Dimension Uplift" },
              { value: "queue", label: "📞 Priority Call Queue" },
            ]}
          />
        </div>
      </div>

      {tab === "pms" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Eligible Due Base" value={pmsTotals.eligible.toLocaleString("en-IN")} />
            <Stat label="Retained (Self)" value={pmsTotals.retained.toLocaleString("en-IN")} tone="ok" />
            <Stat label="Gross Gains (+W2/Comp)" value={`+${pmsTotals.gains.toLocaleString("en-IN")}`} tone="ok" />
            <Stat label="Gross Losses" value={`-${pmsTotals.losses.toLocaleString("en-IN")}`} tone="warn" />
            <Stat label="Total PMS Done" value={pmsTotals.totalDone.toLocaleString("en-IN")} />
            <Stat
              label="Net PMS Gain / Loss"
              value={`${pmsTotals.net >= 0 ? "+" : ""}${pmsTotals.net.toLocaleString("en-IN")}`}
              tone={pmsTotals.net >= 0 ? "ok" : "warn"}
            />
          </div>

          <Section
            title="Workshop PMS Gain / Loss Waterfall (IDEA-021)"
            sub="Tracks retained own customers, inflows from sister W2 workshops or competitors, and outflows."
            right={
              <Segmented
                value={period}
                onChange={setPeriod}
                options={[
                  { value: "Month (Oct 2026)", label: "Month (Oct 2026)" },
                  { value: "YTD (Apr–Oct 2026)", label: "YTD (Apr–Oct 2026)" },
                ]}
              />
            }
          >
            <Table
              head={[
                "Workshop",
                "Cluster",
                "Due Base",
                "Retained (Self)",
                "Self %",
                "+Sister W2",
                "+Competitor",
                "+Winback",
                "-Sister W2",
                "-Lapsed/Comp",
                "Total PMS",
                "Net Gain/Loss",
                "Capture %",
              ]}
            >
              {pmsRows.map((r) => (
                <tr key={`${r.workshopCode}-${r.period}`} className="hover:bg-surface">
                  <Td className="font-bold">{r.workshopName}</Td>
                  <Td>{r.cluster}</Td>
                  <Td className="tabular-nums font-semibold">{r.eligibleDueBase.toLocaleString("en-IN")}</Td>
                  <Td className="tabular-nums text-ok font-bold">{r.retainedOwnCustomers.toLocaleString("en-IN")}</Td>
                  <Td className="tabular-nums">{r.selfRetentionPct.toFixed(1)}%</Td>
                  <Td className="tabular-nums text-ok">+{r.gainedFromSisterW2}</Td>
                  <Td className="tabular-nums text-ok">+{r.gainedFromCompetitorDealer}</Td>
                  <Td className="tabular-nums text-ok">+{r.reactivatedWinback}</Td>
                  <Td className="tabular-nums text-warn">-{r.lostToSisterW2}</Td>
                  <Td className="tabular-nums text-danger">-{r.lostToCompetitorOrLapsed}</Td>
                  <Td className="tabular-nums font-extrabold">{r.totalPmsDone.toLocaleString("en-IN")}</Td>
                  <Td className="tabular-nums">
                    <Badge tone={r.netPmsGainLoss >= 0 ? "ok" : "danger"}>
                      {r.netPmsGainLoss >= 0 ? `+${r.netPmsGainLoss}` : r.netPmsGainLoss}
                    </Badge>
                  </Td>
                  <Td className="tabular-nums font-bold">{r.netCapturePct.toFixed(1)}%</Td>
                </tr>
              ))}
            </Table>
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section
              title="Nested Retention: Self vs Parent (W2) vs West Zone"
              sub="Nested concentric levels (Self <= Parent W2 <= West Zone). Never added together."
            >
              <Table
                head={[
                  "Workshop",
                  "Eligible",
                  "Self %",
                  "Parent (W2) %",
                  "West Zone %",
                  "At Sister W2",
                  "Outside W2",
                ]}
              >
                {nestedRows.map((r) => (
                  <tr key={r.workshopCode} className="hover:bg-surface">
                    <Td className="font-bold">{r.workshopName}</Td>
                    <Td className="tabular-nums">{r.totalEligibleVehicles.toLocaleString("en-IN")}</Td>
                    <Td className="tabular-nums font-bold text-ok">{r.selfRetentionPct.toFixed(1)}%</Td>
                    <Td className="tabular-nums font-bold text-accent">{r.parentW2RetentionPct.toFixed(1)}%</Td>
                    <Td className="tabular-nums font-semibold">{r.westZoneRetentionPct.toFixed(1)}%</Td>
                    <Td className="tabular-nums">{r.servicedAtSisterW2Workshop.toLocaleString("en-IN")}</Td>
                    <Td className="tabular-nums text-danger">
                      {(r.leakedToCompetitorDealerInWest + r.lostOutsideZoneOrIndependent).toLocaleString("en-IN")}
                    </Td>
                  </tr>
                ))}
              </Table>
            </Section>

            <Section
              title="Free Service Maturity Windows (FR1 · FR2 · FR3 → PMS1)"
              sub="Maturity tracked at 2, 8, and 14 months from delivery before first paid PMS."
            >
              <Table head={["Maturity Stage", "Matured", "On-Time", "Late", "Missed", "Conversion %"]}>
                {FR_MATURITY_ROWS.map((f) => (
                  <tr key={f.stage} className="hover:bg-surface">
                    <Td className="font-bold">{f.stage}</Td>
                    <Td className="tabular-nums">{f.maturedDeliveries.toLocaleString("en-IN")}</Td>
                    <Td className="tabular-nums text-ok font-semibold">{f.completedOnTime.toLocaleString("en-IN")}</Td>
                    <Td className="tabular-nums text-warn">{f.completedLate.toLocaleString("en-IN")}</Td>
                    <Td className="tabular-nums text-danger">{f.missedOrPending.toLocaleString("en-IN")}</Td>
                    <Td className="tabular-nums">
                      <Badge tone={f.conversionPct >= 90 ? "ok" : "warn"}>{f.conversionPct.toFixed(1)}%</Badge>
                    </Td>
                  </tr>
                ))}
              </Table>
            </Section>
          </div>
        </div>
      ) : null}

      {tab === "cohorts" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Opening Active Base" value={waterfall.openingActiveBase.toLocaleString("en-IN")} />
            <Stat label="+ New FR1 Entries" value={`+${waterfall.newFirstFreeEntries.toLocaleString("en-IN")}`} tone="ok" />
            <Stat
              label="+ Winback / Cluster"
              value={`+${(waterfall.reactivatedFromNonFocused + waterfall.transferredInFromCluster).toLocaleString("en-IN")}`}
              tone="ok"
            />
            <Stat label="- Lapsed (>15m)" value={`-${waterfall.lapsedBeyond15m.toLocaleString("en-IN")}`} tone="warn" />
            <Stat
              label="- Moved to Archive (>36m)"
              value={`-${waterfall.movedToArchiveBeyond36m.toLocaleString("en-IN")}`}
              tone="warn"
            />
            <Stat
              label="Closing Active Base"
              value={waterfall.closingActiveBase.toLocaleString("en-IN")}
              tone={waterfall.withinTargetBand ? "ok" : "warn"}
            />
          </div>

          <Note tone={waterfall.withinTargetBand ? "ok" : "warn"}>
            <strong>Rolling Active Base Control ({waterfall.monthLabel}):</strong> Closing active base is{" "}
            <strong>{waterfall.closingActiveBase.toLocaleString("en-IN")}</strong> vehicles (net{" "}
            {waterfall.netChange >= 0 ? `+${waterfall.netChange}` : waterfall.netChange}), inside the target{" "}
            <strong>{waterfall.targetBandLabel}</strong> band. Vehicles inactive beyond 36 months are automatically
            transferred to the <strong>Archive / New Sales Lead</strong> lane so SMRE callers focus on high-conversion
            cohorts.
          </Note>

          <Section
            title="Five Operational Customer Cohorts (IDEA-023)"
            sub="Every customer is dynamically assigned to one cohort based on recency, monthly running KM, and next due date."
          >
            <Table head={["Cohort Segment", "Eligibility Rule", "Operational Calling Strategy", "Queue Action"]}>
              {(Object.keys(COHORT_META) as CustomerCohort[]).map((key) => {
                const m = COHORT_META[key];
                return (
                  <tr key={key} className="hover:bg-surface">
                    <Td className="font-bold">
                      <Badge tone={m.badgeTone}>{m.label}</Badge>
                    </Td>
                    <Td className="font-semibold">{m.windowLabel}</Td>
                    <Td>{m.conversionHint}</Td>
                    <Td>
                      <Button
                        size="sm"
                        tone="secondary"
                        onClick={() => {
                          setCohortFilter(key);
                          setTab("queue");
                        }}
                      >
                        Open in Queue →
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </Table>
          </Section>
        </div>
      ) : null}

      {tab === "uplift" ? (
        <div className="space-y-4">
          <Note tone="info">
            <strong>No-Pull-Down Scoring Law (IDEA-022):</strong> Adding extra dimensions to a calling score must never
            dilute or pull down a customer who is urgently due by date or running KM. Core dimensions (
            <strong>Recency</strong>, <strong>Running KM</strong>, <strong>PMS Continuity</strong>) set the base urgency
            score; secondary dimensions act strictly as <strong>+0..5 pt tie-breakers</strong>.
          </Note>

          <Section
            title="Dimension-by-Dimension Conversion Uplift Audit"
            sub="Compares converted vs non-converted customer scores across all 6 dimensions before assigning weights."
          >
            <Table
              head={[
                "Scoring Dimension",
                "Role",
                "Converted Avg",
                "Non-Converted Avg",
                "Separation (Δ)",
                "High-Band Conv %",
                "Low-Band Conv %",
                "Uplift (pp)",
                "Signal Verdict",
                "Weight",
              ]}
            >
              {upliftRows.map((r) => (
                <tr key={r.key} className="hover:bg-surface">
                  <Td className="font-bold">{r.label}</Td>
                  <Td>
                    <Badge tone={r.role === "core" ? "brand" : "muted"}>
                      {r.role === "core" ? "Core Driver" : "Tie-Breaker Only"}
                    </Badge>
                  </Td>
                  <Td className="tabular-nums font-bold text-ok">{r.convertedAvgScore.toFixed(1)}</Td>
                  <Td className="tabular-nums text-muted">{r.nonConvertedAvgScore.toFixed(1)}</Td>
                  <Td className="tabular-nums font-semibold">
                    {r.scoreSeparation >= 0 ? `+${r.scoreSeparation.toFixed(1)}` : r.scoreSeparation.toFixed(1)}
                  </Td>
                  <Td className="tabular-nums">{r.highBandConversionPct.toFixed(1)}%</Td>
                  <Td className="tabular-nums">{r.lowBandConversionPct.toFixed(1)}%</Td>
                  <Td className="tabular-nums font-bold">
                    {r.upliftPctPoints >= 0 ? `+${r.upliftPctPoints.toFixed(1)} pp` : `${r.upliftPctPoints.toFixed(1)} pp`}
                  </Td>
                  <Td>
                    {r.noisy ? (
                      <Badge tone="warn">Noisy · Zero-Weighted</Badge>
                    ) : (
                      <Badge tone="ok">Strong Uplift Signal</Badge>
                    )}
                  </Td>
                  <Td className="tabular-nums font-bold">{r.recommendedWeight}%</Td>
                </tr>
              ))}
            </Table>
          </Section>
        </div>
      ) : null}

      {tab === "queue" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Note tone="info">
              <strong>Test-Recipient Safeguard (Ravi 09-10-2026):</strong> All test probes in this queue are locked to{" "}
              <code>8888869529</code> and <code>8888881327</code>. Dormant records (&gt;36m) are automatically
              suppressed to the bottom and marked for New Sales Exchange.
            </Note>
            <Select
              value={cohortFilter}
              onChange={(e) => setCohortFilter(e.target.value as CustomerCohort | "ALL")}
              aria-label="Filter cohort"
              className="w-auto min-w-[220px] py-1.5 text-[13px] font-bold"
            >
              <option value="ALL">All Cohorts ({SAMPLE_COHORT_CUSTOMERS.length})</option>
              {(Object.keys(COHORT_META) as CustomerCohort[]).map((k) => (
                <option key={k} value={k}>
                  {COHORT_META[k].label}
                </option>
              ))}
            </Select>
          </div>

          <Section
            title="Prioritized SMR Calling Queue (IDEA-020 / IDEA-022 / IDEA-023)"
            sub="Ranked by Protected Final Priority Score so high-urgency vehicles always sit at the top of the list."
          >
            <Table
              head={[
                "Rank",
                "Reg No & Model",
                "Customer (Test-Safe)",
                "Workshop",
                "Cohort",
                "Usage & Due",
                "Naive 6-Dim Avg",
                "Protected Score",
                "Recommended Action",
                "Disposition",
              ]}
            >
              {rankedQueue.map((c, idx) => {
                const meta = COHORT_META[c.cohort];
                const disp = loggedCalls[c.id];
                return (
                  <tr key={c.id} className="hover:bg-surface">
                    <Td className="font-extrabold tabular-nums">#{idx + 1}</Td>
                    <Td>
                      <div className="font-extrabold text-brand dark:text-accent">{c.regNo}</div>
                      <div className="text-[11.5px] text-muted">
                        {c.model} · Last: {c.lastServiceStage}
                      </div>
                    </Td>
                    <Td>
                      <div className="font-bold">{c.customerName}</div>
                      <div className="font-mono text-[11.5px] text-muted">{c.mobile}</div>
                    </Td>
                    <Td className="font-semibold">{c.workshopCode}</Td>
                    <Td>
                      <Badge tone={meta.badgeTone}>{meta.label}</Badge>
                    </Td>
                    <Td className="tabular-nums text-[12px]">
                      <div>
                        <strong>{c.runningKmPerMonth}</strong> km/m · <strong>{c.monthsSinceLastVisit}m</strong> ago
                      </div>
                      <div className="text-muted">
                        {c.daysToNextDue >= 0 ? `Due in ${c.daysToNextDue}d` : `Overdue ${Math.abs(c.daysToNextDue)}d`}
                      </div>
                    </Td>
                    <Td className="tabular-nums text-muted">{c.naiveAllDimensionAverage.toFixed(1)}</Td>
                    <Td className="tabular-nums">
                      <div className="font-extrabold text-[14px] text-ok">{c.finalPriorityScore.toFixed(1)}</div>
                      {c.protectedFromPullDown ? (
                        <span className="text-[10.5px] font-bold text-accent">✓ Pull-down protected</span>
                      ) : null}
                    </Td>
                    <Td className="max-w-[220px] text-[12px] font-semibold">{c.callAction}</Td>
                    <Td>
                      {disp ? (
                        <Badge tone="ok">{disp}</Badge>
                      ) : c.cohort === "archive_sales_lead" ? (
                        <Button
                          size="sm"
                          tone="secondary"
                          onClick={() => setLoggedCalls((s) => ({ ...s, [c.id]: "Routed to Sales Exchange" }))}
                        >
                          Send to Sales
                        </Button>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            tone="ok"
                            onClick={() => setLoggedCalls((s) => ({ ...s, [c.id]: "Booked PMS Slot" }))}
                          >
                            Book Slot
                          </Button>
                          <Button
                            size="sm"
                            tone="secondary"
                            onClick={() => setLoggedCalls((s) => ({ ...s, [c.id]: "Follow-up Set" }))}
                          >
                            Follow-up
                          </Button>
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </Table>
          </Section>
        </div>
      ) : null}
    </div>
  );
}
