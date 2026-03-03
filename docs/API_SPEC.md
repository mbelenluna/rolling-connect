# Rolling Connect — API Specification

## Base URL

- Development: `http://localhost:3000/api`
- Production: `https://api.rolling-connect.com` (or same-origin)

## Authentication

All endpoints (except auth) require `Authorization: Bearer <token>` or session cookie.

---

## Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register (client or interpreter) |
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout |
| GET | `/auth/session` | Get current session |

---

## Client — Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/requests` | Create interpretation request |
| GET | `/requests/:id` | Get request status |
| GET | `/requests` | List requests (filter by org, status) |
| PATCH | `/requests/:id/cancel` | Cancel request |
| GET | `/requests/:id/call-token` | Get WebRTC join token |

### POST /requests — Create Request

**Request:**
```json
{
  "serviceType": "OPI",
  "sourceLanguage": "en",
  "targetLanguage": "es",
  "specialty": "medical",
  "industry": "Healthcare",
  "costCenter": "CC-001",
  "certificationLevel": "certified",
  "yearsExperience": 3,
  "securityClearance": false,
  "genderPreference": null,
  "dialect": "Mexican Spanish",
  "notes": "Patient consultation",
  "estimatedDurationMinutes": 15,
  "urgency": "normal",
  "recordingConsent": false,
  "scheduleType": "now",
  "scheduledAt": null
}
```

**Response:**
```json
{
  "id": "req_abc123",
  "status": "PENDING",
  "createdAt": "2025-02-26T10:00:00Z",
  "estimatedMatchTime": 30
}
```

---

## Interpreter — Offers & Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/offers` | List active offers (WebSocket primary) |
| POST | `/offers/:jobId/accept` | Accept offer (atomic) |
| POST | `/offers/:jobId/decline` | Decline offer |
| GET | `/jobs/:id` | Get job details |
| GET | `/jobs/:id/call-token` | Get WebRTC join token |
| POST | `/jobs/:id/complete` | Complete job (wrap-up notes) |

### POST /offers/:jobId/accept

**Response (success):**
```json
{
  "success": true,
  "job": {
    "id": "job_xyz",
    "status": "ASSIGNED",
    "joinToken": "eyJ...",
    "roomUrl": "https://..."
  }
}
```

**Response (already assigned):**
```json
{
  "success": false,
  "error": "ALREADY_ASSIGNED"
}
```

---

## Interpreter — Profile & Availability

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/interpreter/profile` | Get profile |
| PATCH | `/interpreter/profile` | Update profile |
| PATCH | `/interpreter/availability` | Set online/offline/busy |
| GET | `/interpreter/schedule` | Get working hours |
| PATCH | `/interpreter/schedule` | Update working hours |

---

## Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | List users |
| PATCH | `/admin/users/:id` | Update user |
| GET | `/admin/users/:id` | Get user |
| GET | `/admin/jobs` | List jobs (queue, active) |
| PATCH | `/admin/jobs/:id/reassign` | Force reassign |
| PATCH | `/admin/jobs/:id/cancel` | Cancel job |
| GET | `/admin/languages` | List languages |
| GET | `/admin/specialties` | List specialties |
| POST | `/admin/rates` | Create rate |
| GET | `/admin/reports` | Reporting |
| GET | `/admin/audit-logs` | Audit logs |

---

## Organizations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/organizations` | List user's orgs |
| POST | `/organizations` | Create org |
| GET | `/organizations/:id` | Get org |
| PATCH | `/organizations/:id` | Update org |
| GET | `/organizations/:id/invoices` | List invoices |

---

## Billing

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invoices` | List invoices |
| GET | `/invoices/:id` | Get invoice |
| GET | `/invoices/:id/download` | Download PDF |
