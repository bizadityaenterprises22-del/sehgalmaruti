import { describe, expect, it } from "vitest";
import {
  SEARCH_LIMIT,
  fetchIsConsultant,
  fetchVehicleHistory,
  fetchVehicleSearch,
  holdsAnything,
  isSearchableQuery,
  openKeyOf,
  vehicleKey,
  type RpcClient,
} from "./vehicleHistoryApi";

/** A fake client that records every call and answers with whatever the test hands it. */
function fake(answer: { data?: unknown; error?: { message: string } | null } | Error) {
  const calls: { fn: string; args?: Record<string, unknown> }[] = [];
  const client: RpcClient = {
    rpc: (fn, args) => {
      calls.push({ fn, args });
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null });
    },
  };
  return { client, calls };
}

const searchAnswer = (extra: object = {}) => ({
  query: "9000000001",
  searched_as: "mobile",
  scope: { mode: "tenant", tenant_code: "sehgal_maruti" },
  total: 1,
  results: [{ registration: "MH12AA0001" }],
  ...extra,
});

describe("search text rules", () => {
  it("counts letters and digits only, like the server", () => {
    expect(vehicleKey("mh 12-aa 0001")).toBe("MH12AA0001");
    expect(isSearchableQuery("ab")).toBe(false);
    expect(isSearchableQuery("+ 9 -")).toBe(false);
    expect(isSearchableQuery("a b 1")).toBe(true);
  });
});

describe("fetchVehicleSearch", () => {
  it("refuses a too-short query without calling the server", async () => {
    const { client, calls } = fake({ data: searchAnswer() });
    await expect(fetchVehicleSearch(client, " a1 ", null)).rejects.toThrow("Type at least 3 letters or digits");
    expect(calls).toHaveLength(0);
  });

  it("sends the trimmed text, the tenant and the limit", async () => {
    const { client, calls } = fake({ data: searchAnswer() });
    await fetchVehicleSearch(client, "  +91 90000-00001 ", "sehgal_maruti");
    expect(calls).toEqual([
      { fn: "vehicle_history_search", args: { p_query: "+91 90000-00001", p_tenant: "sehgal_maruti", p_limit: SEARCH_LIMIT } },
    ]);
  });

  it("passes null for the consultant (every dealer) view", async () => {
    const { client, calls } = fake({ data: searchAnswer({ scope: { mode: "consultant" } }) });
    await fetchVehicleSearch(client, "9000000001", null);
    expect(calls[0].args?.p_tenant).toBeNull();
  });

  it("returns the answer, and falls back to the row count when total is missing", async () => {
    const { client } = fake({ data: searchAnswer({ total: undefined, results: [{}, {}] }) });
    const r = await fetchVehicleSearch(client, "9000000001", null);
    expect(r.total).toBe(2);
    expect(r.results).toHaveLength(2);
  });

  it("throws the server's plain message", async () => {
    const { client } = fake({ error: { message: "This login is not a member of Sehgal Maruti" } });
    await expect(fetchVehicleSearch(client, "9000000001", "sehgal_maruti")).rejects.toThrow("This login is not a member of Sehgal Maruti");
  });

  it("turns a network failure into a sentence a person can act on", async () => {
    const { client } = fake(new TypeError("Failed to fetch"));
    await expect(fetchVehicleSearch(client, "9000000001", null)).rejects.toThrow(/Could not reach the server/);
  });

  it("refuses an answer that is not a search response", async () => {
    const { client } = fake({ data: { results: "nope" } });
    await expect(fetchVehicleSearch(client, "9000000001", null)).rejects.toThrow(/does not understand/);
  });
});

describe("openKeyOf", () => {
  it("opens by registration, else by VIN, else not at all", () => {
    expect(openKeyOf({ registration: "MH12AA0001", vin: "TESTCH00000000001" })).toBe("MH12AA0001");
    expect(openKeyOf({ vin: "TESTCH00000000003" })).toBe("TESTCH00000000003");
    expect(openKeyOf({ registration: "  ", vin: "" })).toBeNull();
    expect(openKeyOf({})).toBeNull();
  });
});

describe("fetchVehicleHistory / fetchIsConsultant", () => {
  const report = { registration: "MH12AA0001", visits: [], scope: { mode: "tenant" }, printed_at: "", release: "" };

  it("asks the report function with the tenant", async () => {
    const { client, calls } = fake({ data: report });
    await fetchVehicleHistory(client, " MH12AA0001 ", "sehgal_maruti");
    expect(calls).toEqual([{ fn: "vehicle_history_report", args: { p_vehicle: "MH12AA0001", p_tenant: "sehgal_maruti" } }]);
  });

  it("reads the consultant flag, and throws (never guesses) when the check fails", async () => {
    expect(await fetchIsConsultant(fake({ data: true }).client)).toBe(true);
    expect(await fetchIsConsultant(fake({ data: false }).client)).toBe(false);
    await expect(fetchIsConsultant(fake({ error: { message: "boom" } }).client)).rejects.toThrow("boom");
  });
});

describe("holdsAnything (a vehicle with no job card in this view)", () => {
  const base = { registration: "MH12AA0001", visits: [], scope: { mode: "tenant" as const }, printed_at: "", release: "SEHGAL VH 1.2" };

  it("is false when the report knows nothing - the screen says no visits found", () => {
    expect(holdsAnything(base)).toBe(false);
    expect(holdsAnything({ ...base, customer: {}, vehicle: {}, vehicle_facts: [] })).toBe(false);
    expect(holdsAnything({ ...base, customer: { name: "  " }, vehicle_facts: [{ label: "Insurance", value: " " }] })).toBe(false);
  });

  it("is true when the owner, the vehicle or a fact is known - the screen shows them", () => {
    expect(holdsAnything({ ...base, customer: { name: "TEST OWNER" } })).toBe(true);
    expect(holdsAnything({ ...base, vehicle: { model: "TEST MODEL" } })).toBe(true);
    expect(holdsAnything({ ...base, customer: { address_lines: ["TEST LINE"] } })).toBe(true);
    expect(holdsAnything({ ...base, vehicle_facts: [{ label: "Insurance", value: "due 01-JAN-27" }] })).toBe(true);
  });
});
