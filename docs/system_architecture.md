# System Architecture: sell_helper

## 1. System Overview & Vision
`sell_helper` is an autonomous, private, AI-augmented assistant designed to streamline the resale of used goods. It operates primarily as an interactive Telegram Bot backed by a robust NestJS backend. The system leverages the Google Gemini AI engine to perform multimodal item evaluation, market price estimation, multi-platform ad copy synthesis (e.g., Avito, Kufar, Facebook Marketplace, Telegram channels), and generates responsive Server-Side Rendered (SSR) web view previews.

Access is strictly private and restricted to authorized Telegram user IDs defined in the server environment configuration.

---

## 2. High-Level Architecture & Topography

The system runs as a containerized service deployed on local hardware (ZimaBoard running ZimaOS) or Linux hosts using Docker and Docker Compose.

```mermaid
graph TD
    User["Authorized Telegram User"] -->|Interacts via Chat / Photos / Voice| TG["Telegram Bot Platform"]
    TG -->|Webhook / Polling| App["NestJS Application Container"]

    subgraph "sell_helper Core Engine (NestJS)"
        App --> TM["TelegramModule (Telegraf)"]
        TM --> Auth["TelegramAuthGuard (Whitelist)"]
        Auth --> Session["SessionManager"]
        Session --> BotHandler["Bot Wizard / Command Handlers"]

        BotHandler --> AIM["AiModule"]
        AIM --> Gemini["Google Gemini API SDK (@google/genai)"]

        BotHandler --> DM["DatabaseModule (Prisma ORM)"]
        DM --> SQLite["SQLite Embedded Database (data/sell_helper.db)"]

        App --> WVM["WebviewModule (EJS SSR Engine)"]
        WVM --> DM
    end

    Browser["Web Browser (Ad Preview)"] -->|HTTP GET /ads/:id| WVM
```

---

## 3. Modular Architecture Breakdown

The backend is decomposed into decoupled, cohesive NestJS modules:

| Module | Core Responsibility | Key Services / Controllers |
| :--- | :--- | :--- |
| **`ConfigModule`** | Environment variable loading, schema validation, whitelist parsing | `ConfigService`, `.env` validation schema |
| **`DatabaseModule`** | Database connection pooling, SQLite persistence, migrations | `PrismaService`, Prisma Client |
| **`TelegramModule`** | Telegraf bot lifecycle, updates handling, auth guarding, scenes | `TelegramBotService`, `TelegramAuthGuard`, `BotUpdateHandler` |
| **`AiModule`** | Gemini AI client integration, price analysis, ad prompt generation | `GeminiAiService`, `PromptTemplateRegistry` |
| **`AdsModule`** | CRUD operations for item sale requests, generated ad texts, photos | `AdsService`, `AdsRepository` |
| **`WebviewModule`** | Server-side rendering (SSR via EJS) for clean ad preview pages | `WebviewController`, EJS view templates |

---

## 4. Security & Access Control Topology

```mermaid
sequenceDiagram
    autonumber
    actor U as Telegram User
    actor Admin as First User (Administrator)
    participant TG as Telegram API
    participant Bot as Telegraf Bot Engine
    participant Guard as TelegramAuthGuard
    participant Handler as Bot Command / Action Handler
    participant DB as SQLite (Prisma)

    U->>TG: Send Message / Command (e.g. /start)
    TG->>Bot: Incoming Update
    Bot->>Guard: Intercept Update (Extract ctx.from.id)
    alt No Admin Exists (First User)
        Guard->>DB: Upsert User (role: ADMIN, isAuthorized: true, status: APPROVED)
        Guard-->>Bot: Allow Execution
        Bot->>Handler: onStart()
        Handler-->>Admin: 👑 "Registered as Administrator"
    else User Already Authorized
        Guard->>DB: Query User(userId) -> isAuthorized: true
        Guard-->>Bot: Allow Execution
        Bot->>Handler: Process Command / State Transition
        Handler-->>U: Authorized Menu / Response
    else User Pending / New User
        Guard->>DB: Record User(status: PENDING, isAuthorized: false)
        Guard-->>U: ⏳ "Request sent to administrator for approval"
        Guard->>Admin: 🔔 "New Request" + [Подтвердить] [Удалить]
    else Admin Clicks [Подтвердить]
        Admin->>Bot: Callback Query approve:<userId>
        Guard-->>Bot: Allow (Caller is ADMIN)
        Bot->>Handler: onApproveUser()
        Handler->>DB: Update User(isAuthorized: true, status: APPROVED)
        Handler-->>Admin: ✅ "User Approved"
        Handler-->>U: 🎉 "Access Approved! Welcome to Sell Helper."
    else Admin Clicks [Удалить]
        Admin->>Bot: Callback Query reject:<userId>
        Guard-->>Bot: Allow (Caller is ADMIN)
        Bot->>Handler: onRejectUser()
        Handler->>DB: Update User(isAuthorized: false, status: REJECTED)
        Handler-->>Admin: ❌ "User Rejected"
    end
```

### Dynamic First-Admin & Approval Flow Protocol
- The primary access control mechanism is database-driven via the `users` table.
- **First-User Bootstrapping**: The first user to interact with the bot when no administrator exists is automatically granted the `ADMIN` role and immediate authorization (`isAuthorized = true`).
- **Access Requests**: Any subsequent unregistered or unauthorized user is marked with `status = 'PENDING'` (`isAuthorized = false`), receives a waiting notification, and an interactive message is forwarded to the administrator with inline buttons:
  - **«Подтвердить»** (`approve:<userId>`): Promotes user status to `APPROVED`, sets `isAuthorized = true`, and notifies the applicant.
  - **«Удалить»** (`reject:<userId>`): Sets status to `REJECTED`, keeping the system unavailable for the user.
- **Guard Enforcement**: `TelegramAuthGuard` verifies user status dynamically against the SQLite database via Prisma, permitting callback queries strictly for administrators and blocking non-authorized messages.

---

## 5. Domain Data Models (Prisma & SQLite)

```mermaid
erDiagram
    User ||--o{ SaleRequest : initiates
    SaleRequest ||--o{ GeneratedAd : produces
    SaleRequest ||--o{ RequestMedia : contains

    User {
        string id PK "Telegram User ID"
        string username "Telegram Username"
        string firstName "Telegram First Name"
        string role "ADMIN or USER"
        string status "PENDING, APPROVED, REJECTED"
        boolean isAuthorized "Access Flag"
        datetime createdAt "Creation Timestamp"
        datetime updatedAt "Update Timestamp"
    }

    SaleRequest {
        string id PK "CUID or UUID"
        string userId FK "Foreign Key to User"
        string itemTitle "Title or Brief Name"
        string rawDescription "User Raw Input (Text or Transcribed Audio)"
        float estimatedPriceMin "Estimated Min Price"
        float estimatedPriceMax "Estimated Max Price"
        string currency "EUR, USD, BYN, RUB"
        string status "DRAFT, ANALYZING, COMPLETED, ARCHIVED"
        datetime createdAt "Timestamp"
        datetime updatedAt "Timestamp"
    }

    RequestMedia {
        string id PK "Media ID"
        string saleRequestId FK "Foreign Key to SaleRequest"
        string fileType "IMAGE, AUDIO, DOCUMENT"
        string localPath "Path in mounted volume"
        string telegramFileId "Telegram File Identifier"
        datetime createdAt "Timestamp"
    }

    GeneratedAd {
        string id PK "Ad ID"
        string saleRequestId FK "Foreign Key to SaleRequest"
        string targetPlatform "AVITO, KUFAR, FACEBOOK, TELEGRAM"
        string adTitle "Synthesized Title"
        string adContent "Formatted Markdown/Text"
        float recommendedPrice "Target Listed Price"
        datetime createdAt "Timestamp"
    }
```

---

## 6. Containerization & Storage Strategy

- **Base Image**: `node:22-alpine` (lightweight, secure).
- **Container Registry**: GitHub Container Registry (GHCR) at `ghcr.io/rokhlin/sell_helper`.
  - Images are published automatically on every version tag push (`v*.*.*` / `*.*.*`) via the `Release & Container Build` GitHub Actions workflow.
  - The workflow runs unit tests first; the build+push job only runs if tests pass.
  - Published tags: exact version tag (e.g. `v1.2.3`), `latest`, and `MAJOR.MINOR` float tags — generated by `docker/metadata-action`.
  - Authentication uses the workflow-scoped `GITHUB_TOKEN` (no manual secrets required).
  - Build cache is persisted via GitHub Actions cache (`type=gha`) for faster subsequent builds.
- **Persistent Data & Configuration Volume**:
  - Configuration directory: `/app/data/config/.env` contains runtime environment variables, bot credentials, and access whitelist.
  - SQLite database file located at `/app/data/sell_helper.db`.
  - Media storage located at `/app/data/uploads/`.
- **Docker Compose Setup**: Single-service orchestration pulling `ghcr.io/rokhlin/sell_helper:latest` with host `./data` volume mounts preserving configuration, database, and media across container updates. No local build required on the deployment host.

---

## 7. Quality Gate & Testing Strategy

- **Unit Testing**: Jest tests targeting guards, utility services, and state machines with minimum **75% code coverage**.
- **Mocking**: Full mock suites for Telegraf Context (`TelegrafContextMock`) and external AI SDK calls.
- **Static Analysis**: ESLint and Prettier integrated with GitHub Actions CI pipeline.
