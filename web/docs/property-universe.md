# Property Universe

The Property Universe separates public parcel and recorded-sale evidence from active listings.
A parcel appearing in the product does not mean it is for sale, and an assessed value is not an
asking price or appraisal.

The product uses three consistent views:

- **Recent sales** includes only records with a valid recorded-sale date and defaults to a rolling
  five-year window. Users can select 1, 3, 5, or 10 years, or all available history.
- **All properties** includes the available parcel, assessment, and sale-backed public records.
  Assessment years and record-update dates are labeled as record vintages, never as sale dates.
- **Prospecting list** is device-local and displays only records the user explicitly saved. Opening
  it does not query or load additional public records.

## Coverage model

Washington, Baltimore, and Philadelphia use bounded, generated snapshots from the existing
auditable ingestion pipeline. Detroit, Charlotte, Charleston, Boston, Tampa, and Chicago use
on-demand server-side queries against official public systems. Live lookups require a selected
market and at least three search characters; this avoids loading entire county parcel datasets and
keeps the site bundle small.

| Market | Official source | Mode | Principal fields |
| --- | --- | --- | --- |
| Washington, DC | DC Office of Tax and Revenue / DC GIS | Snapshot | parcel, address, sale, assessment, tax, characteristics |
| Baltimore, MD | Baltimore City GIS / Maryland SDAT | Snapshot | parcel, address, neighborhood, sale, size, year built |
| Philadelphia, PA | Philadelphia OPA | Snapshot | parcel, address, neighborhood, sale, type, characteristics |
| Detroit, MI | City of Detroit current parcel service | Live official search | parcel, address, use, neighborhood, assessment, sale, size, year built |
| Charlotte, NC | Charlotte-Mecklenburg GIS | Live official search | parcel, address, use, value, deed/sale context, size, year built |
| Charleston, SC | Charleston County GIS | Live official search | parcel, address, jurisdiction, record update date |
| Boston, MA | Boston FY2026 assessment service | Live official search | parcel, address, use, value, tax, size, beds, baths, year built |
| Tampa, FL | Tampa GIS / Hillsborough County Property Appraiser | Live official search | folio/PIN, address, use, value, sale, size, year built |
| Chicago, IL | Cook County Assessor Open Data | Live official search | PIN, address, assessor class, community area, tract, coordinates, latest recorded sale |

## Reliability and privacy

- Searches are normalized to a common property record without exposing owner names or mailing
  addresses.
- Live-source failures return a recoverable message and the official search link; they never create
  substitute records.
- External responses are cached briefly to reduce load, and results are paginated 12 at a time.
- Prospecting lists remain device-local and export with explicit ownership, contact, and Do Not Call
  verification reminders.
- Active listings remain limited to licensed, permissioned, broker-provided, or user-imported data.

No API key is required for these official public endpoints. A future licensed listing feed would
require separate commercial terms and must remain distinct from this public-record layer.
