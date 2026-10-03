# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
