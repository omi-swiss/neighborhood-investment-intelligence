let initialized = false;

export async function ensureSchema() {
  if (initialized) return;
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("The workspace database binding is unavailable.");
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saved_areas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        area_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS saved_areas_user_area_idx
      ON saved_areas(user_email, area_id)
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saved_filter_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        name TEXT NOT NULL,
        query_json TEXT NOT NULL,
        schema_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS saved_filter_sets_user_name_idx
      ON saved_filter_sets(user_email, name)
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS strategy_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        name TEXT NOT NULL,
        version INTEGER NOT NULL,
        weights_json TEXT NOT NULL,
        minimum_coverage_bps INTEGER NOT NULL DEFAULT 7000,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS strategy_versions_user_name_version_idx
      ON strategy_versions(user_email, name, version)
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS property_imports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        filename TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_license TEXT NOT NULL,
        source_url TEXT,
        submitted_count INTEGER NOT NULL,
        accepted_count INTEGER NOT NULL,
        rejected_count INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        import_id INTEGER REFERENCES property_imports(id),
        source_name TEXT NOT NULL,
        source_license TEXT NOT NULL,
        source_url TEXT,
        source_record_id TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        county TEXT,
        state TEXT NOT NULL,
        postal_code TEXT,
        latitude REAL,
        longitude REAL,
        parcel_id TEXT,
        property_type TEXT NOT NULL,
        unit_count INTEGER NOT NULL DEFAULT 1,
        bedrooms REAL,
        bathrooms REAL,
        building_square_feet INTEGER,
        lot_square_feet INTEGER,
        year_built INTEGER,
        asking_price REAL NOT NULL,
        current_monthly_rent REAL,
        market_monthly_rent REAL,
        annual_property_taxes REAL,
        annual_insurance REAL,
        hoa_monthly REAL,
        maintenance_monthly REAL,
        vacancy_assumption REAL,
        renovation_estimate REAL,
        listing_date TEXT,
        listing_status TEXT NOT NULL DEFAULT 'active',
        broker TEXT,
        tract_geoid TEXT,
        observed_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS properties_user_source_record_idx
      ON properties(user_email, source_name, source_record_id)
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS saved_properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        property_id INTEGER NOT NULL REFERENCES properties(id),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS saved_properties_user_property_idx
      ON saved_properties(user_email, property_id)
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS financial_models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        property_id INTEGER REFERENCES properties(id),
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS financial_model_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_id INTEGER NOT NULL REFERENCES financial_models(id),
        user_email TEXT NOT NULL,
        version INTEGER NOT NULL,
        assumptions_json TEXT NOT NULL,
        calculation_version TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS financial_model_versions_model_version_idx
      ON financial_model_versions(model_id, version)
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS financial_scenarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_version_id INTEGER NOT NULL REFERENCES financial_model_versions(id),
        user_email TEXT NOT NULL,
        name TEXT NOT NULL,
        scenario_type TEXT NOT NULL,
        overrides_json TEXT NOT NULL,
        results_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS property_comparable_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        comparable_type TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_license TEXT NOT NULL,
        source_url TEXT,
        source_record_id TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        county TEXT,
        state TEXT NOT NULL,
        postal_code TEXT,
        latitude REAL,
        longitude REAL,
        parcel_id TEXT,
        tract_geoid TEXT,
        property_type TEXT NOT NULL,
        unit_count INTEGER NOT NULL DEFAULT 1,
        bedrooms REAL,
        bathrooms REAL,
        building_square_feet INTEGER,
        year_built INTEGER,
        condition TEXT,
        transaction_date TEXT NOT NULL,
        sale_price REAL,
        monthly_rent REAL,
        observed_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS property_comparable_records_user_source_idx
      ON property_comparable_records(user_email, source_name, source_record_id, comparable_type)
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS property_comparable_selections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        subject_property_id INTEGER NOT NULL REFERENCES properties(id),
        comparable_record_id INTEGER NOT NULL REFERENCES property_comparable_records(id),
        decision TEXT NOT NULL,
        adjustment_percent REAL NOT NULL DEFAULT 0,
        adjustment_notes TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS property_comparable_selections_subject_record_idx
      ON property_comparable_selections(user_email, subject_property_id, comparable_record_id)
    `),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS watchlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT NOT NULL, name TEXT NOT NULL,
      description TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS watchlists_user_name_idx
      ON watchlists(user_email, name)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS watchlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, watchlist_id INTEGER NOT NULL REFERENCES watchlists(id),
      user_email TEXT NOT NULL, entity_type TEXT NOT NULL, entity_key TEXT NOT NULL,
      label TEXT NOT NULL, snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS watchlist_items_list_entity_idx
      ON watchlist_items(watchlist_id, entity_type, entity_key)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS saved_searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT NOT NULL, name TEXT NOT NULL,
      search_type TEXT NOT NULL, query_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_user_name_idx
      ON saved_searches(user_email, name)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS alert_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT NOT NULL,
      entity_type TEXT NOT NULL, entity_key TEXT NOT NULL, event_types_json TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS alert_rules_user_entity_idx
      ON alert_rules(user_email, entity_type, entity_key)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT NOT NULL,
      rule_id INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL, entity_type TEXT NOT NULL,
      entity_key TEXT NOT NULL, event_type TEXT NOT NULL, title TEXT NOT NULL,
      previous_json TEXT, current_json TEXT NOT NULL, source_name TEXT NOT NULL,
      source_url TEXT, why_it_matters TEXT NOT NULL,
      detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, read_at TEXT,
      fingerprint TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS alerts_user_fingerprint_idx
      ON alerts(user_email, fingerprint)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS property_listing_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT NOT NULL,
      property_id INTEGER NOT NULL REFERENCES properties(id), asking_price REAL NOT NULL,
      listing_status TEXT NOT NULL, observed_at TEXT NOT NULL, source_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS property_listing_history_observation_idx
      ON property_listing_history(user_email, property_id, observed_at, asking_price, listing_status)`),
  ]);
  initialized = true;
}
