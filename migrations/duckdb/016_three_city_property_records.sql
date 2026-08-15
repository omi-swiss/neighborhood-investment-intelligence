CREATE TABLE IF NOT EXISTS standardized.property_market_record (
  record_id VARCHAR PRIMARY KEY,
  city VARCHAR NOT NULL,
  state_abbr VARCHAR NOT NULL,
  parcel_id VARCHAR NOT NULL,
  address VARCHAR,
  postal_code VARCHAR,
  neighborhood VARCHAR,
  tract_geoid VARCHAR,
  property_type VARCHAR,
  sale_price_usd DOUBLE,
  sale_date DATE,
  bedroom_count INTEGER,
  bathrooms DOUBLE,
  building_square_feet DOUBLE,
  assessed_value_usd DOUBLE,
  year_built INTEGER,
  latitude DOUBLE,
  longitude DOUBLE,
  source_name VARCHAR NOT NULL,
  source_url VARCHAR NOT NULL,
  source_vintage VARCHAR NOT NULL,
  ingestion_run_id VARCHAR NOT NULL
);

CREATE INDEX IF NOT EXISTS property_market_record_tract_idx
  ON standardized.property_market_record (tract_geoid);

CREATE INDEX IF NOT EXISTS property_market_record_city_sale_idx
  ON standardized.property_market_record (city, sale_date);
