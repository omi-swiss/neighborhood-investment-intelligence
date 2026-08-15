# Environment and integrations

## Runtime bindings

The hosted application uses logical bindings configured by the deployment environment:

- `DB`: Cloudflare D1 database used for private saved work, property records, underwriting versions, comparable selections, watchlists, searches, and alerts.
- `R2`: not currently configured.

The web application does not require a checked-in `.env` file. `NII_D1_BINDING` defaults to `DB`, and `NII_R2_BINDING` is optional. Hosted values belong in the deployment environment. Local development uses the Vinext/Cloudflare runtime and accepts the local development identity only on localhost.

## Build-time variables

`vite.config.ts` uses internal development variables for sandbox and Wrangler log paths. These are development controls, not product credentials.

## Data-pipeline credentials

Census, FBI, grants, listing, geocoding, parcel, or notification credentials belong in the upstream data-pipeline or hosted-secret store. They must never be committed to this repository or placed in browser code.

The current website build can run without external API keys. Most market artifacts are published
ahead of deployment; the Property Universe also makes bounded, server-side queries to official
Detroit, Charlotte-Mecklenburg, Charleston County, Boston, Tampa/Hillsborough, and Cook County
public-data services. Those endpoints do not require credentials. They are never called directly
from the browser, results are briefly cached, and source outages remain explicit.

Features that require a licensed listing feed or another credentialed provider must remain
unavailable until the provider, redistribution rights, secret storage, refresh schedule, and
validation rules are configured.

## Deployment

1. Use Node 22 or later and the checked-in pnpm lockfile.
2. Install with the frozen lockfile.
3. Run the Vinext production build.
4. Run the route and calculation tests.
5. Generate a Drizzle migration whenever `db/schema.ts` changes.
6. Publish the exact validated commit through the configured Sites project.
