# Rolling Connect — Product Requirements & User Flows

## Product Vision

A production-ready on-demand interpretation platform (OPI + VRI) enabling clients to request interpreters "now" or scheduled. All eligible interpreters receive instant notifications; first-accept wins; the call starts immediately.

---

## Core Roles & Access Control

| Role | Capabilities |
|------|--------------|
| **Client** | Create requests, manage organizations, view history, invoices |
| **Interpreter** | Set availability, receive offers, accept/decline, join calls |
| **Admin** | Manage users, rates, languages, compliance, disputes, reporting |

---

## User Flows

### Client Flow: Request Interpreter Now

```
1. Client logs in → Dashboard
2. Clicks "Request Interpreter Now" (primary CTA)
3. Guided form (≤30 sec target):
   - Service type: OPI | VRI
   - Languages: source → target
   - Specialty: medical | legal | customer service | education | general
   - Industry/department/cost center
   - Optional: certification, years exp, security clearance, gender, dialect
   - Call context notes, glossary upload
   - Estimated duration, urgency
   - Recording consent (default: off)
   - Optional attachment
4. Submit → "Matching interpreters…" live status
5. If no accept in 30s: escalate (broaden criteria | schedule ASAP | no match)
6. When assigned: "Interpreter connected" → Join Call
7. Post-call: view summary, download receipt
```

### Client Flow: Scheduled Request

```
1. Client logs in → "Schedule Request"
2. Same form + Location/Time zone, scheduled date/time
3. Submit → Confirmation
4. At scheduled time: interpreters notified, same first-accept flow
```

### Interpreter Flow: Receive & Accept

```
1. Interpreter logs in → Availability: Online
2. Job offer arrives (instant notification + audible alert + email)
3. Offer card: language pair, specialty, duration, notes
4. Tap "Accept" → Atomic claim
   - If wins: "Join Call" button appears immediately
   - If loses: "Already assigned" message
5. Join Call → OPI audio or VRI video room
6. Post-call: wrap-up notes, tag issues
```

### Admin Flow: Management

```
- Manage language pairs, specialties, eligibility rules
- Live queue view, active calls
- Force reassign/cancel
- Pricing: per-minute, per-15-min, rush fee, minimum
- Reporting: response times, fill rates, utilization
- Disputes/refunds workflow
- Audit logs
```

---

## Request Form Fields (Complete)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Service type | OPI \| VRI | ✓ | |
| Source language | Select | ✓ | |
| Target language | Select | ✓ | |
| Specialty | medical \| legal \| customer service \| education \| general | ✓ | |
| Industry/department | Text | Optional | |
| Cost center | Text | Optional | |
| Certification level | Select | Optional | |
| Years experience | Number | Optional | |
| Security clearance | Boolean | Optional | |
| Gender preference | Select | Optional | |
| Dialect | Text | Optional | |
| Call context notes | Textarea | Optional | |
| Glossary upload | File | Optional | |
| Location/time zone | Text/Select | For scheduled | |
| Estimated duration | Number (min) | ✓ | Default 15 |
| Urgency | low \| normal \| high \| urgent | ✓ | Default normal |
| Recording consent | Boolean | ✓ | Default false |
| Attachment | File | Optional | |
| Schedule type | now \| scheduled | ✓ | |

---

## Escalation Logic (No Match in 30s)

1. **Retry with expanded pool**: Relax dialect, certification, or specialty
2. **Schedule ASAP**: Offer to schedule for next available slot
3. **No match**: Show options: retry, schedule, contact support

---

## Assumptions & Defaults

| Item | Default |
|------|---------|
| Offer timeout | 30 seconds |
| Pricing model | Per-minute + minimum charge |
| Rush fee | 25% for urgent |
| Email provider | Resend (or Nodemailer SMTP) |
| Call provider | WebRTC (LiveKit or Daily.co for production) |
| Max concurrent jobs per interpreter | 1 |
| Default estimated duration | 15 minutes |
