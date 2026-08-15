-- Shared geographic naming, market, signal, and tax-evidence contracts.
-- This migration is additive and preserves existing tract and property tables.

CREATE TABLE IF NOT EXISTS standardized.supported_market (
    market_id VARCHAR PRIMARY KEY,
    geography_type VARCHAR NOT NULL CHECK (geography_type IN ('place', 'metro')),
    city_geoid VARCHAR,
    metro_geoid VARCHAR,
    city_name VARCHAR NOT NULL,
    state_abbr VARCHAR NOT NULL,
    market_name VARCHAR NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    coverage_status VARCHAR NOT NULL,
    source_url VARCHAR,
    updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS standardized.geographic_area_name (
    geography_id VARCHAR NOT NULL,
    geography_type VARCHAR NOT NULL,
    display_name VARCHAR NOT NULL,
    tract_label VARCHAR,
    neighborhood_name VARCHAR,
    county_name VARCHAR,
    city_name VARCHAR,
    state_abbr VARCHAR,
    source_name VARCHAR NOT NULL,
    source_url VARCHAR,
    confidence VARCHAR NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    observation_count BIGINT NOT NULL DEFAULT 0,
    effective_date DATE,
    updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (geography_id, source_name)
);

CREATE TABLE IF NOT EXISTS standardized.city_signal_event (
    signal_id VARCHAR PRIMARY KEY,
    market_id VARCHAR NOT NULL,
    category VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    organization VARCHAR,
    status VARCHAR NOT NULL,
    announcement_date DATE,
    latitude DOUBLE,
    longitude DOUBLE,
    coordinate_precision VARCHAR,
    county_geoid VARCHAR,
    source_name VARCHAR NOT NULL,
    source_url VARCHAR NOT NULL,
    evidence_excerpt VARCHAR,
    reviewed_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS standardized.property_tax_estimate (
    estimate_id VARCHAR PRIMARY KEY,
    property_key VARCHAR,
    market_id VARCHAR NOT NULL,
    tax_year INTEGER,
    assessed_value_usd DOUBLE,
    effective_rate DOUBLE,
    annual_tax_usd DOUBLE,
    estimate_method VARCHAR NOT NULL,
    source_name VARCHAR NOT NULL,
    source_url VARCHAR NOT NULL,
    confidence VARCHAR NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);
