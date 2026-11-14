# ArtSpace (ICS 511, Milestone 1)

Angular frontend, mock data only.

## Run
npm install
ng serve        # http://localhost:4200
ng test --watch=false --browsers=ChromeHeadless

## Test accounts (password: Pass1234)
student1 Â· accountant1 Â· admin1

## Rules
- Work only in your folder: features/marketplace | student | accounting
- Register pages in your own *.routes.ts (lazy-loaded, already wired in app.routes.ts)
- Logged-in user: inject(AuthService).currentUser()
- Storage: use StorageService
  - localStorage  = data that must persist (cart, listings, invoices, payroll)
  - sessionStorage = temporary, per-tab data (checkout in progress, filters)
  - cookies        = tiny preferences only
- Hide UI by role with auth.role(); the route guards already block the pages
- Write unit tests for your own components and services
- One branch per person, pull request to master
## Student listings and Marketplace

Student-created listings share the reactive `ArtworkCatalog` used by Gallery,
Details and Cart. Student IDs are UUID strings; the three mock artwork IDs remain
numbers. New listings start with zero popularity. Editing a listing updates its
Marketplace information and cart price; deleting it removes it from Gallery,
Details and the active cart, so it cannot be checked out. Restored carts resolve
saved IDs against current listings rather than trusting saved prices.

All data is browser-local. Listings are visible to other accounts using the same
browser profile and site origin, including after logout. They are not shared across
devices, browsers, or browser profiles. Concurrent tabs do not receive live updates;
reload to read changes saved in another tab. Image uploads accept JPEG, PNG, WebP
or GIF files up to 500 KB, subject to the browser's localStorage quota. Checkout is
simulated and does not create Accounting transactions.

Verification on Windows (if Chrome is unavailable, use installed Edge):

```powershell
npm.cmd ci
$env:NG_CLI_ANALYTICS = 'false'
npx.cmd ng build
$env:CHROME_BIN = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npx.cmd ng test --watch=false --browsers=ChromeHeadless
```

The test suite includes a browser-rendered router workflow from authenticated
student creation to public search, details, quantity changes and checkout, plus
edit/delete propagation, persisted carts, Home/Profile links and upload validation.
A separate interactive browser walkthrough remains a useful review check.
