// Sehgal Autoriders Vehicle History - the report contract.
//
// One object = one printed "Vehicle History" document, field-for-field the same as the
// Maruti Suzuki DMS report (Oracle Reports, Rel:1.1.7) that MSIL stopped issuing. The
// reference copy is a real 7-visit customer report (kept OUT of the repo - customer data),
// sha256 76f05b9718c5828eb785738389ca37313d2da86dc71a3520bb47109c65c29671, 6 printed pages of 778 x 1008 pt.
//
// Every field is optional text exactly as it should print. A field we do not hold prints
// blank, the way the Maruti report prints a blank "TA Name" or "CSI %". Nothing here is ever
// filled with a placeholder value - missing is not zero.
//
// Erasable TypeScript only (no enums, no namespaces) so Node can run it with
// --experimental-strip-types and the React app can import it unchanged.

/** The billable word exactly as the source file has it: CUS, Customer, INSURANCE, 1ST FREE SERVICE, Workshop Issue ... */
export type BillableType = string;

/**
 * One fact we hold that Maruti's layout has no box for (Ravi, 17-10-2026: "not necessary ... an exact replica ...
 * if any extra information we have like insurance expiry date ... put it on the jc"). Printed as "Label: value".
 */
export interface VhFact {
  label: string;
  value: string;
}

export interface VhCustomer {
  name?: string;
  /** Address as printed: first line, then one entry per wrapped line (city, district, "Pin:431602"). */
  address_lines?: string[];
  res_phone?: string;
  mobile_phone?: string;
  car_user_phone?: string;
  email?: string;
}

export interface VhVehicle {
  model?: string;
  chassis_no?: string;
  engine_no?: string;
  /** Selling dealer code as printed, e.g. "68NA". */
  sold_by?: string;
  /** Printed form, e.g. "28-NOV-24". */
  sold_date?: string;
  battery_no?: string;
  battery_capacity?: string;
  variant?: string;
}

export interface VhPsf {
  /** Each part prints as "SA- <sa> -CCE- <cce> -2ND- <second>". */
  sa?: string;
  cce?: string;
  second?: string;
}

export interface VhJobCard {
  jobcard_number?: string;
  service_type?: string;
  sa_name?: string;
  mechanic_name?: string;
  ta_name?: string;
  group_name?: string;
  /** Printed first line of "Servicing Dealer", e.g. "CGA1-CGA-01". */
  dealer_code?: string;
  /** Printed under the code, e.g. "SEHGAL AUTORIDERS PVT. LTD.,LONAVALA-SRV". */
  dealer_name?: string;
  /** Printed form "dd/mm/yy HH:MM". */
  jobcard_date?: string;
  promised_date?: string;
  ready_date?: string;
  csi_percent?: string;
  psf?: VhPsf;
  mileage?: string;
  /** Only printed when present, e.g. "Drop". */
  attended_through?: string;
  bill_date?: string;
  bill_number?: string;
  /** Amounts are text as printed ("4381.01", "0", "7721.9"); est_* print with 2 decimals. */
  part_amount?: string;
  labour_amount?: string;
  total_amount?: string;
  est_part_amount?: string;
  est_labour_amount?: string;
  est_total_amount?: string;
}

export interface VhPartLine {
  part_number?: string;
  description?: string;
  /** Printed with 3 decimals, leading zero dropped: "1.000", ".500". */
  quantity?: string;
  billable_type?: BillableType;
}

export interface VhLabourLine {
  labour_code?: string;
  description?: string;
  billable_type?: BillableType;
}

export interface VhVisit {
  /** Number printed as "VISIT_n". Visit 1 is the OLDEST visible visit. */
  visit_no: number;
  customer: VhCustomer;
  vehicle: VhVehicle;
  jobcard: VhJobCard;
  demanded_repairs: string[];
  parts: VhPartLine[];
  labour: VhLabourLine[];
  recommendations?: string;
  unapproved_fitments?: string;
  /**
   * Sehgal Autoriders addition (holdup / follow-up remarks from our own data). Prints as one extra
   * "Remarks :" line only when non-empty, so a visit without remarks looks exactly like Maruti's.
   */
  remarks?: string[];
  /** Sehgal Autoriders addition: facts about this job card (EW at the visit, discounts, wash ...). One "Additional :" line. */
  extras?: VhFact[];
}

export interface VhScope {
  /** tenant = one dealer group's own visits only; consultant = every dealer we hold. */
  mode: 'tenant' | 'consultant';
  tenant_code?: string;
  tenant_name?: string;
  /** Dealer-code prefixes this tenant owns, e.g. ["CGA1", "1913"]. Empty in consultant mode. */
  dealer_codes?: string[];
}

export interface VehicleHistoryReport {
  registration: string;
  /** Sehgal Autoriders addition (release 1.2): the maker, e.g. "MARUTI", "HERO". Absent on older reports = Maruti. */
  brand?: string;
  /** Display name of the maker, e.g. "Hero MotoCorp". */
  brand_name?: string;
  /** Printed as the page title: "Vehicle History" for Maruti (unchanged), "Vehicle History - Hero MotoCorp" for Hero. */
  report_title?: string;
  /**
   * Sehgal Autoriders addition (release 1.2): the header customer / vehicle on their own, so a vehicle with no job card on record
   * still shows who owns it and what it is. Every visit already carries the same block, merged with its own values.
   */
  customer?: VhCustomer;
  vehicle?: VhVehicle;
  /** Visits in print order: NEWEST first (VISIT_n at the top, VISIT_1 last), as Maruti prints them. */
  visits: VhVisit[];
  /** Printed bottom-left, e.g. "16-OCT-26 11:03 PM". */
  printed_at: string;
  /** Printed bottom-centre as "Rel:<release>". */
  release: string;
  scope: VhScope;
  /**
   * Sources that were NOT available when this report was assembled (e.g. "labour lines",
   * "PSF"). Shown on screen beside the report, never printed inside it.
   */
  not_loaded?: string[];
  /**
   * Sehgal Autoriders addition: facts about the vehicle we hold beyond Maruti's boxes - fuel, colour, financier, extended
   * warranty, CCP, loyalty, next service, insurance, more mobiles. Printed once, under the registration line.
   */
  vehicle_facts?: VhFact[];
}
