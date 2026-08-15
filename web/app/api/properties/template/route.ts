const headers = [
  "source_record_id",
  "address",
  "city",
  "county",
  "state",
  "postal_code",
  "latitude",
  "longitude",
  "parcel_id",
  "property_type",
  "unit_count",
  "bedrooms",
  "bathrooms",
  "building_square_feet",
  "lot_square_feet",
  "year_built",
  "asking_price",
  "current_monthly_rent",
  "market_monthly_rent",
  "annual_property_taxes",
  "annual_insurance",
  "hoa_monthly",
  "maintenance_monthly",
  "vacancy_assumption",
  "renovation_estimate",
  "listing_date",
  "listing_status",
  "broker",
  "tract_geoid",
  "observed_at",
];

export async function GET() {
  return new Response(`${headers.join(",")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nii-property-import-template.csv"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
