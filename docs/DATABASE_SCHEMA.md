# Rolling Connect — Database Schema

## Entity Relationship Overview

```
users ──┬── organizations (members) ── organization_members
        ├── interpreter_profiles
        ├── interpreter_availability
        └── audit_logs

interpretation_requests ── jobs ── calls
        │                    │
        └── organizations    └── interpreters (users)

languages, specialties, rates, invoices
```

## Tables

### users

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| email | VARCHAR(255) | Unique |
| password_hash | VARCHAR(255) | bcrypt |
| role | ENUM(client, interpreter, admin) | |
| name | VARCHAR(255) | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### organizations

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | VARCHAR(255) | |
| billing_email | VARCHAR(255) | |
| billing_address | JSONB | |
| cost_centers | JSONB | Array of strings |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### organization_members

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| organization_id | UUID | FK |
| user_id | UUID | FK |
| role | ENUM(owner, member, billing) | |
| created_at | TIMESTAMP | |

### interpreter_profiles

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK, unique |
| language_pairs | JSONB | [{source, target, proficiency}] |
| specialties | JSONB | Array |
| certifications | JSONB | Array |
| time_zone | VARCHAR(50) | |
| max_concurrent_jobs | INT | Default 1 |
| pool_id | UUID | FK optional |
| equipment_tested_at | TIMESTAMP | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### interpreter_pools

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | VARCHAR(255) | |
| created_at | TIMESTAMP | |

### interpreter_availability

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK |
| status | ENUM(online, offline, busy) | |
| working_hours | JSONB | {mon: {start, end}, ...} |
| updated_at | TIMESTAMP | |

### interpretation_requests

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| organization_id | UUID | FK |
| created_by_user_id | UUID | FK |
| service_type | ENUM(OPI, VRI) | |
| source_language | VARCHAR(10) | |
| target_language | VARCHAR(10) | |
| specialty | VARCHAR(50) | |
| industry | VARCHAR(255) | |
| cost_center | VARCHAR(100) | |
| certification_level | VARCHAR(50) | |
| years_experience | INT | |
| security_clearance | BOOLEAN | |
| gender_preference | VARCHAR(20) | |
| dialect | VARCHAR(100) | |
| notes | TEXT | |
| glossary_url | VARCHAR(500) | |
| estimated_duration_minutes | INT | |
| urgency | ENUM(low, normal, high, urgent) | |
| recording_consent | BOOLEAN | |
| schedule_type | ENUM(now, scheduled) | |
| scheduled_at | TIMESTAMP | |
| time_zone | VARCHAR(50) | |
| status | ENUM(pending, matching, offered, assigned, in_call, completed, canceled) | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### jobs

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| request_id | UUID | FK |
| status | ENUM(pending, offered, assigned, in_call, completed, expired, canceled) | |
| assigned_interpreter_id | UUID | FK, nullable |
| offer_expires_at | TIMESTAMP | |
| offered_to_ids | JSONB | Array of user_ids |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### calls

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| job_id | UUID | FK |
| room_id | VARCHAR(255) | WebRTC room |
| started_at | TIMESTAMP | |
| ended_at | TIMESTAMP | |
| duration_seconds | INT | |
| interpreter_notes | TEXT | |
| created_at | TIMESTAMP | |

### languages

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| code | VARCHAR(10) | e.g. en, es |
| name | VARCHAR(100) | |
| active | BOOLEAN | |

### specialties

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| code | VARCHAR(50) | medical, legal, etc. |
| name | VARCHAR(100) | |
| active | BOOLEAN | |

### rates

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| service_type | ENUM(OPI, VRI) | |
| specialty | VARCHAR(50) | |
| per_minute_cents | INT | |
| minimum_minutes | INT | |
| minimum_charge_cents | INT | |
| rush_fee_percent | INT | For urgent |
| effective_from | DATE | |
| effective_to | DATE | Nullable |

### invoices

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| organization_id | UUID | FK |
| period_start | DATE | |
| period_end | DATE | |
| total_cents | INT | |
| status | ENUM(draft, sent, paid) | |
| line_items | JSONB | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### audit_logs

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK nullable |
| action | VARCHAR(100) | |
| entity_type | VARCHAR(50) | |
| entity_id | UUID | |
| metadata | JSONB | |
| ip_address | VARCHAR(45) | |
| created_at | TIMESTAMP | |
