import assert from "node:assert/strict";
import test from "node:test";

const workerPromise = import(new URL("../dist/server/index.js", import.meta.url)).then(
  ({ default: worker }) => worker,
);

async function request(path, init) {
  const worker = await workerPromise;
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      ...init,
      headers: { accept: "text/html", ...(init?.headers ?? {}) },
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

const cashModel = {
  modelName: "Formula control",
  propertyId: null,
  purchasePrice: 100000,
  offerPrice: 100000,
  closingCosts: 0,
  inspectionLegalCosts: 0,
  renovationBudget: 0,
  initialReserves: 0,
  purchaseMode: "cash",
  downPaymentPercent: 0.25,
  interestRate: 0.07,
  loanTermYears: 30,
  amortizationYears: 30,
  interestOnlyYears: 0,
  pointsPercent: 0,
  originationFees: 0,
  monthlyRent: 1000,
  otherMonthlyIncome: 0,
  leaseUpMonths: 0,
  rentGrowth: 0,
  vacancyRate: 0,
  creditLossRate: 0,
  propertyTaxRate: 0,
  annualPropertyTaxes: 0,
  annualInsurance: 0,
  hoaMonthly: 0,
  utilitiesMonthly: 0,
  otherAnnualExpenses: 0,
  managementPercent: 0,
  maintenancePercent: 0,
  capitalReservePercent: 0,
  expenseGrowth: 0,
  appreciationRate: 0,
  sellingCostRate: 0,
  exitCapRate: 0.06,
  exitValueAdjustment: 0,
  exitValuation: "appreciation",
  discountRate: 0.1,
  projectionYears: 5,
  inputSources: {},
};

test("renders the investor-focused market discovery shell", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Discover Markets \| NII<\/title>/i);
  assert.match(html, /Discover Markets/);
  assert.match(html, /What are you looking to buy/);
  assert.match(html, /Minimum cash-on-cash/);
  assert.match(html, /Screening filters/);
  assert.match(html, /Data healthy/);
  assert.doesNotMatch(html, /Nine-city coverage/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview|react-loading-skeleton/i);
});

test("renders the all-market property universe without fabricated listings", async () => {
  const response = await request("/properties");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Analyze Property/);
  assert.match(html, /Recent sales/i);
  assert.match(html, /All properties/i);
  assert.match(html, /Prospecting list/i);
  assert.match(html, /Search the property universe/i);
  assert.doesNotMatch(html, /nine-city coverage/i);
});

test("exposes property-universe coverage for every supported market", async () => {
  const response = await request("/api/public-property-directory?market=all&page=1");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.coverage.length, 20);
  assert.deepEqual(
    payload.coverage.map((market) => market.city).sort(),
    ["Austin", "Baltimore", "Boston", "Charleston", "Charlotte", "Chicago", "Cincinnati", "Columbus", "Dallas", "Denver", "Detroit", "Miami", "Nashville-Davidson", "New York City", "Philadelphia", "Phoenix", "San Antonio", "Seattle", "Tampa", "Washington"],
  );
  assert.equal(payload.coverage.filter((market) => market.recordCoverage === "live-official").length, 17);
  assert.equal(payload.lookupStatus, "snapshot");
});

test("property directory defaults to five-year recorded sales", async () => {
  const response = await request("/api/public-property-directory?market=all&view=sales&years=5&page=1");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.match(payload.message, /Past 5 years/i);
  assert.ok(payload.items.every((item) => item.saleDate));
});

test("renders the Phase 3 model with Phase 4 sensitivity and stress diagnostics", async () => {
  const response = await request("/underwriting");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Financial Underwriting/);
  assert.match(html, /Build reproducible pre-tax scenarios/);
  assert.match(html, /Base case/);
  assert.match(html, /Formula audit/);
  assert.match(html, /Stress tests/);
  assert.match(html, /Sensitivity analysis/);
  assert.match(html, /Rent growth capped/);
});

test("renders the Phase 5 watchlist and alert workspace", async () => {
  const response = await request("/watchlists");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Watchlists &amp; alerts/);
  assert.match(html, /Check for updates/);
  assert.match(html, /source unavailable/i);
  assert.match(html, /Alert inbox/);
});

test("detects auditable property and area monitoring changes", async () => {
  const propertyResponse = await request("/api/monitoring/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      entityType: "property",
      label: "100 Evidence Street",
      previous: {
        askingPrice: 500000,
        listingStatus: "active",
        updatedAt: "2026-07-01",
        sourceName: "Authorized feed",
      },
      current: {
        askingPrice: 475000,
        listingStatus: "pending",
        updatedAt: "2026-07-26",
        sourceName: "Authorized feed",
      },
    }),
  });
  assert.equal(propertyResponse.status, 200);
  const propertyPayload = await propertyResponse.json();
  assert.deepEqual(
    propertyPayload.changes.map((change) => change.eventType),
    ["price_reduction", "property_status_change", "data_refresh"],
  );
  assert.equal(propertyPayload.changes[0].previous.askingPrice, 500000);
  assert.equal(propertyPayload.changes[0].current.askingPrice, 475000);
  assert.match(propertyPayload.changes[0].whyItMatters, /projected returns/i);
  assert.equal(propertyPayload.changes[0].sourceName, "Authorized feed");

  const areaResponse = await request("/api/monitoring/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      entityType: "area",
      label: "Census Tract 0001",
      previous: { score: 60, medianRent: 1800, vacancyRate: 0.04, release: "2022" },
      current: {
        score: 62,
        medianRent: 1900,
        vacancyRate: 0.05,
        release: "2023",
        sourceName: "U.S. Census Bureau ACS",
      },
    }),
  });
  assert.equal(areaResponse.status, 200);
  const areaPayload = await areaResponse.json();
  assert.deepEqual(
    areaPayload.changes.map((change) => change.eventType),
    ["neighborhood_score_change", "rent_trend_change", "vacancy_change", "data_refresh"],
  );
});

test("calculates and exports a known cash-purchase formula control", async () => {
  const response = await request("/api/financial-models/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assumptions: cashModel }),
  });
  assert.equal(response.status, 200);
  const { results } = await response.json();
  assert.equal(results.totalAcquisitionCost, 100000);
  assert.equal(results.initialCashInvested, 100000);
  assert.equal(results.yearOneNoi, 12000);
  assert.equal(results.yearOneCashFlow, 12000);
  assert.equal(results.capRate, 0.12);
  assert.ok(Math.abs(results.leveredIrr - 0.12) < 0.000001);
  assert.equal(results.equityMultiple, 1.6);
  assert.equal(results.projections.length, 5);

  const exportResponse = await request("/api/financial-models/export", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assumptions: cashModel }),
  });
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-type") ?? "", /^text\/csv\b/i);
  const csv = await exportResponse.text();
  assert.match(csv, /^scenario,calculation_version,year,/);
  assert.equal(csv.trim().split(/\r?\n/).length, 6);
});

test("amortizes debt and applies forward-NOI exit valuation", async () => {
  const response = await request("/api/financial-models/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      assumptions: {
        ...cashModel,
        purchaseMode: "loan",
        interestRate: 0,
        downPaymentPercent: 0.25,
        exitValuation: "exit-cap",
        exitCapRate: 0.1,
      },
    }),
  });
  assert.equal(response.status, 200);
  const { results } = await response.json();
  assert.equal(results.loanAmount, 75000);
  assert.equal(results.initialCashInvested, 25000);
  assert.ok(Math.abs(results.projections[0].debtService - 2500) < 0.000001);
  assert.ok(Math.abs(results.projections[0].endingLoanBalance - 72500) < 0.000001);
  assert.ok(Math.abs(results.dscr - 4.8) < 0.000001);
  assert.ok(Math.abs(results.cashOnCashReturn - 0.38) < 0.000001);
  assert.ok(Math.abs(results.projectedSalePrice - 120000) < 0.000001);
  assert.ok(Math.abs(results.saleProceeds - 57500) < 0.000001);
});

test("rejects invalid financial assumptions instead of filling them silently", async () => {
  const response = await request("/api/financial-models/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assumptions: { ...cashModel, monthlyRent: -1 } }),
  });
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.details.join(" "), /monthlyRent must be a nonnegative number/i);
});

test("calculates lease-up loss, required reserves, and negative-cash-flow timing", async () => {
  const response = await request("/api/financial-models/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      assumptions: {
        ...cashModel,
        leaseUpMonths: 3,
        annualPropertyTaxes: 15000,
      },
    }),
  });
  assert.equal(response.status, 200);
  const { results } = await response.json();
  assert.equal(results.projections[0].leaseUpLoss, 3000);
  assert.equal(results.projections[0].preTaxCashFlow, -6000);
  assert.equal(results.requiredCashReserves, 18000);
  assert.equal(results.firstNegativeCashFlowYear, 1);
});

test("builds a 5-by-5 sensitivity matrix and ranks modeled drivers", async () => {
  const response = await request("/api/financial-models/sensitivity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      assumptions: cashModel,
      pair: "purchase-price-rent",
      metric: "leveredIrr",
    }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.matrix.cells.length, 5);
  assert.ok(payload.matrix.cells.every((row) => row.length === 5));
  assert.ok(Math.abs(payload.matrix.cells[2][2] - 0.12) < 0.000001);
  assert.ok(payload.drivers.length >= 6);
  assert.ok(payload.drivers[0].impact >= payload.drivers.at(-1).impact);
});

test("validates explicit sale and rental comparable records", async () => {
  const response = await request("/api/comparables/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      rows: [
        {
          comparable_type: "sale",
          source_record_id: "sale-1",
          address: "10 Evidence Street",
          city: "Washington",
          state: "DC",
          property_type: "single-family",
          transaction_date: "2026-06-01",
          sale_price: "525000",
        },
        {
          comparable_type: "rental",
          source_record_id: "rent-1",
          address: "12 Evidence Street",
          city: "Washington",
          state: "DC",
          property_type: "single-family",
          transaction_date: "2026-06-15",
          monthly_rent: "3200",
        },
        {
          comparable_type: "sale",
          source_record_id: "bad-sale",
          address: "14 Evidence Street",
          city: "Washington",
          state: "DC",
          property_type: "single-family",
          transaction_date: "2026-06-15",
        },
      ],
    }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.submitted, 3);
  assert.equal(payload.accepted, 2);
  assert.equal(payload.rejected, 1);
  assert.match(payload.rejections[0].reason, /sale_price/i);
});

test("publishes a blank comparable import contract", async () => {
  const response = await request("/api/comparables/template");
  assert.equal(response.status, 200);
  const csv = await response.text();
  assert.match(csv, /^comparable_type,source_record_id,address,city/);
  assert.match(csv, /sale_price,monthly_rent/);
  assert.equal(csv.trim().split(/\r?\n/).length, 1);
});

test("publishes a blank property import contract", async () => {
  const response = await request("/api/properties/template");
  assert.equal(response.status, 200);
  const csv = await response.text();
  assert.match(csv, /^source_record_id,address,city,county,state/);
  assert.equal(csv.trim().split(/\r?\n/).length, 1);
});

test("validates property imports without writing or inventing missing facts", async () => {
  const response = await request("/api/properties/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      rows: [
        {
          source_record_id: "authorized-1",
          address: "100 Test Street",
          city: "Washington",
          state: "DC",
          property_type: "single-family",
          asking_price: "500000",
          observed_at: "2026-07-26",
        },
        {
          source_record_id: "invalid-1",
          address: "",
          city: "Washington",
          state: "DC",
          property_type: "single-family",
          asking_price: "500000",
        },
      ],
    }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.submitted, 2);
  assert.equal(payload.accepted, 1);
  assert.equal(payload.rejected, 1);
  assert.match(payload.rejections[0].reason, /address/i);
});

test("returns filtered, paginated real-data area records", async () => {
  const response = await request(
    "/api/areas?market=place:1150000&minimumScore=60&minimumIncomeGrowth=-0.03&minimumGrossYield=0&maximumVacancy=0.3&sort=score&page=1&pageSize=10",
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.page, 1);
  assert.equal(payload.pageSize, 10);
  assert.ok(payload.total > 0);
  assert.ok(payload.items.length <= 10);
  assert.match(payload.items[0].id, /^\d{11}$/);
  assert.equal(payload.items[0].stateAbbr, "DC");
  assert.equal(typeof payload.items[0].quality.warning, "string");
  assert.equal(response.headers.get("x-data-release"), "acs-2023-supported-market-cohort");
  assert.equal(payload.filters.city, "place:1150000");
});

test("returns a lightweight market atlas for the default screener map", async () => {
  const response = await request("/api/areas?page=1&pageSize=20");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.mapItems.length, 0);
  assert.equal(payload.marketSummaries.length, 20);
  assert.ok(payload.marketSummaries.every((market) => market.tractCount > 0));
  assert.ok(payload.marketSummaries.every((market) => Number.isFinite(market.latitude) && Number.isFinite(market.longitude)));
});

test("renders a real tract detail route with provenance", async () => {
  const areasResponse = await request("/api/areas?page=1&pageSize=10");
  const { items } = await areasResponse.json();
  const response = await request(`/areas/${items[0].id}`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Investor decision snapshot/);
  assert.match(html, /Area fundamentals/);
  assert.match(html, /Current area evidence/);
  assert.match(html, /Decision notes/);
  assert.doesNotMatch(html, /Sources and quality/);
  assert.match(html, /not an appraisal/i);
  assert.match(html, new RegExp(items[0].id));
});

test("exports the filtered real-data cohort as machine-readable CSV", async () => {
  const response = await request(
    "/api/areas/export?minimumScore=60&minimumIncomeGrowth=-0.03&minimumGrossYield=0&maximumVacancy=0.3&sort=score",
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/csv\b/i);
  assert.match(response.headers.get("content-disposition") ?? "", /nii-opportunity-screen\.csv/);
  const csv = await response.text();
  assert.match(csv, /^tract_geoid,market_id,area_name,tract_label,neighborhood_name,name_source,name_confidence,county,state/m);
  assert.match(csv, /\b11001\d{6}\b/);
  assert.doesNotMatch(csv, /\$|%/);
});

test("filters exact city-proper market identifiers without metro ambiguity", async () => {
  const response = await request("/api/areas?market=place:2622000&page=1&pageSize=10");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.total > 0);
  assert.ok(payload.items.every((item) => item.marketId === "place:2622000"));
  assert.ok(payload.items.every((item) => item.city === "Detroit" && item.stateAbbr === "MI"));
  assert.ok(payload.items.every((item) => item.tractLabel.startsWith("Census Tract ")));
});

test("renders the market intelligence workspace with complete market context coverage", async () => {
  const response = await request("/signals");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Market intelligence/);
  assert.match(html, /Verified project, grant, and urbanism pipeline/);
  assert.match(html, /verified records/i);
  assert.match(html, /Regulatory profile/);
  assert.match(html, /Official DOB filing/);
  assert.match(html, /Landlord operating environment/);
  assert.match(html, /Open primary source/);

  const sourcesResponse = await request("/sources");
  assert.equal(sourcesResponse.status, 200);
  const sourcesHtml = await sourcesResponse.text();
  assert.match(sourcesHtml, /City-context references/);
  assert.doesNotMatch(sourcesHtml, /Not yet verified/);
});

test("validates listing links without scraping or inventing property facts", async () => {
  const response = await request("/api/properties/link-import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "https://www.zillow.com/homedetails/example" }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "link-only");
  assert.deepEqual(payload.fieldsImported, []);
  assert.match(payload.message, /never.*invented|no property facts were invented/i);
});

test("renders comparison, methodology, health, and strategy settings surfaces", async () => {
  const areasResponse = await request("/api/areas?page=1&pageSize=2");
  const { items } = await areasResponse.json();
  const paths = [
    [`/compare?ids=${items.map((item) => item.id).join(",")}`, /Side-by-side evidence/],
    ["/methodology", /Strategies and normalization/],
    ["/health", /unavailable, or user-supplied layers/i],
    ["/settings/strategies", /Create a strategy version/],
  ];
  for (const [path, pattern] of paths) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), pattern);
  }
});
