# Rolling Connect — Matching Algorithm

## Pseudocode

```
FUNCTION findEligibleInterpreters(request):
  // 1. Base filters
  interpreters = DB.query("""
    SELECT u.*, ip.*, ia.*
    FROM users u
    JOIN interpreter_profiles ip ON ip.user_id = u.id
    JOIN interpreter_availability ia ON ia.user_id = u.id
    WHERE u.role = 'interpreter'
      AND ia.status = 'online'
      AND (ia.working_hours IS NULL OR isWithinWorkingHours(ia.working_hours, request.scheduled_at))
      AND ip.max_concurrent_jobs > (
        SELECT COUNT(*) FROM jobs j
        WHERE j.assigned_interpreter_id = u.id
        AND j.status IN ('assigned', 'in_call')
      )
  """)

  // 2. Language pair match
  interpreters = interpreters.filter(i =>
    ip.language_pairs contains { source: request.source_language, target: request.target_language }
  )

  // 3. Dialect match (if required)
  IF request.dialect IS NOT NULL:
    interpreters = interpreters.filter(i =>
      i.language_pairs[].dialect = request.dialect OR i.language_pairs[].dialect IS NULL
    )

  // 4. Specialty match
  interpreters = interpreters.filter(i =>
    ip.specialties contains request.specialty
  )

  // 5. Optional: certification level
  IF request.certification_level IS NOT NULL:
    interpreters = interpreters.filter(i =>
      ip.certifications contains { level: request.certification_level }
    )

  // 6. Optional: years experience
  IF request.years_experience IS NOT NULL:
    interpreters = interpreters.filter(i =>
      ip.years_experience >= request.years_experience
    )

  // 7. Optional: security clearance
  IF request.security_clearance = true:
    interpreters = interpreters.filter(i =>
      ip.security_clearance = true
    )

  // 8. Optional: gender preference
  IF request.gender_preference IS NOT NULL:
    interpreters = interpreters.filter(i =>
      ip.gender = request.gender_preference
    )

  // 9. Sort by: availability recency, rating (Phase 2), response time (Phase 2)
  interpreters = interpreters.sortBy(i => i.equipment_tested_at DESC)

  RETURN interpreters
```

## Escalation (No Match in 30s)

```
FUNCTION escalateMatch(request, attempt):
  IF attempt = 1:
    // Relax dialect
    request.dialect = NULL
    RETURN findEligibleInterpreters(request)
  IF attempt = 2:
    // Relax certification
    request.certification_level = NULL
    RETURN findEligibleInterpreters(request)
  IF attempt = 3:
    // Relax specialty to "general"
    request.specialty = "general"
    RETURN findEligibleInterpreters(request)
  RETURN []  // No match
```
