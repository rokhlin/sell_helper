# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Fixed
- **Gemini AI Model Cascade & Resilience**:
  - Replaced decommissioned `gemini-2.5-flash` with active models `gemini-3.5-flash` and `gemini-3.1-flash-lite` in the fallback cascade to eliminate 404 Not Found errors.
  - Implemented automatic failover from `gemini-3.8-flash` to secondary models to smoothly withstand transient 503 high-demand load spikes.
- **Telegram Inline Keyboard URL Handling**:
  - Added URL validation for inline keyboard buttons (`isValidTelegramButtonUrl`), preventing Telegram 400 Bad Request errors when `WEB_BASE_URL` is set to `localhost` or non-public domains.
  - Formatted local web preview links as copyable text in the message body when a public domain is not configured, while retaining the auto-publish callback button.
  - Added defensive error recovery when sending Telegram messages with inline keyboards, falling back to clean plain text without throwing unhandled exceptions.
  - Exposed `WEB_BASE_URL` in `docker-compose.yml`, `.env.example`, and `data/config/.env.example`.

### Added
- **Change Request CR-003: Facebook Channels & Communities Discovery**:
  - Implemented hybrid discovery of Israeli Facebook channels and resale groups combining a curated catalog (`CURATED_FACEBOOK_COMMUNITIES`) and dynamic Gemini matching with direct Facebook group search query synthesis.
  - Added `FacebookChannelRecommendation` and `FacebookCommunityType` to domain types (`src/ai/ai.types.ts`).
  - Added `recommendedChannels String?` (JSON serialized) to `SaleRequest` in Prisma schema and database.
  - Formatted and rendered Top-5 recommended Facebook channels with clickable direct links, language badges (`[RU]`, `[HE]`, `[EN]`), and descriptions in the Telegram bot output.
  - Enhanced SSR Web View (`views/ad-preview.ejs`) with an interactive channels section featuring responsive community cards, type and language tags, direct "Открыть в FB" links, and 1-click clipboard copy of adapted Facebook ad copy.
  - Expanded test suite to 66 passing tests across 11 suites with 0 lint errors.
- **Change Request CR-002: Israel Market Localization & Removal of Avito/Kufar**:
  - Removed Avito (`AVITO`) and Kufar (`KUFAR`) from platforms, types, prompt registry, and UI.
  - Added Yad2 (`YAD2`) as dedicated Israeli classified platform.
  - Localized default currency to Israeli New Shekels (`ILS` / ₪).
  - Added seller city grounding in Israel with automatic city detection in Russian, Hebrew, and English.
  - Implemented multi-language ad generation matrix: Yad2 strictly in Hebrew (`HE`), Facebook in Hebrew (`HE`), Russian (`RU`), and English (`EN`), Telegram in Russian (`RU`) and Hebrew (`HE`).
  - Added `city String?` to `SaleRequest` and `language String?` to `GeneratedAd` Prisma schema and database.
  - Enhanced SSR Web View (`views/ad-preview.ejs`) with Yad2 styling, language badges, RTL rendering for Hebrew, and tab navigation by ad ID.
  - Maintained 93.58% test coverage across 57 passing tests with 0 lint errors.
- **[SH-03] Web View Generation (EJS SSR)**:
  - Configured NestJS with EJS template engine (`NestExpressApplication`, `views/` directory).
  - Implemented `WebviewModule` and `WebviewController` handling `GET /ads/:id` with 404 validation.
  - Designed responsive, dark-mode preview web page (`views/ad-preview.ejs`) with Google Fonts Inter & JetBrains Mono, price breakdown, image gallery, and platform-specific tabs (Avito, Kufar, Facebook, Telegram).
  - Added interactive 1-click clipboard copy functionality ("Copy Title", "Copy Text", "Copy Full Ad") with 2-second visual confirmation feedback.
  - Linked Telegram bot responses and inline buttons directly to live preview URLs via `webBaseUrl` configuration (`WEB_BASE_URL`).
  - Updated `Dockerfile` to copy `views/` into the production container image.
  - Achieved 93.53% line coverage across 56 passing unit tests with 0 lint violations.
- **[SH-02] AI Content Generation Flow**:
  - Integrated Google Gemini AI SDK (`@google/genai`) with primary `gemini-3.8-flash` model and resilient `gemini-2.5-flash` fallback cascade.
  - Implemented `AiModule` and `AiService` supporting multimodal item evaluation (text descriptions, photos with visual condition recognition, and voice audio notes).
  - Implemented `PromptRegistryService` enforcing structured JSON generation for item identification, completeness audit, photo guidance, secondary market pricing (min, max, recommended, currency, reasoning), and platform recommendations.
  - Implemented `AdsModule` and `AdsService` with Prisma SQLite persistence for `SaleRequest`, `RequestMedia`, and `GeneratedAd` records.
  - Implemented interactive Telegram handlers (`onText`, `onPhoto`, `onVoice`) with real-time `sendChatAction` indicators (`typing`, `record_voice`), conversational clarification prompting, photo capture recommendations, and tailored ad texts for Avito, Kufar, Facebook Marketplace, and Telegram.
  - Added callback actions for Web preview link (`webview:<id>`) and auto-publish (`autopublish:<id>`).
  - Achieved 93.26% test coverage across 53 unit tests with zero lint errors.
- **Dynamic First-Admin & Telegram Approval Workflow (CR-001)**:
  - First user contacting the bot automatically bootstraps as the system Administrator (`ADMIN` role, immediate authorization).
  - Subsequent unauthorized users are registered as `PENDING` and trigger real-time approval notifications to the administrator.
  - Interactive inline keyboard with «Подтвердить» (`approve:<userId>`) and «Удалить» (`reject:<userId>`) action buttons for instant access delegation.
  - Automatic applicant notification upon approval or rejection.
  - Added `role` and `status` fields to `User` Prisma model and synced SQLite database.
  - Updated `TelegramAuthGuard`, `TelegramService`, and `TelegramUpdate` action listeners with 96.35% code coverage.
- **GHCR Container Publishing**:
  - Updated `Release & Container Build` GitHub Actions workflow to authenticate to GitHub Container Registry and push `ghcr.io/rokhlin/sell_helper` images on every version tag.
  - Workflow now runs unit tests before the build/push step (gate on green tests).
  - Published image tags: exact version, `latest`, and `MAJOR.MINOR` via `docker/metadata-action`; GHA build cache enabled.
  - Updated `docker-compose.yml` to pull from `ghcr.io/rokhlin/sell_helper:latest` instead of performing a local build — deployment hosts no longer require Node.js or source code.
- **Automatic Database Initialization on Container Startup**:
  - Added `docker-entrypoint.sh` executing `npx prisma db push --skip-generate` on container boot to ensure SQLite schema and tables are automatically initialized on fresh volume mounts.
  - Moved `prisma` package to production `dependencies` in `package.json` and added `openssl` to Alpine runner image for runtime Prisma engine execution.
  - Added `.gitattributes` to enforce LF line endings for shell scripts.


## [0.1.0] - 2026-10-03
### Added
- **Foundations & Architecture (Phase 0)**:
  - Initialized NestJS 10 application with TypeScript strict mode.
  - Configured Prisma ORM with SQLite embedded database schema (`User`, `SaleRequest`, `RequestMedia`, `GeneratedAd`).
  - Added multi-stage production Dockerfile and `docker-compose.yml` for ZimaOS/Linux deployment.
  - Setup GitHub Actions CI workflows for PR validation (lint, test with >=75% coverage check, build) and automated container release.
  - Authoritative living architecture document (`docs/system_architecture.md`) with C4, sequence, and ERD diagrams.
- **[SH-01] Telegram Bot Integration & Auth**:
  - Implemented `TelegramModule` with Telegraf and session middleware.
  - Implemented `TelegramAuthGuard` enforcing strict access control whitelist from `AUTHORIZED_USERS` environment variable.
  - Configured responsive welcome and help command handlers (`/start`, `/help`).
  - Added unit test suite covering configuration, guards, services, and updates with 98.75% code coverage.
  - Relocated runtime environment configuration to `data/config/.env` with `data/config/.env.example` template, integrated into `ConfigModule` and `docker-compose.yml`.
