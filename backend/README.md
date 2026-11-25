# ArtSpace student API

This Laravel application provides the Person 3 API and the student portion of the shared artwork catalogue.

## Local setup

1. Run `composer install` in `backend` with PHP 8.4 and the PDO MySQL and SQLite extensions.
2. Copy `.env.example` to `.env`. Set the database connection to a new MySQL database and supply its credentials.
3. Run `php artisan key:generate`, `php artisan migrate`, and `php artisan serve`.
4. From the Angular project root, run `npm ci` and `npm start`. In deployment, serve Angular and forward `/api/*` to Laravel on the same origin.

## Shared sign-in

Use the normal ArtSpace login form with a Laravel account's username or email. Signup creates a student account. A developer or deployment operator with server access can provision accountant and admin accounts with a role assigned on the server:

```bash
php artisan artspace:create-user alice_accounting alice@example.test accountant
php artisan artspace:create-user artspace_admin admin@example.test admin
```

The command prompts for a password. Each teammate can choose a separate password in their local environment. Existing browser-only accounts and records are not imported into Laravel.

- `GET /api/auth/session` returns `{ user: null }` for a guest or `{ user: { id, username, name, email, role, picture, cardLast4, preferences } }`.
- `POST /api/auth/session` accepts `identifier` and `password`, creates the Laravel session, and returns the same user envelope.
- `DELETE /api/auth/session` invalidates the session and returns 204.
- `POST /api/auth/register` creates a student from `username`, `name`, `email`, `password`, optional `picture` and `cardLast4`, and `preferences` containing `theme` and `newsletter`.
- Authenticated `PATCH /api/auth/profile` accepts `name`, `email`, optional `picture`, and `preferences`. It returns the updated user envelope.

Angular uses relative URLs, the Laravel session cookie, and the standard `XSRF-TOKEN` cookie and `X-XSRF-TOKEN` header. Fetch the session before issuing writes to initialize the CSRF cookie. Protect each feature's private Laravel routes with session authentication and its server-side role check.

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

Laravel uses an HttpOnly session cookie and a separate readable CSRF cookie. Use HTTPS with secure session cookies in production. API-backed student records stay in Angular memory and private views clear when the signed-in student changes. The cart and Accounting demo data still use browser storage.

## Tests

After generating the local application key, run `php artisan test` from this directory. The default suite creates its own in-memory SQLite database. Run Angular tests and the production build with `npm test -- --watch=false --browsers=ChromeHeadless` and `npm run build` from the project root.

## Local demo records

Set `ARTSPACE_DEMO_PASSWORD` in your terminal to a local-only password of at least 12 bytes before running `php artisan db:seed --class=StudentDemoSeeder` from `backend`. This adds student users `portal-demo-one@example.test` and `portal-demo-two@example.test`, course and studio fees, and sale records with paid and pending payouts. Rerunning the seeder preserves existing passwords, invoices, and payments. With Laravel running in its local environment and Angular running through the development proxy, sign in through the normal ArtSpace login form with either seeded demo email or username. The local sign-in creates a Laravel session, restores it on refresh, and enables API-backed Student Portal screens for that session. Use the generated password for those accounts. Sign out from the navbar before switching students. The same shared session endpoints serve these seeded accounts and regular ArtSpace accounts.
