# Kavach — Campus Safety, Emergency Response & Student Wellbeing (BIT Sindri)

Kavach is a full-stack system for BIT Sindri students and the campus admin:

- **One-tap SOS.** The student's live location goes by SMS (Google Maps link) to their emergency contacts and the campus admin. There is a 10-second cancel window, a voice trigger ("help"), a limit of 10 alerts per hour, and an offline fallback.
- **Verified sign-up.** Students register only with a phone or email from the college roster, or an `@bitsindri.ac.in` email. Every sign-in is confirmed with an OTP on the channel the student picks.
- **Community problems.** Students post problems with photos, reactions and discussion. The admin tracks each one through *marked for solving → in progress → under review → solved*. Students and the admin both confirm before a problem closes, and the student who raised it can close it at any time.
- **Moderation.** Students can report malicious posts. The admin can hide posts and suspend or ban accounts.
- **Fundraisers.** Students can upload multiple payment QR codes plus private proof documents. A fundraiser goes live only after the admin approves it.
- **Campus chatbot.** It answers from a knowledge base the admin edits, and can optionally use AI.
- **Installable PWA** that works offline, with **light and dark mode** in both apps.

```
kavach/
├── backend/   Node.js + Express REST API, PostgreSQL, SMTP email, Twilio SMS
├── student/   React + Tailwind student app (PWA)            → http://localhost:5173
├── admin/     React + Tailwind admin panel (separate app)    → http://localhost:5174
├── samples/   Example roster CSV for the admin import
├── scripts/   setup-env.js (creates backend/.env with strong secrets)
└── docker-compose.yml   PostgreSQL (and optionally the full stack)
```

---

## 1. Quick start (about 5 minutes)

### Prerequisites

| Tool | Version | Why |
|---|---|---|
| [Node.js](https://nodejs.org) | **18.18 or newer** (20 LTS recommended) | Runs the API and builds the apps |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Any recent version | Runs PostgreSQL |

Check the versions with `node -v` and `docker -v`.

### Steps

Run these from the project root, the folder that contains this README.

```bash
# 1. Install everything and create backend/.env with generated secrets
npm run setup

# 2. Start PostgreSQL in Docker (make sure Docker Desktop is running first)
npm run db:up

# 3. Start the API, student app and admin panel together
npm run dev
```

Open:

| App | URL |
|---|---|
| Student app | http://localhost:5173 |
| Admin panel (separate app, opens straight to OTP login) | http://localhost:5174 |
| API health check | http://localhost:5000/api/health |

On first start the API creates all database tables and seeds:
- the admin account `rockingav9876@gmail.com` (phone `7479676602`),
- the campus emergency number `7479676602`, which every student gets automatically,
- starter chatbot answers,
- a few **demo roster students** for testing. These are seeded in development only, never in production.

### Running each folder by hand (optional)

```bash
docker compose up -d db                       # database
cd backend && npm install && cp .env.example .env && npm run dev
cd student && npm install && npm run dev      # new terminal
cd admin   && npm install && npm run dev      # new terminal
```

> On Windows PowerShell use `copy .env.example .env` instead of `cp`.

---

## 2. Try it out

### Where the OTPs appear

Until you add SMTP and Twilio credentials, **every OTP, email and SMS is printed in the terminal running the backend** inside a highlighted box:

```
📱 OTP SMS (register) (Twilio not configured — shown here instead)
   To: +919000000001
   OTP CODE: 641071
```

### Register a student

Use one of the demo roster students, any new `@bitsindri.ac.in` email, or a student you add yourself in the admin panel:

| Name | Email | Phone |
|---|---|---|
| Aarav Kumar | aarav.22cse001@bitsindri.ac.in | 9000000001 |
| Priya Singh | priya.23ece014@bitsindri.ac.in | 9000000002 |
| Rohit Mahato | rohit.21me042@bitsindri.ac.in | 9000000003 |
| Sneha Oraon | — | 9000000004 |

1. Open http://localhost:5173 and choose **Register**.
2. Enter your name, then email, phone or both, then a password. If you give both, you choose where the OTP goes.
3. Copy the 6-digit OTP from the backend terminal.
4. After registering, branch, batch, registration number and name are **already filled** from the roster. Email and phone are locked.

Sign in later with your **name, email or phone** plus your password, then choose where to get the OTP.

### Sign in as admin

Open http://localhost:5174, enter `rockingav9876@gmail.com`, and copy the OTP from the backend terminal. Once SMTP is configured, the OTP arrives in that Gmail inbox instead.

### Import the student roster

In **Admin → Student roster → Import CSV or Excel**, upload `samples/student-roster-sample.csv` or your own `.csv`/`.xlsx` file. The file is scanned and shown as a preview, with new, updated and problem rows marked, before anything is saved.

Recognised headers, matched in any letter case:

| Field | Accepted header names |
|---|---|
| name (required) | name, student name, full name |
| regd_no (required) | regd no, reg no, registration no, roll no, enrollment no |
| branch | branch, department, dept, stream, course |
| batch | batch, year, session, admission year |
| email | email, email id, mail, college email |
| phone | phone, mobile, mobile no, contact no, whatsapp |

---

## 3. Turning on real email and SMS (no code changes)

Open `backend/.env` and fill in the values. In development, **nodemon restarts the API automatically when `.env` is saved**. From that moment OTPs and SOS alerts are delivered for real instead of being printed. In production, restart the server or container after editing.

### Email (SMTP), for example Gmail

1. Turn on 2-Step Verification for the Gmail account.
2. Create an **App password** at https://myaccount.google.com/apppasswords.
3. Set:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=rockingav9876@gmail.com
SMTP_PASS=your16charapppassword
MAIL_FROM="Kavach BIT Sindri <rockingav9876@gmail.com>"
```

Any SMTP provider works, including SendGrid, Brevo, Amazon SES, Mailgun and the college mail server.

### SMS (Twilio)

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+1XXXXXXXXXX
```

- Indian 10-digit numbers are converted to `+91…` automatically. Change `DEFAULT_COUNTRY_CODE` if needed.
- **Twilio trial accounts can only send to verified numbers.** Verify your own number in the Twilio console while testing.
- Sending SMS to Indian numbers at scale is subject to TRAI DLT registration rules. Check Twilio's India guidelines before going live.

The admin **Settings** page and the backend start-up banner both show which delivery mode is active.

### Optional: AI answers in the chatbot

```env
ANTHROPIC_API_KEY=sk-ant-...
CHATBOT_MODEL=claude-haiku-5-5
```

Without a key the chatbot answers from the knowledge base using PostgreSQL full-text search. With a key it uses the same knowledge base as context and does not invent facts. If the AI call fails, it falls back to the knowledge base. Messages about self-harm always get crisis resources first (Tele-MANAS 14416, 112, SOS).

---

## 4. The PWA (installable, works offline)

The student app is a Progressive Web App built with `vite-plugin-pwa` and Workbox.

**What works offline:**
- The app shell opens.
- Your profile, emergency contacts, recently viewed community posts, fundraisers and map tiles come from the cache.
- **SOS** opens your phone's SMS app with your location and contacts pre-filled. It also queues the alert and sends it automatically when you reconnect.

The service worker is generated only in production builds. To test the PWA locally:

```bash
npm run build      # builds student + admin
npm run preview    # API + student on http://localhost:4173 + admin on http://localhost:4174
```

1. Open http://localhost:4173 in Chrome or Edge.
2. Install it from the install icon in the address bar, or with **Install app** on the landing page or in Profile.
3. Test offline mode in DevTools under **Application → Service Workers → Offline**, or **Network → Offline**, then reload.

**On a phone:** service workers, geolocation and the microphone all require **HTTPS**, except on `localhost`. To test on a phone, either deploy behind HTTPS (see section 7) or expose the preview through an HTTPS tunnel such as `cloudflared tunnel --url http://localhost:4173` or `ngrok http 4173`. Then open the HTTPS link on the phone and choose **Add to Home screen**.

### Voice trigger

- Uses the Web Speech API: Chrome, Edge, Chrome on Android, and Safari 14.5+.
- Saying **"help"** (also "bachao" or "madad") starts the same 10-second countdown as the button.
- It works **while the app is open in the foreground**. Browsers do not allow web apps to listen in the background.
- Chrome's speech recognition needs an internet connection.

---

## 5. Feature notes

| Requirement | Implementation |
|---|---|
| Register with roster phone/email or `@bitsindri.ac.in` email, then OTP | `POST /api/auth/register/start` validates each identifier against `college_records` or the domain. With both, the student picks the OTP channel. |
| Sign in with name, phone or email plus password, OTP on a channel of choice | `POST /api/auth/login/start` → `/auth/otp/send` → `/auth/login/verify` |
| Forgot password | OTP to the account's email or phone, then a new password |
| Profile prefilled from roster; email and phone locked | `GET/PATCH /api/me`. The PATCH schema rejects email and phone. |
| Admin number saved for everyone | `settings.admin_emergency_phone`, editable in Admin → Settings, always included and cannot be removed |
| One-tap SOS with map, contacts, SMS with a Google Maps link | Student SOS tab (Leaflet + OpenStreetMap), `POST /api/sos` via Twilio |
| 10 SOS per hour, 10-second cancel timer, voice "HELP" | Enforced in the database with a per-user advisory lock. Countdown and voice run in `SosContext`. |
| Community: post, images, reactions, discussion | `/api/posts` with 6 reaction types and comments |
| Admin status updates, mutual close, owner can always close | `PATCH /api/admin/posts/:id/status`, `/posts/:id/confirm-resolved`, `/posts/:id/close`, `/posts/:id/reopen` |
| Report, ban, suspend | `/posts/:id/report` (auto-hide after 5 reports), Admin → Reports and Accounts |
| Sort problems by time or severity | Admin → Problems: newest, oldest, severity, most reported |
| Fundraisers with multiple QR codes and proof, admin approval | `/api/fundraisers`. Proof files are private and served only to the organiser and the admin. |
| Chatbot about the college | `/api/chat`, with the knowledge base managed in Admin → Chatbot answers |
| Admin on a separate localhost, OTP login | `admin/` on port 5174, `/api/admin/auth/*` |

**Wellbeing extras:** a private daily mood check-in stored only on the device, with a gentle Tele-MANAS (14416) prompt on hard days, plus helpline numbers on the landing page.

---

## 6. Security and scalability

- **Rate limiting, for the same IP and across different IPs.** Counters live in PostgreSQL, so limits hold across any number of API instances.

  | Limit | Scope |
  |---|---|
  | 600 requests / 15 min | per IP, all endpoints |
  | 30 sign-in attempts / 15 min | per IP |
  | 10 attempts / 15 min | **per account identifier, regardless of IP** (stops distributed brute force) |
  | 5 OTP codes / 15 min | per email or phone, plus a 30-second resend cooldown and 5 sends per session |
  | 1000 OTP codes / hour | globally (guards against SMS-pumping fraud), set with `OTP_GLOBAL_HOURLY_LIMIT` |
  | 10 SOS / hour | per student, exact count in the database, plus an IP ceiling |
  | Posts, fundraisers, comments, chat, admin actions | per account |

- **OTP handling:** 6-digit codes from `crypto.randomInt`, stored only as HMAC-SHA256 hashes, compared in constant time. Codes expire after 5 minutes and lock after 5 wrong tries.
- **Passwords:** bcrypt with 12 rounds. A dummy hash comparison runs when an account doesn't exist, so response timing doesn't reveal which accounts exist.
- **No account discovery:** admin login and forgot-password return identical responses whether or not the account exists.
- **Sessions:** separate JWT secrets and audiences for students and admins. Tokens are revoked instantly on ban, suspension or password change (`token_version`).
- **Input validation:** every request body is validated with Zod, and SQL is fully parameterised.
- **Uploads:** each file type is verified from its **actual bytes**, never the client's claimed type. Files get random names and size limits. Proof documents never touch the public folder.
- **Privacy:** students never see each other's phone numbers or emails.
- **HTTP hardening:** Helmet security headers, a CORS allow-list, HPP protection, and JSON body limits.
- **Audit log:** every admin action and sign-in is recorded and visible in Admin → Settings.
- **Production safety:** the server refuses to start in production with missing or default secrets.
- **Statelessness:** the API is stateless, so you can run several instances behind a load balancer. Share `backend/uploads` through a common volume, or move uploads to object storage.

---

## 7. Production deployment

### Option A: everything in Docker

```bash
npm run setup                     # creates backend/.env with strong secrets (if not done)
# edit backend/.env: SMTP_*, TWILIO_*, and set a strong POSTGRES_PASSWORD in your shell
docker compose --profile full up -d --build
```

| Service | URL |
|---|---|
| Student app | http://localhost:8080 |
| Admin panel | http://localhost:8081 |
| API | http://localhost:5000 |

Both frontends are served by nginx, which proxies `/api` and `/uploads` to the backend container.

Put an HTTPS reverse proxy (Caddy, Nginx, Traefik, or a cloud load balancer) in front of ports 8080 and 8081 with real domains, for example `kavach.yourcollege.in` and `admin.kavach.yourcollege.in`. Then add those origins to `CLIENT_ORIGINS`.

> In production (`NODE_ENV=production`) demo roster students are **not** seeded. Import the real roster from the admin panel.

### Option B: your own servers

```bash
cd backend && npm ci --omit=dev && NODE_ENV=production node src/server.js   # e.g. under pm2 or systemd
cd student && npm ci && npm run build      # serve student/dist as a static site
cd admin   && npm ci && npm run build      # serve admin/dist as a static site
```

Serve both `dist` folders from any static host, and route `/api` and `/uploads` on the same domain to the API (see `student/nginx.conf`). Set `TRUST_PROXY=1` when the API sits behind a proxy, so rate limits see the real client IP. If the frontends are on a different domain from the API, build them with `VITE_API_URL=https://api.example.com`.

**Checklist:** HTTPS everywhere · strong `POSTGRES_PASSWORD` · regular `pg_dump` backups · back up the `uploads` volume · real SMTP and Twilio credentials · review the seeded chatbot answers · set `CLIENT_ORIGINS`.

---

## 8. Scripts

Root (`kavach/`):

| Command | What it does |
|---|---|
| `npm run setup` | Installs dependencies in all folders and creates `backend/.env` with generated secrets |
| `npm run db:up` / `db:down` | Starts or stops PostgreSQL in Docker |
| `npm run db:reset` | **Deletes all data** and starts a fresh database |
| `npm run dev` | API + student + admin with hot reload |
| `npm run build` | Production builds of student and admin |
| `npm run preview` | Serves the production builds (for testing the PWA) with the API |
| `npm run docker:full` | Builds and runs the whole stack in containers |

Backend (`backend/`): `npm run dev` (nodemon) · `npm start` · `npm run migrate` · `npm run seed`. Migrations and the idempotent seed also run automatically at start-up.

---

## 9. API overview

All routes are prefixed with `/api`. Student routes need `Authorization: Bearer <token>` (except `auth/*`). Admin routes need an admin token (except `admin/auth/*`). Errors always look like `{ "error": { "code", "message", "details?" } }`.

```
GET    /health
POST   /auth/register/start | /auth/register/verify | /auth/otp/send | /auth/check-eligibility
POST   /auth/login/start | /auth/login/verify
POST   /auth/password/forgot | /auth/password/resend | /auth/password/reset
GET    /me                PATCH /me            POST /me/password
GET    /me/contacts       POST /me/contacts    PATCH|DELETE /me/contacts/:id
GET    /me/notifications  POST /me/notifications/read-all | /me/notifications/:id/read
GET    /sos/status        POST /sos
GET    /posts             POST /posts          GET|DELETE /posts/:id
POST   /posts/:id/react | /comments | /report | /close | /confirm-resolved | /reopen
GET    /posts/:id/comments                      DELETE /posts/:id/comments/:commentId
GET    /fundraisers       POST /fundraisers    GET /fundraisers/:id
PATCH  /fundraisers/:id/raised   POST /fundraisers/:id/close   GET /fundraisers/:id/proofs/:index
GET    /chat/suggestions  POST /chat

POST   /admin/auth/start | /admin/auth/verify | /admin/auth/resend     GET /admin/auth/me
GET    /admin/dashboard
GET    /admin/students    POST /admin/students  PATCH|DELETE /admin/students/:id
POST   /admin/students/import/preview | /admin/students/import/commit
GET    /admin/users       POST /admin/users/:id/suspend | /ban | /reinstate
GET    /admin/posts       GET /admin/posts/:id  PATCH /admin/posts/:id/status
POST   /admin/posts/:id/hide | /unhide          DELETE /admin/posts/:id/comments/:commentId
GET    /admin/reports     POST /admin/reports/posts/:id/resolve
GET    /admin/fundraisers GET /admin/fundraisers/:id   GET /admin/fundraisers/:id/proofs/:index
POST   /admin/fundraisers/:id/review | /close
GET    /admin/sos         POST /admin/sos/:id/acknowledge
GET    /admin/faqs        POST /admin/faqs      PATCH|DELETE /admin/faqs/:id   POST /admin/faqs/test
GET    /admin/settings    PUT /admin/settings   GET /admin/audit
```

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| `Failed to start … ECONNREFUSED` | PostgreSQL isn't running. Start Docker Desktop, then run `npm run db:up`. |
| Port 5432 already in use (local PostgreSQL) | Run `DB_PORT=5433 docker compose up -d db` and change `DATABASE_URL` in `backend/.env` to port 5433. |
| `Port 5000 is already in use` | Stop the other process, or set `PORT` in `backend/.env` and `VITE_API_PROXY` for the frontends. |
| No OTP arrives | Without credentials, OTPs are printed in the **backend terminal**. With Gmail, use an App password, not your normal password. |
| "Too many attempts" | The rate limiter is working. Wait for the window to pass, or in development run `npm run db:reset`. |
| Map is blank | The map needs internet for OpenStreetMap tiles. Tiles you've already viewed are cached for offline use. |
| Location blocked | Allow location for the site in browser settings. SOS still sends, but without a map link. |
| Install button or voice SOS missing on a phone | They need HTTPS (see section 4) and Chrome or Edge. |

---

## 11. Open-source software used

Thank you to the maintainers of these projects. Versions are the ones installed when this release was built (see each folder's `package-lock.json`).

### Backend (`backend/`)

| Package | Version | License | Used for |
|---|---|---|---|
| [express](https://expressjs.com) | 4.22 | MIT | HTTP server and routing |
| [pg](https://node-postgres.com) | 8.23 | MIT | PostgreSQL client and connection pool |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | 2.4 | MIT | Password hashing |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | 9.0 | MIT | Session tokens (JWT) |
| [zod](https://zod.dev) | 3.25 | MIT | Request validation |
| [helmet](https://helmetjs.github.io) | 8.3 | MIT | Security headers |
| [cors](https://github.com/expressjs/cors) | 2.8 | MIT | Cross-origin allow-list |
| [hpp](https://github.com/analog-nico/hpp) | 0.2 | ISC | HTTP parameter pollution protection |
| [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | 7.4 | MIT | Rate limiting (with a custom PostgreSQL store) |
| [compression](https://github.com/expressjs/compression) | 1.8 | MIT | Gzip responses |
| [morgan](https://github.com/expressjs/morgan) | 1.12 | MIT | Request logging |
| [multer](https://github.com/expressjs/multer) | 1.4.5-lts | MIT | File uploads |
| [nodemailer](https://nodemailer.com) | 6.10 | MIT-0 | SMTP email |
| [twilio](https://github.com/twilio/twilio-node) | 5.13 | MIT | SMS |
| [csv-parse](https://csv.js.org/parse/) | 5.6 | MIT | Roster CSV import |
| [exceljs](https://github.com/exceljs/exceljs) | 4.4 | MIT | Roster XLSX import |
| [dotenv](https://github.com/motdotla/dotenv) | 16.6 | BSD-2-Clause | Loading `.env` |
| [nodemon](https://nodemon.io) *(dev)* | 3.1 | MIT | Auto-restart on code and `.env` changes |

### Student app (`student/`) and admin panel (`admin/`)

| Package | Version | License | Used for |
|---|---|---|---|
| [react](https://react.dev), react-dom | 18.3 | MIT | UI |
| [react-router-dom](https://reactrouter.com) | 6.30 | MIT | Routing |
| [leaflet](https://leafletjs.com) | 1.9 | BSD-2-Clause | Interactive maps |
| [react-leaflet](https://react-leaflet.js.org) | 4.2 | Hippocratic-2.1 | React bindings for Leaflet ¹ |
| [lucide-react](https://lucide.dev) | 0.460 | ISC | Icons |
| [@fontsource-variable/bricolage-grotesque](https://fontsource.org/fonts/bricolage-grotesque) | 5.3 | OFL-1.1 | Display typeface (self-hosted, works offline) |
| [@fontsource/atkinson-hyperlegible](https://fontsource.org/fonts/atkinson-hyperlegible) | 5.3 | OFL-1.1 | Body typeface, designed for legibility by the Braille Institute |
| [tailwindcss](https://tailwindcss.com) *(dev)* | 3.4 | MIT | Styling |
| [vite](https://vitejs.dev) *(dev)* | 6.4 | MIT | Dev server and bundler |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) *(dev)* | 4.7 | MIT | React support for Vite |
| [postcss](https://postcss.org), [autoprefixer](https://github.com/postcss/autoprefixer) *(dev)* | 8.5 / 10.6 | MIT | CSS processing |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app) *(dev, student only)* | 1.3 | MIT | Manifest and service worker generation |
| [workbox-window](https://developer.chrome.com/docs/workbox) *(student only)* | 7.4 | MIT | Service worker registration and offline caching |

¹ `react-leaflet` is published under the **Hippocratic License 2.1**, an ethical-source license that is not OSI-approved. If your institution requires OSI-approved licenses only, the map components (`student/src/components/MapView.jsx`, `admin/src/pages/SosAlerts.jsx`) can be rewritten against plain Leaflet (BSD-2-Clause) in roughly 50 lines.

### Root, infrastructure and data

| Project | License | Used for |
|---|---|---|
| [concurrently](https://github.com/open-cli-tools/concurrently) *(dev)* | MIT | Running all three apps with one command |
| [PostgreSQL 16](https://www.postgresql.org) (`postgres:16-alpine` image) | PostgreSQL License | Database |
| [Node.js](https://nodejs.org) (`node:20-alpine` image) | MIT | Runtime |
| [nginx](https://nginx.org) (`nginx:1.27-alpine` image) | BSD-2-Clause | Serving built frontends and proxying the API |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) tiles | Data © OpenStreetMap contributors, ODbL | Map background. Follow the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/), and use a commercial tile provider for heavy traffic. |
| [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) | Free, no API key | Location links in SOS messages |
| Web Speech, Geolocation, Web Audio and Vibration APIs | Browser standards | Voice trigger, live location, alarm siren, haptics |

---

## 12. Notes and known limitations

- **Seeded chatbot answers** about BIT Sindri are general starter content. Review and edit them in Admin → Chatbot answers before launch.
- The **default map centre** before a GPS fix arrives is an approximate BIT Sindri location. Change `CAMPUS` in `student/src/components/MapView.jsx` if needed.
- **SMS delivery** depends on Twilio and on the carrier. Kavach records the delivery status of every SOS recipient, visible to the student and in Admin → SOS alerts.
- **Fundraisers** never handle money. Payments go straight to the QR codes and UPI ID, and the "raised" amount is reported by the organiser.
- **Voice SOS** only listens while the app is open, because browsers don't allow background listening.

In immediate danger, always call **112**.
#   K A V A C H  
 