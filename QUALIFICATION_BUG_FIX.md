# Qualification Validation Bug Fix

## 🐛 Bug Report

**Issue**: Bruno Fernandes (EODSA ID: E585029) was able to enter a NATIONAL_EVENT even though he has no entries/performances whatsoever. The qualification validation did not block him.

**Root Cause**: 
The validation logic in `app/api/event-entries/route.ts` was checking `qualificationRequired` from the database. If this field was `null`, `undefined`, or `false`, the validation was completely skipped:

```typescript
const qualificationRequired = (event as any).qualificationRequired ?? false;
if (qualificationRequired) {
  // validation code...
}
```

**Why This Happened**:
1. Events created before the migration might not have `qualification_required` set correctly
2. Events updated through the UI might not have properly set the qualification fields
3. The database default for `qualification_required` is `FALSE`, so if not explicitly set, validation is skipped

## ✅ Fix Applied

### 1. Safety Check in Validation Logic

Added automatic enforcement for NATIONAL_EVENT events in `app/api/event-entries/route.ts`:

```typescript
// Safety check: If event is NATIONAL_EVENT, automatically require qualification
let eventType = (event as any).eventType || 'REGIONAL_EVENT';

// Additional safety: If event name contains "national" but event_type is not set
if (!(event as any).eventType && event.name && event.name.toLowerCase().includes('national')) {
  eventType = 'NATIONAL_EVENT';
}

let qualificationRequired = (event as any).qualificationRequired ?? false;

// Auto-enforce qualification for NATIONAL_EVENT if not explicitly set
if (eventType === 'NATIONAL_EVENT' && !qualificationRequired) {
  qualificationRequired = true;
  // Also ensure qualification_source and minimumQualificationScore are set
  if (!(event as any).qualificationSource) {
    (event as any).qualificationSource = 'REGIONAL';
  }
  if (!(event as any).minimumQualificationScore) {
    (event as any).minimumQualificationScore = 75;
  }
}
```

**What This Does**:
- Automatically enforces qualification for any event with `event_type = 'NATIONAL_EVENT'`
- Even if the database field `qualification_required` is `false` or `null`, the validation will still run
- Also handles events with "national" in the name that might not have `event_type` set correctly

### 2. Database Fix Script

Created `scripts/fix-national-events-qualification.js` to fix existing events in the database:

**Usage**:
```bash
node scripts/fix-national-events-qualification.js
```

**What It Does**:
- Finds all NATIONAL_EVENT events with incorrect qualification settings
- Updates them to have:
  - `qualification_required = true`
  - `qualification_source = 'REGIONAL'` (if not set)
  - `minimum_qualification_score = 75` (if not set)
- Provides a summary of fixes applied

## 🧪 Testing

### Test Case: Unqualified Dancer Entry

1. **Setup**:
   - Create a NATIONAL_EVENT (or use existing one)
   - Ensure a dancer (e.g., Bruno Fernandes, E585029) has NO regional performances

2. **Test**:
   - Attempt to create an entry for the unqualified dancer
   - **Expected**: Entry should be blocked with error:
     ```
     "You must qualify from a Regional Event with a minimum score of 75% to enter this event. Please participate in a Regional Event first."
     ```

3. **Verify**:
   - Check server logs for warning message:
     ```
     ⚠️ [Qualification] NATIONAL_EVENT "..." has qualificationRequired=false. Auto-enforcing qualification.
     ```
   - Check `qualification_audit_logs` table for `ENTRY_BLOCKED` record

### Test Case: Qualified Dancer Entry

1. **Setup**:
   - Create a REGIONAL_EVENT
   - Create entry for dancer and score them >= 75%
   - Create a NATIONAL_EVENT

2. **Test**:
   - Attempt to create entry for the qualified dancer
   - **Expected**: Entry should be created successfully ✅

## 📋 Verification Steps

1. **Check Event Configuration**:
   ```sql
   SELECT 
     id, 
     name, 
     event_type, 
     qualification_required, 
     qualification_source, 
     minimum_qualification_score 
   FROM events 
   WHERE event_type = 'NATIONAL_EVENT';
   ```
   - All should have `qualification_required = true`

2. **Check Audit Logs**:
   ```sql
   SELECT * FROM qualification_audit_logs 
   WHERE action_type = 'ENTRY_BLOCKED'
   ORDER BY performed_at DESC 
   LIMIT 10;
   ```
   - Should see blocked entries for unqualified dancers

3. **Test Entry Attempt**:
   - Try to create entry for unqualified dancer
   - Should see error message and entry should be blocked

## 🔍 Debugging

If qualification validation is still not working:

1. **Check Server Logs**:
   - Look for warning messages about auto-enforcing qualification
   - Check for any errors in the qualification check logic

2. **Check Event Data**:
   ```sql
   SELECT * FROM events WHERE id = 'YOUR_EVENT_ID';
   ```
   - Verify `event_type` is set correctly
   - Verify `qualification_required` is `true` (or will be auto-enforced)

3. **Check Qualification Check Function**:
   - Verify `checkRegionalQualification()` is working correctly
   - Check if dancer has qualifying performances:
     ```sql
     SELECT 
       p.id,
       e.name as event_name,
       e.event_type,
       AVG(s.technical_score + s.musical_score + s.performance_score + 
           s.styling_score + s.overall_impression_score) as avg_score
     FROM performances p
     JOIN event_entries ee ON ee.id = p.event_entry_id
     JOIN events e ON e.id = p.event_id
     JOIN scores s ON s.performance_id = p.id
     WHERE ee.eodsa_id = 'E585029'
       AND e.event_type = 'REGIONAL_EVENT'
       AND p.scores_published = true
     GROUP BY p.id, e.id
     HAVING AVG(...) >= 75;
     ```

## 📝 Notes

- The fix is **backward compatible** - existing events will work correctly
- The fix is **defensive** - it will catch cases where database fields are not set correctly
- The fix script should be run to update existing events in the database
- Future event creation should properly set qualification fields (already implemented in `createEvent`)

## 🚀 Next Steps

1. **Run the fix script** to update existing events:
   ```bash
   node scripts/fix-national-events-qualification.js
   ```

2. **Test the fix** with Bruno Fernandes (E585029):
   - Attempt to create entry in a NATIONAL_EVENT
   - Should now be blocked ✅

3. **Monitor server logs** for any warning messages about auto-enforcement

4. **Verify audit logs** are being created for blocked entries

