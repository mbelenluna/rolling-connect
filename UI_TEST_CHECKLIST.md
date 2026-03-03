# Rolling Connect — UI Test Checklist

Use this checklist for a full platform test. For each item, mark **Pass** or **Fail** and add comments if needed.

---

## 1. Public / Landing Page (`/`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 1.1 | Logo (Rolling Translations) | Link | Header | | |
| 1.2 | "Rolling Connect" text | Link | Header | | |
| 1.3 | Sign In | Link | Header | | |
| 1.4 | Register | Link | Header | | |
| 1.5 | Get Started | Link | Hero section | | |
| 1.6 | Sign In | Link | Hero section | | |
| 1.7 | Get started today | Link | Trust/CTA section | | |
| 1.8 | Footer logo | Image | Footer | | |
| 1.9 | Footer address/phone | Text | Footer | | |

---

## 2. Login Page (`/login`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 2.1 | Logo | Link | Header | | |
| 2.2 | Back to home | Link | Header | | |
| 2.3 | Name input | Input | Form (register only) | | |
| 2.4 | Role dropdown (Client/Interpreter) | Select | Form (register only) | | |
| 2.5 | Email input | Input | Form | | |
| 2.6 | Password input | Input | Form | | |
| 2.7 | Register / Sign In button | Button | Form | | |
| 2.8 | Register with Google / Sign in with Google | Button | Form | | |
| 2.9 | "Already have an account? Sign in" | Link | Below form | | |
| 2.10 | "Create an account" | Link | Below form | | |

---

## 3. Client Portal

### 3.1 Header (all client pages)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 3.1.1 | Logo + Rolling Connect | Link | Header | | |
| 3.1.2 | Dashboard | Nav link | Header | | |
| 3.1.3 | Requests | Nav link | Header | | |
| 3.1.4 | History | Nav link | Header | | |
| 3.1.5 | Sign Out | Button | Header | | |

### 3.2 Client Dashboard (`/client`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 3.2.1 | View your requests | Link | Pending approval state | | |
| 3.2.2 | Request Interpreter Now | Link | Card | | |
| 3.2.3 | Active Requests | Link | Card | | |

### 3.3 Request Interpreter (`/client/request`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 3.3.1 | Back to Dashboard | Link | Pending approval state | | |
| 3.3.2 | Organization dropdown | Select | Form | | |
| 3.3.3 | Service type (OPI/VRI) | Select | Form | | |
| 3.3.4 | Source language | Select | Form | | |
| 3.3.5 | Target language | Select | Form | | |
| 3.3.6 | Specialty | Select | Form | | |
| 3.3.7 | Estimated duration (min) | Input | Form | | |
| 3.3.8 | Urgency | Select | Form | | |
| 3.3.9 | Notes (optional) | Textarea | Form | | |
| 3.3.10 | Recording consent | Checkbox | Form | | |
| 3.3.11 | Request Interpreter Now | Button | Form | | |
| 3.3.12 | View requests | Link | Matching state | | |
| 3.3.13 | info@rolling-translations.com | Link | No interpreter state | | |
| 3.3.14 | Try again | Link | No interpreter state | | |
| 3.3.15 | View requests | Link | No interpreter state | | |

### 3.4 Active Requests (`/client/requests`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 3.4.1 | New Request | Link/Button | Top right | | |
| 3.4.2 | Join Call | Link | Per request (when assigned) | | |
| 3.4.3 | Cancel | Button | Per request | | |
| 3.4.4 | Details | Link | Per request | | |

### 3.5 Request Details (`/client/requests/[id]`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 3.5.1 | ← Back to requests | Link | Top | | |
| 3.5.2 | Join Call | Link | When assigned | | |
| 3.5.3 | Cancel | Button | When applicable | | |

### 3.6 Call Room (`/client/call/[id]`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 3.6.1 | Invite | Button | Header | | |
| 3.6.2 | Invite — Link copied! feedback | Text | After click | | |
| 3.6.3 | End Call | Button | Header | | |
| 3.6.4 | Cancel call & release interpreter | Button | Daily not configured state | | |
| 3.6.5 | Back to Requests | Link | Daily not configured state | | |
| 3.6.6 | dashboard.daily.co link | Link | Setup instructions | | |

### 3.7 Call Summary (`/client/call/[id]/summary`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 3.7.1 | Star rating (1–5) | Buttons | Form | | |
| 3.7.2 | Comments textarea | Textarea | Form | | |
| 3.7.3 | Submit feedback | Button | Form | | |
| 3.7.4 | Return to Dashboard | Link | After submit | | |
| 3.7.5 | Back to Requests | Link | Error state | | |

### 3.8 Call History (`/client/history`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 3.8.1 | Start month | Select | Filters | | |
| 3.8.2 | End month | Select | Filters | | |
| 3.8.3 | Apply filter | Button | Filters | | |
| 3.8.4 | Download PDF Report | Button | Filters | | |

---

## 4. Interpreter Portal

### 4.1 Header (all interpreter pages)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 4.1.1 | Logo + Rolling Connect | Link | Header | | |
| 4.1.2 | Dashboard | Nav link | Header | | |
| 4.1.3 | Profile | Nav link | Header | | |
| 4.1.4 | History | Nav link | Header | | |
| 4.1.5 | Sign Out | Button | Header | | |

### 4.2 Interpreter Dashboard (`/interpreter`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 4.2.1 | View your profile | Link | Pending approval state | | |
| 4.2.2 | Online | Button | Availability | | |
| 4.2.3 | Offline | Button | Availability | | |
| 4.2.4 | Busy | Button | Availability | | |
| 4.2.5 | Profile link (in hint text) | Link | Active offers section | | |
| 4.2.6 | Join Call | Link | When assigned | | |
| 4.2.7 | Accept | Button | Per offer | | |
| 4.2.8 | Decline | Button | Per offer | | |

### 4.3 Interpreter Profile (`/interpreter/profile`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 4.3.1 | Source language (per pair) | Select | Form | | |
| 4.3.2 | Target language (per pair) | Select | Form | | |
| 4.3.3 | Remove (language pair) | Button | Per pair | | |
| 4.3.4 | + Add language pair | Button | Form | | |
| 4.3.5 | Specialty chips | Buttons | Form | | |
| 4.3.6 | Time zone | Select | Form | | |
| 4.3.7 | Save profile | Button | Form | | |

### 4.4 Interpreter Call Room (`/interpreter/call/[jobId]`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 4.4.1 | Invite | Button | Header | | |
| 4.4.2 | End Call | Button | Header | | |
| 4.4.3 | Cancel call & release interpreter | Button | Daily not configured | | |
| 4.4.4 | Back to Dashboard | Link | Daily not configured | | |

### 4.5 Interpreter Call Summary (`/interpreter/call/[jobId]/summary`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 4.5.1 | Notes textarea | Textarea | Form | | |
| 4.5.2 | Save notes | Button | Form | | |
| 4.5.3 | Return to Dashboard | Link | Bottom | | |
| 4.5.4 | Back to Dashboard | Link | Error state | | |

### 4.6 Interpreter History (`/interpreter/history`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 4.6.1 | (No interactive elements — display only) | | | | |

---

## 5. Admin Portal

### 5.1 Header (all admin pages)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 5.1.1 | Logo + Rolling Connect — Admin | Link | Header | | |
| 5.1.2 | Dashboard | Nav link | Header | | |
| 5.1.3 | Jobs | Nav link | Header | | |
| 5.1.4 | Users | Nav link | Header | | |
| 5.1.5 | Reports | Nav link | Header | | |
| 5.1.6 | Sign Out | Button | Header | | |

### 5.2 Admin Dashboard (`/admin`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 5.2.1 | Manage Jobs | Link | Card | | |
| 5.2.2 | Manage Users | Link | Card | | |
| 5.2.3 | Billing Reports | Link | Card | | |

### 5.3 Admin Jobs (`/admin/jobs`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 5.3.1 | Cancel | Button | Per job (when assigned/in_call) | | |
| 5.3.2 | Confirm dialog ("Cancel this job?") | Modal | On Cancel click | | |

### 5.4 Admin Users (`/admin/users`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 5.4.1 | Approve | Button | Per user (pending) | | |
| 5.4.2 | Reject | Button | Per user (pending) | | |
| 5.4.3 | Retry | Button | Error state | | |
| 5.4.4 | Dismiss | Button | Error state | | |

### 5.5 Admin Reports (`/admin/reports`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 5.5.1 | Client filter | Select | Filters | | |
| 5.5.2 | Interpreter filter | Select | Filters | | |
| 5.5.3 | Month filter | Select | Filters | | |
| 5.5.4 | Download Report | Button | Filters | | |

---

## 6. Other Pages

### 6.1 Dashboard redirect (`/dashboard`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 6.1.1 | Redirects to role-specific dashboard | Redirect | N/A | | |

### 6.2 Unauthorized (`/unauthorized`)

| # | Element | Type | Location | Pass/Fail | Comments |
|---|---------|------|----------|-----------|----------|
| 6.2.1 | Logo | Link | Header | | |
| 6.2.2 | Return home | Link | Body | | |

---

## 7. Cross-cutting / General

| # | Element | Type | Pass/Fail | Comments |
|---|---------|------|-----------|----------|
| 7.1 | Responsive layout (mobile/tablet/desktop) | Layout | | |
| 7.2 | Loading states display correctly | UX | | |
| 7.3 | Error messages display correctly | UX | | |
| 7.4 | Form validation (required fields, min length) | UX | | |
| 7.5 | Real-time updates (Socket.io: offers, assignment, call ended) | UX | | |
| 7.6 | Role-based redirects (client → /client, interpreter → /interpreter, admin → /admin) | Auth | | |
| 7.7 | Protected routes (unauthorized users redirected) | Auth | | |

---

## 8. Email & External

| # | Element | Pass/Fail | Comments |
|---|---------|-----------|----------|
| 8.1 | Welcome email (client registration) | | |
| 8.2 | Interpreter welcome email (interpreter registration) | | |
| 8.3 | Approval email (admin approves client/interpreter) | | |
| 8.4 | Google OAuth sign-in (client) | | |
| 8.5 | Google OAuth sign-in (interpreter) | | |

---

## Notes for Tester

- **Test accounts**: You will need at least one client, one interpreter, and one admin account.
- **Daily.co**: Video/audio calls require `DAILY_API_KEY` and `DAILY_DOMAIN` in `.env`. Without them, the call UI shows setup instructions.
- **Real-time**: Some flows (e.g. interpreter offer, client auto-redirect when interpreter accepts) use WebSockets. Ensure the app is running and socket connection works.
- **PDF download**: Client History and Admin Reports have PDF export. Test in a browser that supports it.
