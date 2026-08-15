import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const savedAreas = sqliteTable(
  "saved_areas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    areaId: text("area_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("saved_areas_user_area_idx").on(table.userEmail, table.areaId),
  ],
);

export const savedFilterSets = sqliteTable(
  "saved_filter_sets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    name: text("name").notNull(),
    queryJson: text("query_json").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("saved_filter_sets_user_name_idx").on(table.userEmail, table.name),
  ],
);

export const strategyVersions = sqliteTable(
  "strategy_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    name: text("name").notNull(),
    version: integer("version").notNull(),
    weightsJson: text("weights_json").notNull(),
    minimumCoverage: integer("minimum_coverage_bps").notNull().default(7000),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("strategy_versions_user_name_version_idx").on(
      table.userEmail,
      table.name,
      table.version,
    ),
  ],
);

export const propertyImports = sqliteTable("property_imports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  filename: text("filename").notNull(),
  sourceName: text("source_name").notNull(),
  sourceLicense: text("source_license").notNull(),
  sourceUrl: text("source_url"),
  submittedCount: integer("submitted_count").notNull(),
  acceptedCount: integer("accepted_count").notNull(),
  rejectedCount: integer("rejected_count").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const properties = sqliteTable(
  "properties",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    importId: integer("import_id").references(() => propertyImports.id),
    sourceName: text("source_name").notNull(),
    sourceLicense: text("source_license").notNull(),
    sourceUrl: text("source_url"),
    sourceRecordId: text("source_record_id").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    county: text("county"),
    state: text("state").notNull(),
    postalCode: text("postal_code"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    parcelId: text("parcel_id"),
    propertyType: text("property_type").notNull(),
    unitCount: integer("unit_count").notNull().default(1),
    bedrooms: real("bedrooms"),
    bathrooms: real("bathrooms"),
    buildingSquareFeet: integer("building_square_feet"),
    lotSquareFeet: integer("lot_square_feet"),
    yearBuilt: integer("year_built"),
    askingPrice: real("asking_price").notNull(),
    currentMonthlyRent: real("current_monthly_rent"),
    marketMonthlyRent: real("market_monthly_rent"),
    annualPropertyTaxes: real("annual_property_taxes"),
    annualInsurance: real("annual_insurance"),
    hoaMonthly: real("hoa_monthly"),
    maintenanceMonthly: real("maintenance_monthly"),
    vacancyAssumption: real("vacancy_assumption"),
    renovationEstimate: real("renovation_estimate"),
    listingDate: text("listing_date"),
    listingStatus: text("listing_status").notNull().default("active"),
    broker: text("broker"),
    tractGeoid: text("tract_geoid"),
    observedAt: text("observed_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("properties_user_source_record_idx").on(
      table.userEmail,
      table.sourceName,
      table.sourceRecordId,
    ),
  ],
);

export const savedProperties = sqliteTable(
  "saved_properties",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    propertyId: integer("property_id").notNull().references(() => properties.id),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("saved_properties_user_property_idx").on(
      table.userEmail,
      table.propertyId,
    ),
  ],
);

export const financialModels = sqliteTable("financial_models", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  propertyId: integer("property_id").references(() => properties.id),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const financialModelVersions = sqliteTable(
  "financial_model_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    modelId: integer("model_id").notNull().references(() => financialModels.id),
    userEmail: text("user_email").notNull(),
    version: integer("version").notNull(),
    assumptionsJson: text("assumptions_json").notNull(),
    calculationVersion: text("calculation_version").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("financial_model_versions_model_version_idx").on(
      table.modelId,
      table.version,
    ),
  ],
);

export const financialScenarios = sqliteTable(
  "financial_scenarios",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    modelVersionId: integer("model_version_id")
      .notNull()
      .references(() => financialModelVersions.id),
    userEmail: text("user_email").notNull(),
    name: text("name").notNull(),
    scenarioType: text("scenario_type").notNull(),
    overridesJson: text("overrides_json").notNull(),
    resultsJson: text("results_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
);

export const propertyComparableRecords = sqliteTable(
  "property_comparable_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    comparableType: text("comparable_type").notNull(),
    sourceName: text("source_name").notNull(),
    sourceLicense: text("source_license").notNull(),
    sourceUrl: text("source_url"),
    sourceRecordId: text("source_record_id").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    county: text("county"),
    state: text("state").notNull(),
    postalCode: text("postal_code"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    parcelId: text("parcel_id"),
    tractGeoid: text("tract_geoid"),
    propertyType: text("property_type").notNull(),
    unitCount: integer("unit_count").notNull().default(1),
    bedrooms: real("bedrooms"),
    bathrooms: real("bathrooms"),
    buildingSquareFeet: integer("building_square_feet"),
    yearBuilt: integer("year_built"),
    condition: text("condition"),
    transactionDate: text("transaction_date").notNull(),
    salePrice: real("sale_price"),
    monthlyRent: real("monthly_rent"),
    observedAt: text("observed_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("property_comparable_records_user_source_idx").on(
      table.userEmail,
      table.sourceName,
      table.sourceRecordId,
      table.comparableType,
    ),
  ],
);

export const propertyComparableSelections = sqliteTable(
  "property_comparable_selections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    subjectPropertyId: integer("subject_property_id").notNull().references(() => properties.id),
    comparableRecordId: integer("comparable_record_id").notNull().references(() => propertyComparableRecords.id),
    decision: text("decision").notNull(),
    adjustmentPercent: real("adjustment_percent").notNull().default(0),
    adjustmentNotes: text("adjustment_notes"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("property_comparable_selections_subject_record_idx").on(
      table.userEmail,
      table.subjectPropertyId,
      table.comparableRecordId,
    ),
  ],
);

export const watchlists = sqliteTable("watchlists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("watchlists_user_name_idx").on(table.userEmail, table.name)]);

export const watchlistItems = sqliteTable("watchlist_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  watchlistId: integer("watchlist_id").notNull().references(() => watchlists.id),
  userEmail: text("user_email").notNull(),
  entityType: text("entity_type").notNull(),
  entityKey: text("entity_key").notNull(),
  label: text("label").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("watchlist_items_list_entity_idx").on(table.watchlistId, table.entityType, table.entityKey),
]);

export const savedSearches = sqliteTable("saved_searches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  name: text("name").notNull(),
  searchType: text("search_type").notNull(),
  queryJson: text("query_json").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("saved_searches_user_name_idx").on(table.userEmail, table.name)]);

export const alertRules = sqliteTable("alert_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  entityType: text("entity_type").notNull(),
  entityKey: text("entity_key").notNull(),
  eventTypesJson: text("event_types_json").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("alert_rules_user_entity_idx").on(table.userEmail, table.entityType, table.entityKey),
]);

export const alerts = sqliteTable("alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  ruleId: integer("rule_id").references(() => alertRules.id, { onDelete: "set null" }),
  entityType: text("entity_type").notNull(),
  entityKey: text("entity_key").notNull(),
  eventType: text("event_type").notNull(),
  title: text("title").notNull(),
  previousJson: text("previous_json"),
  currentJson: text("current_json").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url"),
  whyItMatters: text("why_it_matters").notNull(),
  detectedAt: text("detected_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  readAt: text("read_at"),
  fingerprint: text("fingerprint").notNull(),
}, (table) => [
  uniqueIndex("alerts_user_fingerprint_idx").on(table.userEmail, table.fingerprint),
]);

export const propertyListingHistory = sqliteTable("property_listing_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  propertyId: integer("property_id").notNull().references(() => properties.id),
  askingPrice: real("asking_price").notNull(),
  listingStatus: text("listing_status").notNull(),
  observedAt: text("observed_at").notNull(),
  sourceName: text("source_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("property_listing_history_observation_idx").on(
    table.userEmail, table.propertyId, table.observedAt, table.askingPrice, table.listingStatus,
  ),
]);
