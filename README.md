# Turnit Phase 1

Assignment report-checking web application for the Phase 1 workflow:

- Customers register, log in, upload assignment files, create paid test orders, and download final reports.
- Staff log in, accept available orders first-come-first-served, download accepted files, upload reports, complete orders, and track earnings.
- Admins log in, view all operational data, manage staff, review revenue, staff earnings, and activity logs.

Payment gateway, email, and WhatsApp integrations are intentionally not included in Phase 1. New orders are automatically created with `payment_status = paid` and `order_status = available`.

## Tech Stack

- Backend: Node.js, Express
- Frontend: React, Vite
- Database: MySQL/MariaDB
- Auth: JWT with bcrypt password hashing
- Uploads: Multer with protected download routes

## Setup

1. Install dependencies:

```bash
npm run install:all
```

2. Create a MySQL/MariaDB database:

```sql
CREATE DATABASE turnit_phase1;
```

3. Copy the example environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

4. Update `.env` if your MySQL username, password, host, or port differs:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=turnit_phase1
DB_USER=root
DB_PASSWORD=
JWT_SECRET=replace_this_with_a_long_random_secret
```

On Hostinger, create a separate MySQL database for this app in hPanel/phpMyAdmin and copy
the hPanel database host, name, username, and password into these values.

5. Create tables and seed demo users:

```bash
npm run db:seed --prefix backend
```

Seed logins:

- Admin: `admin@turnit.local` / `Password123!`
- Staff: `staff@turnit.local` / `Password123!`
- Customer: `customer@turnit.local` / `Password123!`

6. Start the backend:

```bash
npm run dev --prefix backend
```

Backend URL: `http://localhost:5000`

7. Start the frontend in another terminal:

```bash
npm run dev --prefix frontend
```

Frontend URL: `http://localhost:5173`

## Hostinger Git Deployment

Recommended flow:

1. Push this project to a GitHub repository.
2. In Hostinger hPanel, create a Node.js Web App and choose Import Git Repository.
3. Select this repository and the `main` branch.
4. Use these build settings:

```text
Build command: npm run build
Start command: npm start
Entry file: backend/src/server.js
```

The build command installs backend and frontend dependencies, then builds the React app into
`frontend/dist`. In production, Express serves that built frontend and the `/api/*` routes from
the same Node.js app.

Add these environment variables in Hostinger:

```env
NODE_ENV=production
PORT=3000
DB_HOST=your_hostinger_mysql_host
DB_PORT=3306
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
JWT_SECRET=replace_this_with_a_long_random_secret
JWT_EXPIRES_IN=7d
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=20
MAX_FILES_PER_ORDER=20
STAFF_MAX_ACTIVE_ORDERS=3
```

After the first deployment, run the database seed once from Hostinger's terminal/SSH or your local
machine with the production database credentials:

```bash
npm run db:seed --prefix backend
```

After Hostinger is connected to GitHub, updates merged or pushed to the deployment branch can trigger
automatic redeployments from hPanel.

## Main Pages

Customer:

- `/login`
- `/register`
- `/customer/dashboard`
- `/customer/new-order`
- `/customer/orders`

Staff:

- `/staff/login`
- `/staff/dashboard`
- `/staff/available-orders`
- `/staff/orders`
- `/staff/earnings`

Admin:

- `/admin/login`
- `/admin/dashboard`
- `/admin/orders`
- `/admin/customers`
- `/admin/staff`
- `/admin/staff-earnings`
- `/admin/revenue`
- `/admin/activity-logs`

## File Rules

Allowed upload types:

- `pdf`
- `doc`
- `docx`
- `txt`
- `zip`

Upload limits are controlled by:

```env
MAX_FILE_SIZE_MB=20
MAX_FILES_PER_ORDER=20
```

Files are stored under `backend/uploads` with unique names containing the order number. Downloads go through protected API routes, not direct static file serving.

## Staff Acceptance Logic

The staff accept endpoint uses a MySQL named lock plus an atomic database update:

```sql
UPDATE orders
SET accepted_by_staff_id = $1,
    accepted_at = CURRENT_TIMESTAMP,
    order_status = 'accepted'
WHERE id = $2
  AND order_status = 'available'
  AND accepted_by_staff_id IS NULL;
```

If no row is updated, the API returns:

```text
This order was already accepted by another staff member.
```

## Phase 2 Notes

Later, replace the Phase 1 testing shortcut with real PayHere payment handling:

- Create orders as `payment_status = pending` and `order_status = pending_payment`.
- Redirect customer to PayHere.
- Verify PayHere notify/signature callbacks.
- Mark orders `paid` and `available` only after verified payment.
