# ArtSpace student API

This Laravel application provides the Person 3 API and the student portion of the shared artwork catalogue.

## Local setup

1. Run `composer install` in `backend` with PHP 8.4 and the PDO MySQL and SQLite extensions.
2. Copy `.env.example` to `.env`. Set the database connection to a new MySQL database and supply its credentials.
3. Run `php artisan key:generate`, `php artisan migrate`, and `php artisan serve`.
4. From the Angular project root, run `npm ci` and `npm start -- --proxy-config proxy.conf.json`. In deployment, serve Angular and forward `/api/*` to Laravel on the same origin.

The Angular API mode needs the team's shared server-backed login. Once that login sets the Laravel `web` session, returns the authenticated identity to Angular's `AuthService`, and clears both sessions on logout, provide `{ provide: USE_STUDENT_API, useValue: true }` in `src/app/app.config.ts`. The Angular client uses relative URLs and Angular's standard `XSRF-TOKEN` cookie and `X-XSRF-TOKEN` header. The existing browser-only demo login does not issue a Laravel session.

## Endpoints

Public routes include `GET /api/artworks` for active unsold student listings and `GET /api/artwork-images/{filename}` for validated uploaded images attached to active artwork records.

Student routes require an authenticated Laravel session and a student role. Record lookups are scoped to the current user.

- `GET /api/student/dashboard` returns profile, course names, current or most recent studio membership, outstanding balance, paid fees, and earnings.
- `GET /api/student/fees` returns course and studio fees, balances, statuses, and payment history.
- `GET /api/student/invoices` lists invoices. `GET /api/student/invoices/{id}` returns one invoice.
- `POST /api/student/invoices` accepts `feeId` and returns the invoice. Each student fee can be invoiced once.
- `POST /api/student/invoices/{id}/payments` simulates full payment. The server sets the date and amount, and a retry returns the recorded payment.
- `GET /api/student/artworks` lists owned artwork. `POST /api/student/artworks` creates a listing. `PATCH /api/student/artworks/{id}` updates it, and `DELETE` at the same path removes it from active listings. Multipart edits send `POST` with `_method=PATCH`. Artwork fields are `title`, `description`, `category`, `price`, and either `imageUrl` or multipart `image`. An edit can retain the existing image.
- `GET /api/student/sales` returns recorded sales, payout status, 15% commission, and earnings. It reads sale snapshots from `artwork_sales`. Connect the Accounting or order workflow to these records once the team agrees on the shared sales schema.

## Storage

MySQL is the source of truth for users, server sessions, enrollment, membership, fees, invoices, invoice payments, artworks, and sales. Money is stored as integer piasters and returned in EGP. Uploaded files are stored on Laravel's local disk with generated names. The database stores their paths. Soft-deleted artwork stays available to financial references. Replaced and removed files remain on disk for potential cleanup and are unavailable at their former image URLs.

Laravel uses an HttpOnly session cookie to identify the server session and a separate readable CSRF cookie so Angular can send the CSRF header. Use HTTPS with secure session cookies in production. API-backed student records stay in Angular memory and private views clear when its signed-in student changes. The browser session, optional username and consent cookies, and localStorage data used by the Milestone 1 demo remain in its existing flows. LocalStorage also retains the existing cart and Accounting demo data. A production cutover needs the authentication migration and an explicit decision about importing browser-side demo records.

## Tests

After generating the local application key, run `php artisan test` from this directory. The default suite creates its own in-memory SQLite database. Run Angular tests and the production build with `npm test -- --watch=false --browsers=ChromeHeadless` and `npm run build` from the project root.
