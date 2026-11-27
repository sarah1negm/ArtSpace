# Queens Art — Person 2 Milestone 2

## Branch and scope

Branch: `person-2/milestone-2-marketplace`, based on master `7768e7e`.
Existing authentication, Student Portal, Accounting calculations, Home assets and storage-recovery
code were preserved. Git history records publication status; merging into master requires team-leader review.
The only Student API change instruments the shared catalogue request timing.

## Repository audit and completed checklist

| Area | Before this change | Current result |
| --- | --- | --- |
| Laravel sessions, login, roles and CSRF | Implemented | Reused unchanged |
| Student artwork CRUD and image upload | Implemented | Reused unchanged |
| Public unsold artwork catalogue | Implemented | Reused unchanged |
| Gallery and Details | Backend listings plus browser mocks | API-backed listings only in the running application |
| Search/category/price/sort | Implemented | Preserved with signals/computed |
| Lazy images, responsive layout, add animation | Implemented | Preserved; success follows confirmed writes |
| Cart persistence | Browser localStorage demo | Laravel server session, database session driver locally |
| Simulated checkout | Clears browser cart | Authenticated transaction creates existing ArtworkSale records |
| Unique artwork purchases | Missing server enforcement | One per listing; row locks and existing unique sale constraint |
| Student sales/earnings and 15% commission | Reads existing sales | Purchases flow into this existing contract; seller payout remains Pending |
| Accounting backend payout management | Browser demo, owned by Person 4 | Not implemented or duplicated here |
| Monitoring | Missing | Optional privacy-restricted LogRocket SDK and three timing events |
| Hosted monitoring dashboards/case study | No account access | Manual account steps remain below |

## Environment installed and configured

- PHP 8.4.28; curl, fileinfo, mbstring, openssl, pdo_mysql, pdo_sqlite, sqlite3, zip.
- Composer 2.11.3; existing composer.lock installed without updates.
- MySQL 8.4.9 ZIP distribution under the current user's LocalAppData/QueensArt/tools.
- New isolated MySQL data directory, loopback port **3307**; no existing database changed.
- Application database/user: `queens_art_local`, limited to its database and the separate test database.
- Separate opt-in concurrency database: `queens_art_marketplace_test`.
- Fresh ignored `backend/.env`, generated application key, existing migrations and StudentDemoSeeder.
- MarketplaceDemoSeeder adds three local illustrations with UUID listings. Rerunning does not reset sold,
  edited or deleted fixtures. Run it only after StudentDemoSeeder; it is restricted to local/testing.
- Generated credentials are in ignored `backend/storage/app/private/local-setup/credentials.json`.
  Read the `demoPassword` field locally for the demo users; never commit or publish this file.
- PHP, Composer and MySQL were appended to the user PATH. Open a new terminal to inherit it.

Local URLs: Angular `http://127.0.0.1:4200`, Laravel `http://127.0.0.1:8000`.
Angular's existing proxy forwards `/api/*`. Keep same-origin proxying in deployment.
Use HTTPS, APP_DEBUG=false and secure session cookies in production. These local services are loopback-only.

## Portable fresh-clone setup

Once the approved feature branch is published, clone the repository and select
`person-2/milestone-2-marketplace`. Do not assume these changes are already merged into master.
Use Node 24.x (tested 24.16.0), npm 11.x, PHP 8.4 with the extensions above, Composer 2 and MySQL 8.4.

1. In the repository root run `npm ci` (installs the exact lockfile).
2. In `backend` run `composer install`. Copy `.env.example` to `.env`; do not copy someone else's key or credentials.
3. Using your own MySQL administrator, create a **new** empty application database and a dedicated user with
   privileges only on that database. Set DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME and DB_PASSWORD in `.env`.
   Your MySQL port may be 3306; this laptop uses 3307. Keep SESSION_DRIVER=database, SESSION_CONNECTION unset,
   CACHE_STORE=database, APP_ENV=local and APP_URL=http://127.0.0.1:8000. Use InnoDB tables.
4. Run `php artisan key:generate` and `php artisan migrate` in `backend`.
5. For demo users choose a private 12–72 byte password. PowerShell can set it without command-history text:

   ```powershell
   $demoSecret = Read-Host 'Local demo password' -AsSecureString
   $env:ARTSPACE_DEMO_PASSWORD = (New-Object System.Net.NetworkCredential('', $demoSecret)).Password
   php artisan db:seed --class=StudentDemoSeeder
   php artisan db:seed --class=MarketplaceDemoSeeder
   Remove-Item Env:ARTSPACE_DEMO_PASSWORD
   ```

6. Keep Laravel running with `php artisan serve --host=127.0.0.1 --port=8000`.
7. In a second terminal at the repository root run `npm start -- --host=127.0.0.1 --port=4200`.
8. Open http://127.0.0.1:4200. Sign in as portal-demo-one or portal-demo-two with your chosen password.
   For accountant/admin users, use the existing `artspace:create-user` command documented in backend/README.md.
9. Run the verification commands below. For smoke testing set ARTSPACE_DEMO_PASSWORD to the same password.
   On Linux/macOS supply CHROME_BIN explicitly; Windows automatically finds per-user Chrome.

Independent clean-snapshot verification excluded `.env`, credentials, node_modules and vendor: npm ci,
production build, Composer install, key generation, migrations and both seeders passed. Fresh migrations/
seeders passed on both a temporary SQLite database and a separately created MySQL review database.
This is a clean working-snapshot check; remote branch availability is verified separately at publication.

## API endpoints

All writes use Laravel web middleware and CSRF. Initialize with GET `/api/auth/session`.
Angular automatically sends `X-XSRF-TOKEN` from the current cookie on relative requests.
CSRF tokens rotate on login: a custom client must reread the cookie after signing in.

| Method | Endpoint | Body / response |
| --- | --- | --- |
| GET | `/api/artworks` | Existing public active, unsold catalogue; Details resolves its UUID from this data |
| GET | `/api/artwork-images/{filename}` | Existing validated upload delivery |
| GET | `/api/cart` | `{lines:[{artwork,quantity}],total,unavailableIds}` |
| POST | `/api/cart/items` | `{artworkId: UUID}`; duplicate additions remain quantity 1 |
| PATCH | `/api/cart/items/{UUID}` | `{quantity:1}`; unique originals cannot have quantity 2 |
| DELETE | `/api/cart/items/{UUID}` | Remove available or unavailable ID; returns cart |
| DELETE | `/api/cart` | Clear cart; returns cart |
| POST | `/api/cart/checkout` | Authenticated; `{requestId:UUID,expectedTotalMinor?:integer}`; receipt with saleIds, total, quantity, simulated |

Errors: 401 sign in; 419 expired/missing CSRF; 422 invalid input, own artwork or empty cart;
409 removed/sold artwork or a changed displayed total. Angular sends expectedTotalMinor as a consent
check; the server still computes every price. Failed checkout rolls back **all** new sales and preserves the cart.
There is no real payment processor or card collection. Prices, dates, seller and availability
come from the database, never submitted prices. Any allowed signed-in role can buy another
student's artwork; Student/Accounting authorization is unchanged. Guest carts are supported.

## Data/storage design and concurrency

- Cart holds only IDs in server session key `marketplace.cart.v1`. Every response resolves current
  artwork data/prices. Unavailable IDs remain visible as unavailable and can be removed.
- ALL web-session requests use Laravel session blocking with the configured cache lock store. Locking
  only cart writes would let parallel catalogue/auth requests overwrite newer session data. The lock
  lease is 120 seconds, wait 15 seconds; keep deployed request timeouts below the lease. Locally both
  session storage and cache locks use MySQL; deploy a supported shared lock store for multiple servers.
- Each checkout locks all artwork rows in consistent UUID order, rechecks sales, and writes snapshots
  inside one database transaction. The existing UNIQUE artwork_sales.artwork_id constraint is retained.
- No shared schema or Artwork/ArtworkSale model changes, order tables or Accounting duplication.
- Sales use integer piasters; existing student endpoint rounds the 15% commission to nearest piaster.
  `paid_on` stays null: recording a sale does not falsely claim the accountant paid the seller.
- The most recent ten checkout receipts are kept in the session, keyed by **buyer ID + request ID**.
  Receipt, cleared cart and sales are saved inside ONE database transaction on the default connection.
  A session-write exception restores original in-memory attributes and rolls back sales. A failure after
  commit can recover the persisted receipt. Checkout refuses a non-database/separate-connection session
  configuration (503), except the isolated array-session unit/concurrency fixtures in APP_ENV=testing.
- Repeated requests in the retained session return the same receipt plus the **current** cart; they do not
  clear a subsequently added cart. Uncertain client outcomes retain the request ID/confirmed total and
  block edits until the result is checked, even after a cart reload returns empty or unavailable items.
- Receipt recovery is session-scoped, not permanent buyer order history. Session expiry/logout or eviction
  after ten receipts removes replay history. The retry key lives in Angular memory: a full page reload
  loses that key, although the committed sales and session receipt remain. No permanent order history or
  external payment processing is claimed. A separate order schema requires team coordination.
- Session expiry/logout clears the server cart by design. Legacy browser carts are neither imported nor
  deleted. Unit-test/browser-demo mode retains the existing localStorage behavior and quantity controls.
- Authentication changes reload cart state; late responses from a previous identity are ignored.
- UUID retry keys use getRandomValues, including HTTP LAN origins where randomUUID is unavailable.

## Verification evidence

Baseline: Angular **232 tests passed**; Laravel **10 tests / 94 assertions passed**.

Current verification:

- Angular Jasmine/Karma: **254 passed, 0 failed**, ChromeHeadless.
- Laravel default SQLite suite: **23 passed, 0 failed, 186 assertions**.
- Opt-in real MySQL suite: **3 passed, 0 failed, 31 assertions**. Two independent PHP processes
  reach a barrier, then invoke checkout against the same listing: one HTTP-equivalent 200, one 409,
  exactly one sale at the authoritative price. Other tests verify atomic sale/session SQL rollback and
  actual parallel HTTP kernels with database cache locks. This is not a sequential concurrency mock.
- Production Angular build, TypeScript noEmit and git diff --check: passed.
- Local live Chrome smoke: student creates listing, buyer filters Gallery, opens Details with loaded image,
  adds to cart, reloads cart, checks unique quantity, completes checkout, verifies sold exclusion and seller
  sales/earnings. Missing CSRF is rejected with 419; no uncaught browser exceptions.
- At 390px Gallery and Cart did not overflow horizontally; screenshots were captured at 390px and 1365px.
  This is Chrome emulation, not physical iPhone/Safari testing.

Tests added: API validation/price tampering, unique quantities, cart persistence, auth/own-artwork rejection,
atomic rollback, idempotency, sold/deleted items, commission/sales integration, actual concurrency;
frontend unavailable/retry/write failures, uncertain checkout retries, auth transitions, server UI feedback,
HTTP-LAN-compatible UUIDs and monitoring consent/privacy. Existing tests were not removed.

Run from root:

```powershell
npx ng build
npx ng test --watch=false --browsers=ChromeHeadless
npx tsc -p tsconfig.app.json --noEmit
git diff --check
cd backend
php artisan test
```

Concurrency is deliberately opt-in, excluded from the default in-memory suite. Supply a **separate**
MySQL database ending `_marketplace_test` and set ARTSPACE_CONCURRENCY_TEST=1, APP_ENV=testing,
DB_CONNECTION=mysql and DB_HOST/PORT/DATABASE/USERNAME/PASSWORD in the process environment. Run
`php vendor/phpunit/phpunit/phpunit tests/Integration/MarketplaceConcurrencyTest.php --colors=never`.
It runs migrate:fresh **only** after verifying the opted-in test connection/name; never point it at real data.
The generated local test database already exists; credentials must remain private environment variables.

The optional smoke command `node scripts/marketplace-smoke.mjs` requires running local servers and seeded
demo users. It creates one listing and one simulated sale per successful run in the local demo database.
It uses an isolated headless Chrome profile and does not change your normal browser session.
Screenshots/timings are ignored under `__screenshots__/marketplace`; they are not repository deliverables.

## Manual demo

1. If MySQL is stopped, start the installed `mysqld.exe` with the ignored local `my.ini` as its
   `--defaults-file` (LocalAppData/QueensArt and backend/storage/app/private/local-setup respectively).
   Do not initialize the data directory again. Laravel: `cd backend; php artisan serve --host=127.0.0.1 --port=8000`.
   Angular in another terminal: `npm start -- --host=127.0.0.1 --port=4200`.
2. Open `/login`; sign in as `portal-demo-one` with the private generated demoPassword.
3. Student Portal → Artwork listings: create a Painting/Print, upload an image or provide an image URL.
4. Confirm it appears on Home and Gallery. Exercise search, category, min/max prices and sorting together.
5. Sign out; sign in as `portal-demo-two`. Open artwork details and Add to Cart. Confirm feedback appears
   after saving; refresh Cart. The unique listing remains one item and total is in EGP.
6. Remove/re-add and confirm demo checkout. No payment is taken. Cart clears only on confirmed success.
7. Refresh Gallery: purchased artwork is absent. Sign in as the seller and inspect Student sales/earnings.
8. With two separate browser profiles, add the same unsold item to both carts and race checkout. One wins;
   the other sees a conflict and can remove the unavailable item. The automated MySQL test checks this too.
9. Stop Laravel or use browser offline mode: verify visible failure, no success animation/receipt, and retry.
10. Check an actual mobile Safari device and assistive technology before the presentation.

## LogRocket setup, privacy and report case study

SDK is pinned at logrocket 12.4.0, loaded dynamically **only** with a public project ID and accepted cookie
consent. Default ID is empty: no SDK download/telemetry occurs. No user identification call is made.
DOM, inputs, images, network data, console messages, automatic exception capture and IP capture are
disabled. URL sanitization removes private routes, IDs, query strings and fragments; only coarse Gallery/
Cart paths survive. Consent is rechecked before initialization and sending. This intentionally prioritizes
privacy over detailed session replay. Do not enable replay/body capture casually for auth/private pages.

Manual account access required:

1. In your own LogRocket account create/select the Queens Art project and copy its **public app ID**.
   Add `{provide: LOGROCKET_APP_ID, useValue: 'your-org/your-project'}` to app.config.ts providers,
   importing the token from core/services/marketplace-monitoring. Never use a personal API token.
2. Accept the cookie notice, then reload. A first-time consent choice takes effect for monitoring on reload.
3. Run the Gallery/Add/Checkout demo. Confirm the following custom events arrive and contain only
   `duration_ms` (number) and `success` (boolean):
   - `marketplace_catalogue_ms`: browser-observed catalogue request duration.
   - `marketplace_add_cart_ms`: add request through confirmed cart state update.
   - `marketplace_checkout_ms`: checkout request through confirmed receipt/error.
4. Create three custom-event metric charts, numeric duration_ms, p50/p95, split by success where available.
   Name dashboard “Queens Art Marketplace”. Exact dashboard capabilities depend on your account plan.
5. Compare normal network vs browser Slow 3G, at least 10 samples each. Save screenshots of distributions,
   failed-request outcomes and sanitized event payloads. Record browser/version, sample size and conditions.
6. Write the case study from those actual observations: bottleneck, measured change or proposed correction,
   before/after if a change was made, and limitations. Do not claim hosted dashboards or replay were verified
   until you have inspected your account. No real users, card numbers or passwords should be recorded.

Local smoke evidence (one run, localhost PHP development server, not a controlled benchmark): catalogue
520.3 ms, add 298.0 ms, checkout 1485.1 ms. These are Resource Timing measurements, **not** LogRocket
dashboard results. Repeat under controlled conditions before drawing performance conclusions.

Official references: [initialization](https://docs.logrocket.com/reference/init),
[DOM privacy](https://docs.logrocket.com/reference/dom),
[network privacy](https://docs.logrocket.com/reference/network),
[performance monitoring](https://docs.logrocket.com/docs/performance-monitoring).

Remaining: configure the real public app ID, inspect actual hosted telemetry, build account dashboards and
complete the measured case study. A physical Safari test remains manual. npm audit reports 16 moderate
advisory entries in the Angular CLI dev-tool chain (glob/minimatch); production-only audit reports zero.
The proposed npm fix upgrades CLI to 22.3.0, a major change; no dependency upgrades/overrides were applied.
LogRocket has no advisory in this audit. Its published SDK is CommonJS: Angular warns about optimization,
not correctness. The SDK remains a separate lazy chunk; the warning was not hidden with an allowlist.
Monitoring initialization does not block application bootstrap, and up to 30 coarse timing events are
buffered during lazy loading. No actual account dashboard/privacy upload has been verified.

## Commit and proposed PR description

Approved conventional commit message:

- `feat(marketplace): integrate Laravel catalogue, session cart and checkout`

Suggested PR title: “Connect Marketplace to Laravel session cart and safe simulated checkout”.

Description: Gallery and Details now use active backend listings; session-backed cart operations validate
unique artwork availability and database prices. Authenticated checkout records existing sale snapshots
atomically, prevents competing purchases and refreshes seller earnings with the existing 15% contract.
No shared schema changes. Includes error/retry UI, opt-in privacy-restricted monitoring, local fixtures,
API documentation and concurrency/live-browser regression coverage. Hosted monitoring account setup remains
manual. Validation: 254 Angular tests, 23 Laravel tests, three real MySQL tests, production build,
TypeScript and whitespace checks; local Chrome workflow/mobile screenshots.

For the Milestone 2 report/demo collect Gallery, Details, Cart and checkout screenshots; Student sales before/
after; the API flow above; one-sale concurrency evidence; storage design; and the actual LogRocket dashboard
screenshots after account setup. Existing ignored local screenshots are available for review.

## Files added or modified (27)

Backend:

- `backend/app/Http/Controllers/MarketplaceController.php` (new)
- `backend/database/seeders/MarketplaceDemoSeeder.php` (new)
- `backend/routes/web.php`
- `backend/config/session.php` (shared session locking required for cart/auth consistency)
- `backend/tests/Feature/MarketplaceTest.php` (new)
- `backend/tests/Integration/MarketplaceConcurrencyTest.php` (new)
- `backend/tests/Support/checkout-worker.php` (new)
- `backend/README.md`

Frontend:

- `src/app/app.config.ts`
- `src/app/core/services/marketplace-monitoring.ts` and `.spec.ts` (new)
- `src/app/features/marketplace/marketplace-api.service.ts` and `.spec.ts` (new)
- `src/app/features/marketplace/marketplace-server-ui.spec.ts` (new)
- `src/app/features/marketplace/cart.ts`
- `src/app/features/marketplace/cart/cart.ts` and `cart.html`
- `src/app/features/marketplace/shared/add-to-cart.ts`
- `src/app/features/marketplace/listings.service.ts`
- `src/app/features/marketplace/gallery/gallery.html`
- `src/app/features/marketplace/details/details.html`
- `src/app/features/student/student-api.service.ts` (catalogue timing instrumentation only)

Setup/documentation:

- `package.json` and `package-lock.json` (one pinned LogRocket dependency)
- `scripts/marketplace-smoke.mjs` (new)
- `docs/marketplace-milestone-2.md` (new)
- `README.md`

Generated local environment, credentials, tool installations, screenshots, profiles and logs are ignored
or outside Git. No credential values appear in the 27 review files. No Accounting, auth controller,
Home component/image, shared model, migration or existing test file was changed.

## Strict final review and Person 4 handoff

Confirmed corrections from the original 26-file review:

| Severity before correction | Finding | Correction |
| --- | --- | --- |
| HIGH | Sales committed before the receipt/cart session save | Database session save inside sale transaction; failures roll back and restore session state |
| HIGH | A receipt key could be replayed after switching buyer in the same session | Buyer-scoped receipt keys |
| HIGH | Non-cart session requests could save stale state concurrently | Shared web-session lock, tested with parallel real HTTP kernels |
| MEDIUM | Lost checkout response + reload could strand recovery; old receipt replay could hide a new cart | Explicit result-check control, retained attempt total/key, edits blocked, authoritative response cart |
| MEDIUM | Optional SDK loading could hold up application bootstrap | Non-blocking initialization and bounded coarse-event buffer |
| LOW | All-unavailable cart misleadingly said it was empty | Separate unavailable-only state |

The scope increased from 26 to 27 files only for backend/config/session.php; no shared financial schema changed.
All existing 232 baseline Angular tests remain; added tests exercise real failure/transition behavior.

Person 4 must reuse `artwork_sales`: user_id is the SELLER, artwork_id is unique/nullable, artwork_title and
price_minor are sale snapshots, sold_on is server-set, paid_on null means Pending. Never infer a payout from
checkout or create a second sale. Use the server's 15% contract in backend/config/artspace.php, commission
`intdiv(price_minor * 15 + 50, 100)` in piasters, earnings = price_minor - commission. Sum per-sale rounded
commissions for Gallery income; rounding monthly gross once can give a different result. Protect new
Accounting endpoints with server-side accountant/admin authorization and make payout updates idempotent.
Keep session/database/lock configuration compatible with the transaction above.

Current Accounting still reads SELLER_SALES mock data. Its round2(price * rate) can differ from integer
rounding (EGP 1.50 gives 0.22 in JS versus the correct 0.23 backend commission). This is a MEDIUM integration
risk for Person 4 when wiring real sales, not a newly introduced Marketplace bug. Use authoritative server
amounts rather than recalculating them with floating-point arithmetic. No Accounting source was changed.

Other limitations: the catalogue API supplies no likes/popularity data; student listings retain zero likes,
so popularity sorting ties fall back to title. No fabricated likes or browser mock fallback was added.
This needs an agreed backend popularity contract if meaningful popularity is required. Hosted LogRocket
evidence remains incomplete; external plan permissions, Safari and full Milestone 2 assignment-specific
compliance are unverified. This review covers the supplied Person 2 requirement list, not an unavailable
separate Milestone 2 PDF. No real payment processing or permanent buyer order history was required here.
