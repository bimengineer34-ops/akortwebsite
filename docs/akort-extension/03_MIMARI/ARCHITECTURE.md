# Uygulama mimarisi (stack-agnostic)
Existing monolith/modular monolith preferred. Modules as services/components inside existing application, NOT a second disconnected dashboard.

Interfaces: ContentRepository, SeoAnalyzer, MediaProcessor, AiProviderAdapter, SocialProviderAdapter, DataSourceAdapter, SearchDataProvider, AnalyticsProvider, CacheManager, BackgroundJobDispatcher, NotificationService, ApprovalService.

Typical flow:
Content Edit -> local SEO checks -> versioned draft -> AI suggestion -> review -> publish transaction -> outbox events -> sitemap/cache/media jobs -> monitor -> social derivative draft -> approval -> scheduled publisher -> platform response + analytics.

Media: original immutable + transformations keyed by source hash, presets, alt metadata, signed/private storage as appropriate, public static CDN URLs when published.

Data boundaries: public content, private CMS, external tokens/secrets, source feed excerpts, AI prompt metadata and audit. Store consent and origin for each ingestion event. Use prepared queries and output encoding.

Queue: DB-backed or infrastructure already in repo. One durable idempotency key per action and retries with backoff/dead-letter. Respect time zones Europe/Istanbul and platform scheduling semantics.

Web adapters: respect ToS robots, conditional HTTP requests with etag/last-modified, exponential backoff, reasonable rate limits, distributed locks where needed.

No architecture choice (Redis, React, ASP.NET, Django) should be forced until repository inspection. Avoid unnecessary microservices.
