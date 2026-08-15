const headers = [
  "comparable_type",
  "source_record_id",
  "address",
  "city",
  "county",
  "state",
  "postal_code",
  "latitude",
  "longitude",
  "parcel_id",
  "tract_geoid",
  "property_type",
  "unit_count",
  "bedrooms",
  "bathrooms",
  "building_square_feet",
  "year_built",
  "condition",
  "transaction_date",
  "sale_price",
  "monthly_rent",
  "observed_at",
];

export async function GET() {
  return new Response(`${headers.join(",")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nii-comparable-import-template.csv"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
