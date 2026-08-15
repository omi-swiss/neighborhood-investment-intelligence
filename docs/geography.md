# Geography strategy

Facts use `tract GEOID + geography vintage`, not a GEOID alone. `standardized.geography` is a versioned dimension holding geometry, centroid, parent, validity, area, source, and vintage. Place, CBSA, ZCTA, municipal boundaries, police/school/transit districts, opportunity zones, and user neighborhood polygons are independent layers; informal neighborhood names are never treated as geographic truth.

Spatial joins must use matching vintages and persist their assignment method. The `geography_assignment` table holds tract-to-place and tract-to-CBSA centroid assignments, with method, source, vintage, and confidence; a missing place or CBSA assignment is retained rather than guessed. The `geography_crosswalk` table records from/to GEOIDs, method, weight, source, and uncertainty. Trends spanning 2010/2020 tract vintages are marked `GEOGRAPHY_NORMALIZATION_REQUIRED`; compare only after approved area-, population-, or housing-weighted normalization.
