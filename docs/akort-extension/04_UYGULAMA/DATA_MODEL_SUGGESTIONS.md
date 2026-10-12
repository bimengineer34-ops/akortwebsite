# Önerilen kayıtlar — mevcut tablo/ORM şemasına göre uyarlanmalı
ContentSeo: contentId, title, metaDescription, focusQuery, canonical, robots, schemaJson, imageAssetId, updatedAt.
ContentRevision: contentId, revisionId, authorId, snapshot, status, approvedBy, timestamp.
MediaAsset: id, sourceHash, originalPath, variants, alt, width, height, license, owner.
BrandKit: palette, typography, logoAssetIds, tokens, rulesVersion; Template: layersJson, format, version.
AiProviderConfig: provider, keySecretRef, allowedModelIds, status, budgets; AiUsage: provider, model, tokens, costEstimate, taskId.
SocialConnection: provider, accountId, tokenSecretRef, scopes, capabilities, status; SocialPost: versions, contentHash, approval, schedule, platformPostId, idempotencyKey, publishStatus.
Source: type, officialUrl, accessMethod, language, legalPolicy, lastCheck, pollRate; SourceItem: canonicalUrl, checksum, publishedAt, fetchedAt, summary, rights, validation.
Competitor: domain, sources, sector; KeywordObservation: keyword, locale, device, rank, provider, observedAt, estimatedFlag.
BacklinkOpportunity: source, destination, scoreReason, outreachStatus, verificationAt.
Lead: origin, campaign, contactConsent, stage, owner, relatedSourceItem.
AuditLog: actor, action, entity, oldHash, newHash, at, correlationId.
Job: eventType, payloadRef, idempotencyKey, state, attempts, lastError.

Never create parallel duplicate tables before checking existing models. Add only necessary migrations and indexes.
