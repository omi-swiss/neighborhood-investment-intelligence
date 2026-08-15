function supportedListingHost(hostname: string): boolean {
  return [
    "zillow.com",
    "www.zillow.com",
    "redfin.com",
    "www.redfin.com",
    "realtor.com",
    "www.realtor.com",
  ].includes(hostname.toLowerCase());
}

export async function POST(request: Request) {
  const body = await request.json() as { url?: string };
  let url: URL;
  try {
    url = new URL(body.url ?? "");
  } catch {
    return Response.json({ error: "Enter a complete listing URL." }, { status: 400 });
  }
  if (url.protocol !== "https:" || !supportedListingHost(url.hostname)) {
    return Response.json(
      { error: "Use an HTTPS Zillow, Redfin, or Realtor.com listing URL." },
      { status: 400 },
    );
  }
  return Response.json({
    sourceUrl: url.toString(),
    status: "link-only",
    fieldsImported: [],
    missingFields: ["price", "rent", "taxes", "insurance", "property facts"],
    message:
      "The listing link is valid and can be retained as source evidence. Automated extraction is unavailable without an authorized feed, so no property facts were invented.",
  });
}
