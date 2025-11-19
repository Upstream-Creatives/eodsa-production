# Quick Test Start Guide

## 🚀 Before You Start

1. **Run the database test script** to verify setup:
   ```bash
   node scripts/test-qualification-system.js
   ```

2. **If migration hasn't been run**, execute:
   ```bash
   node scripts/migrate-event-types-qualifications.js
   ```

## ✅ Quick Test Checklist (15 minutes)

### Phase 1: Basic Event Creation (5 min)

1. **Create a REGIONAL_EVENT**
   - Go to Admin → Events → Create Event
   - Select "🏘️ Regional" event type
   - Select "🔀 Hybrid" event mode
   - Fill in required fields and create
   - ✅ **Expected**: Event created successfully

2. **Create a NATIONAL_EVENT**
   - Create new event
   - Select "🏆 National" event type
   - ✅ **Expected**: 
     - Qualification Required: auto-checked ✅
     - Qualification Source: "REGIONAL" (auto-selected)
     - Minimum Score: 75 (auto-filled)
   - Create event
   - ✅ **Expected**: Event created with qualification rules

### Phase 2: Entry Validation (5 min)

3. **Test REGIONAL_EVENT Entry (Should Work)**
   - Go to event entry form
   - Select the REGIONAL_EVENT you created
   - Create an entry for any dancer
   - ✅ **Expected**: Entry created successfully (no qualification check)

4. **Test NATIONAL_EVENT Entry (Should Block)**
   - Go to event entry form
   - Select the NATIONAL_EVENT you created
   - Try to create entry for a dancer with NO regional performances
   - ✅ **Expected**: Error message:
     ```
     "You must qualify from a Regional Event with a minimum score of 75% to enter this event."
     ```

### Phase 3: Event Mode Validation (3 min)

5. **Test VIRTUAL Mode**
   - Create event with Event Mode: "🎥 Virtual"
   - Try to create entry with `entryType: 'live'`
   - ✅ **Expected**: Error: "This event only accepts virtual entries"
   - Try with `entryType: 'virtual'`
   - ✅ **Expected**: Entry created successfully

6. **Test LIVE Mode**
   - Create event with Event Mode: "🎭 Live"
   - Try to create entry with `entryType: 'virtual'`
   - ✅ **Expected**: Error: "This event only accepts live entries"
   - Try with `entryType: 'live'`
   - ✅ **Expected**: Entry created successfully

### Phase 4: Verify Database (2 min)

7. **Check Audit Logs**
   ```sql
   SELECT * FROM qualification_audit_logs 
   ORDER BY performed_at DESC 
   LIMIT 5;
   ```
   - ✅ **Expected**: See `ENTRY_ATTEMPT` and `ENTRY_BLOCKED` records

8. **Check Event Configuration**
   ```sql
   SELECT name, event_type, event_mode, qualification_required 
   FROM events 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
   - ✅ **Expected**: Events show correct `event_type` and `event_mode`

## 🐛 If Something Doesn't Work

### Entry Always Allowed (Should Be Blocked)
- Check browser console for errors
- Check server logs
- Verify event has `qualification_required = true` in database
- Verify `qualification_source` is set correctly

### Entry Always Blocked (Should Be Allowed)
- Check if dancer has qualifying performance
- Verify performance score is >= minimum requirement
- Check `qualification_audit_logs` for specific error reason

### UI Not Showing Event Types
- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- Check browser console for JavaScript errors
- Verify you're logged in as admin

## 📋 Full Test Guide

For comprehensive testing, see `TESTING_GUIDE.md` which includes:
- All 12 detailed test cases
- Manual qualification testing
- International event testing
- SQL verification queries

## 🎯 What's Working vs What's Not

### ✅ Implemented & Ready to Test:
- Event Type selection (REGIONAL, NATIONAL, QUALIFIER, INTERNATIONAL)
- Event Mode selection (LIVE, VIRTUAL, HYBRID)
- Qualification validation (REGIONAL, ANY_NATIONAL_LEVEL, MANUAL, CUSTOM)
- Event mode validation (blocks wrong entry types)
- Audit logging
- Database schema

### ⚠️ Note:
- Manual Qualifications UI tab was removed from Event Edit modal
- Manual qualifications API endpoints still work (`/api/events/[id]/qualifications`)
- You can test manual qualifications via API calls or add the UI back if needed

## 🔧 Quick Fixes

### Restore Manual Qualifications UI
If you need the Manual Qualifications tab in the Event Edit modal, the code was removed but can be restored. The API endpoints are still functional.

### Test Manual Qualifications via API
You can test manual qualifications using curl or Postman:

```bash
# Add manual qualification
curl -X POST http://localhost:3000/api/events/[EVENT_ID]/qualifications \
  -H "Content-Type: application/json" \
  -d '{
    "dancerId": "[DANCER_ID]",
    "addedBy": "[ADMIN_ID]",
    "adminSession": "[ADMIN_SESSION_JSON]"
  }'

# Get manual qualifications
curl http://localhost:3000/api/events/[EVENT_ID]/qualifications
```

## 📞 Need Help?

1. Check `TESTING_GUIDE.md` for detailed test cases
2. Run `node scripts/test-qualification-system.js` to verify database setup
3. Check browser console and server logs for errors
4. Review the implementation files:
   - `app/api/event-entries/route.ts` (validation logic)
   - `lib/database.ts` (qualification check functions)
   - `app/admin/page.tsx` (UI)

