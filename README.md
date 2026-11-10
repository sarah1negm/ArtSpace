# ArtSpace (ICS 511, Milestone 1)

Angular frontend, mock data only.

## Run
npm install
ng serve        # http://localhost:4200
ng test --watch=false --browsers=ChromeHeadless

## Test accounts (password: Pass1234)
student1 · accountant1 · admin1

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