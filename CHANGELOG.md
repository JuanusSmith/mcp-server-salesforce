# Changelog

All notable changes to this fork are documented here.

## [1.3.1] - 2026-07-20

### Added
- **`Access_Token` connection type**: Connect directly with a pre-issued Salesforce access token and instance URL (`SALESFORCE_ACCESS_TOKEN` / `SALESFORCE_INSTANCE_URL`), without needing username/password or OAuth client credentials. (cherry-picked from upstream)
- **`SALESFORCE_API_VERSION` environment variable**: Pin a specific Salesforce API version for any authentication method, avoiding failures on newer standard objects (e.g., `AccountPlan`) that require an API version newer than jsforce's default. (cherry-picked from upstream)

## [1.3.0] - 2026-07-19

### Added
- **Describe result caching**: `salesforce_describe_object` now caches results per object for 10 minutes, avoiding repeated live API calls for schema that rarely changes mid-session.
- **`forceRefresh` parameter**: Optionally bypass the cache and fetch current metadata directly from Salesforce — useful right after adding or changing a field.
- **`fields` parameter**: Optionally return only specific fields instead of the full object schema, significantly reducing response size for large objects (e.g., Account, Opportunity) when only a few fields are needed.

### Changed
- `salesforce_describe_object` responses now indicate whether the result came from cache or was freshly fetched.
- When a `fields` filter is used, the response also reports any requested field names that weren't found on the object.

## [1.2.0] and earlier
See git history for changes prior to this changelog's introduction.
