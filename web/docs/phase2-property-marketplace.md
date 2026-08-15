# Phase 2 property marketplace

## Functional scope

The marketplace is a private, source-controlled workspace. It accepts:

- manually entered properties;
- CSV files using the downloadable contract;
- authorized broker, public-record, licensed-feed, or internal research records.

It never scrapes restricted listing sites and ships with zero synthetic property records.

## Import contract

Required per record: `source_record_id`, `address`, `city`, `state`, `property_type`,
and `asking_price`. Required per import: source name and permission/license basis. Coordinates,
tract GEOID, rents, expenses, and physical facts are optional and remain null when absent.

Validation rejects invalid property types, nonpositive prices, invalid coordinates, negative
amounts, impossible years, invalid vacancy rates, and imports larger than 500 rows. A compound
user/source/record key updates a previously imported source observation instead of duplicating it.

## Basic favorability v1

The Phase 2 screening signal uses:

- rent-to-price component (40%);
- linked Phase 1 balanced tract score (35%);
- recurring-expense coverage proxy (15%);
- data completeness (10%).

Missing components are excluded and remaining weights are renormalized. At least two
decision components are required before a status is shown. Completeness determines confidence.
The recurring-expense proxy excludes debt service, capital expenditures, management, utilities,
closing costs, and taxes beyond the imported property-tax amount. It is not an appraisal or full
underwriting result.

## Persistence and privacy

D1 stores import metadata, normalized private property facts, and saved properties. All reads and
writes are scoped by the authenticated Sites user email. Raw CSV bytes are parsed in the browser
and are not retained or redistributed.

## Acceptance checks

- strict TypeScript and lint pass;
- production Worker build passes;
- rendered marketplace, blank-template, and row-validation tests pass;
- import source and permission fields are required;
- no deployed property seed data exists;
- empty, loading, validation, authentication, and missing-data states are explicit.
