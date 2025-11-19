# Event Types & Qualification System - Testing Guide

This guide will help you systematically test all features of the Event Types & Qualification System.

## Prerequisites

1. **Database Migration**: Ensure the migration script has been run:
   ```bash
   node scripts/migrate-event-types-qualifications.js
   ```

2. **Test Data Setup**: You'll need:
   - At least 2 test dancers (with EODSA IDs)
   - Admin access to create/edit events
   - Ability to create event entries

## Test Cases

### Test 1: REGIONAL_EVENT - Open Entry (No Qualification Required)

**Goal**: Verify that REGIONAL_EVENT allows any dancer to enter.

**Steps**:
1. Create a new event:
   - Event Type: `REGIONAL_EVENT`
   - Event Mode: `HYBRID` (or any)
   - Qualification Required: `false` (should be default)
2. Attempt to create an entry for any dancer
3. **Expected**: Entry should be created successfully ✅

**Verification**:
- Entry appears in event entries list
- No qualification error messages

---

### Test 2: NATIONAL_EVENT - Regional Qualification Required

**Goal**: Verify that NATIONAL_EVENT requires qualification from a Regional Event with minimum score.

**Setup**:
1. Create a REGIONAL_EVENT (Test Event A)
2. Create an entry for Dancer 1 in Test Event A
3. Score Dancer 1's performance: **80%** (above 75% threshold)
4. Create a NATIONAL_EVENT (Test Event B):
   - Event Type: `NATIONAL_EVENT`
   - Qualification Required: `true` (auto-set)
   - Qualification Source: `REGIONAL` (auto-set)
   - Minimum Qualification Score: `75` (default)

**Test Steps**:
1. **Test 2a - Qualified Dancer**:
   - Attempt to create entry for Dancer 1 in Test Event B
   - **Expected**: Entry should be created successfully ✅

2. **Test 2b - Unqualified Dancer**:
   - Create a new dancer (Dancer 2) with no regional performances
   - Attempt to create entry for Dancer 2 in Test Event B
   - **Expected**: Entry should be blocked with error:
     ```
     "You must qualify from a Regional Event with a minimum score of 75% to enter this event. Please participate in a Regional Event first."
     ```

3. **Test 2c - Dancer with Low Score**:
   - Score Dancer 2's performance in Test Event A: **70%** (below 75%)
   - Attempt to create entry for Dancer 2 in Test Event B
   - **Expected**: Entry should be blocked (score too low)

**Verification**:
- Check `qualification_audit_logs` table for `ENTRY_ATTEMPT` and `ENTRY_BLOCKED` records
- Verify error messages are user-friendly

---

### Test 3: QUALIFIER_EVENT - Open Entry

**Goal**: Verify that QUALIFIER_EVENT allows any dancer to enter (no qualification required).

**Steps**:
1. Create a new event:
   - Event Type: `QUALIFIER_EVENT`
   - Qualification Required: `false` (should be default)
2. Attempt to create an entry for any dancer (even without regional qualification)
3. **Expected**: Entry should be created successfully ✅

**Verification**:
- Entry appears in event entries list
- No qualification checks performed

---

### Test 4: INTERNATIONAL_VIRTUAL_EVENT - Manual Qualification

**Goal**: Verify manual qualification system for international events.

**Setup**:
1. Create an INTERNATIONAL_VIRTUAL_EVENT:
   - Event Type: `INTERNATIONAL_VIRTUAL_EVENT`
   - Event Mode: `VIRTUAL` (or `HYBRID`)
   - Qualification Required: `true`
   - Qualification Source: `MANUAL`

**Test Steps**:
1. **Test 4a - Unqualified Dancer**:
   - Attempt to create entry for Dancer 1 (not in manual list)
   - **Expected**: Entry should be blocked with error:
     ```
     "This event requires manual qualification. Please contact the event administrator."
     ```

2. **Test 4b - Add Manual Qualification**:
   - Go to Event Edit modal → "Manual Qualifications" tab
   - Search for Dancer 1
   - Click "Add" to qualify Dancer 1
   - **Expected**: Dancer 1 appears in qualified list ✅

3. **Test 4c - Qualified Dancer**:
   - Attempt to create entry for Dancer 1 again
   - **Expected**: Entry should be created successfully ✅

4. **Test 4d - Remove Qualification**:
   - Remove Dancer 1 from manual qualifications
   - Attempt to create entry for Dancer 1
   - **Expected**: Entry should be blocked again

**Verification**:
- Check `event_manual_qualifications` table for add/remove records
- Check `qualification_audit_logs` for manual qualification actions
- Verify UI shows qualified dancers with timestamps

---

### Test 5: Event Mode Validation (LIVE/VIRTUAL/HYBRID)

**Goal**: Verify that event mode restricts entry types correctly.

**Test Steps**:
1. **Test 5a - VIRTUAL Mode**:
   - Create event with Event Mode: `VIRTUAL`
   - Attempt to create entry with `entryType: 'live'`
   - **Expected**: Entry blocked with error:
     ```
     "This event only accepts virtual entries. Live entries are not allowed."
     ```
   - Attempt to create entry with `entryType: 'virtual'`
   - **Expected**: Entry created successfully ✅

2. **Test 5b - LIVE Mode**:
   - Create event with Event Mode: `LIVE`
   - Attempt to create entry with `entryType: 'virtual'`
   - **Expected**: Entry blocked with error:
     ```
     "This event only accepts live entries. Virtual entries are not allowed."
     ```
   - Attempt to create entry with `entryType: 'live'`
   - **Expected**: Entry created successfully ✅

3. **Test 5c - HYBRID Mode**:
   - Create event with Event Mode: `HYBRID`
   - Attempt to create entry with `entryType: 'live'`
   - **Expected**: Entry created successfully ✅
   - Attempt to create entry with `entryType: 'virtual'`
   - **Expected**: Entry created successfully ✅

---

### Test 6: INTERNATIONAL_VIRTUAL_EVENT - ANY_NATIONAL_LEVEL Qualification

**Goal**: Verify qualification from National/Qualifier events.

**Setup**:
1. Create a NATIONAL_EVENT (Test Event C)
2. Create an entry for Dancer 1 in Test Event C
3. Score Dancer 1's performance: **80%**
4. Create an INTERNATIONAL_VIRTUAL_EVENT:
   - Qualification Required: `true`
   - Qualification Source: `ANY_NATIONAL_LEVEL`
   - Minimum Qualification Score: `75` (optional)

**Test Steps**:
1. **Test 6a - Qualified Dancer**:
   - Attempt to create entry for Dancer 1
   - **Expected**: Entry created successfully ✅

2. **Test 6b - Unqualified Dancer**:
   - Attempt to create entry for Dancer 2 (no national/qualifier participation)
   - **Expected**: Entry blocked with error about national/qualifier participation

---

### Test 7: INTERNATIONAL_VIRTUAL_EVENT - CUSTOM Qualification

**Goal**: Verify CUSTOM qualification source returns appropriate error.

**Steps**:
1. Create an INTERNATIONAL_VIRTUAL_EVENT:
   - Qualification Required: `true`
   - Qualification Source: `CUSTOM`
2. Attempt to create entry for any dancer
3. **Expected**: Entry blocked with error:
   ```
   "This event has custom qualification requirements. Please contact the event administrator for more information."
   ```

---

### Test 8: Event Creation UI - Auto-Configuration

**Goal**: Verify that event creation UI auto-configures qualification rules.

**Test Steps**:
1. **Test 8a - NATIONAL_EVENT Auto-Config**:
   - Create new event
   - Select Event Type: `NATIONAL_EVENT`
   - **Expected**: 
     - Qualification Required: `true` (auto-checked)
     - Qualification Source: `REGIONAL` (auto-selected)
     - Minimum Qualification Score: `75` (auto-filled)

2. **Test 8b - QUALIFIER_EVENT Auto-Config**:
   - Create new event
   - Select Event Type: `QUALIFIER_EVENT`
   - **Expected**:
     - Qualification Required: `false` (auto-unchecked)

3. **Test 8c - INTERNATIONAL_VIRTUAL_EVENT Config**:
   - Create new event
   - Select Event Type: `INTERNATIONAL_VIRTUAL_EVENT`
   - **Expected**:
     - Qualification Required: checkbox available (not auto-checked)
     - Qualification Source dropdown available with all options

---

### Test 9: Event Edit UI - Manual Qualifications Tab

**Goal**: Verify manual qualifications management UI.

**Test Steps**:
1. Create an INTERNATIONAL_VIRTUAL_EVENT with `qualificationSource: 'MANUAL'`
2. Open Event Edit modal
3. **Expected**: "Manual Qualifications" tab should be visible
4. Click on "Manual Qualifications" tab
5. **Expected**: 
   - Search input for dancers
   - Empty qualified dancers list (if none added)
6. Search for a dancer by name or EODSA ID
7. **Expected**: Search results appear with "Add" button
8. Click "Add" for a dancer
9. **Expected**:
   - Dancer appears in qualified list
   - Shows "Added by [Admin Name] on [Date]"
   - "Remove" button available
10. Click "Remove"
11. **Expected**: Dancer removed from list

---

### Test 10: Event Listing - Badges Display

**Goal**: Verify event type and mode badges in event listing.

**Test Steps**:
1. Create events with different types and modes:
   - REGIONAL_EVENT + HYBRID
   - NATIONAL_EVENT + LIVE
   - QUALIFIER_EVENT + VIRTUAL
   - INTERNATIONAL_VIRTUAL_EVENT + HYBRID
2. View events list in admin dashboard
3. **Expected**: 
   - Each event shows appropriate badges:
     - Event Type badge (🏘️ Regional, 🏆 National, 🎯 Qualifier, 🌐 International)
     - Event Mode badge (🎭 Live, 🎥 Virtual, 🔀 Hybrid)
   - Badges are color-coded and visible

---

### Test 11: Audit Logging

**Goal**: Verify that all qualification actions are logged.

**Test Steps**:
1. Perform various qualification-related actions:
   - Create entry attempt (qualified)
   - Create entry attempt (blocked)
   - Add manual qualification
   - Remove manual qualification
2. Check `qualification_audit_logs` table:
   ```sql
   SELECT * FROM qualification_audit_logs 
   ORDER BY performed_at DESC 
   LIMIT 20;
   ```
3. **Expected**: 
   - `ENTRY_ATTEMPT` records for all entry attempts
   - `ENTRY_BLOCKED` records for blocked entries
   - `MANUAL_QUALIFICATION_ADDED` records
   - `MANUAL_QUALIFICATION_REMOVED` records
   - All records include: event_id, dancer_id, action_details, performed_by, performed_at

---

### Test 12: Backward Compatibility

**Goal**: Verify existing events still work after migration.

**Test Steps**:
1. Check existing events in database:
   ```sql
   SELECT id, name, event_type, event_mode, qualification_required 
   FROM events;
   ```
2. **Expected**:
   - All existing events have `event_type = 'REGIONAL_EVENT'` (or `NATIONAL_EVENT` if name contains "national")
   - All existing events have `event_mode = 'HYBRID'`
   - All existing events have `qualification_required = false` (unless auto-set for national events)
3. Attempt to create entries for existing events
4. **Expected**: Entries work normally (no breaking changes)

---

## Quick Test Checklist

Use this checklist to quickly verify all features:

- [ ] Test 1: REGIONAL_EVENT allows open entry
- [ ] Test 2: NATIONAL_EVENT requires regional qualification
- [ ] Test 3: QUALIFIER_EVENT allows open entry
- [ ] Test 4: Manual qualification system works
- [ ] Test 5: Event mode validation (LIVE/VIRTUAL/HYBRID)
- [ ] Test 6: ANY_NATIONAL_LEVEL qualification
- [ ] Test 7: CUSTOM qualification error
- [ ] Test 8: Event creation UI auto-configuration
- [ ] Test 9: Manual qualifications tab UI
- [ ] Test 10: Event listing badges
- [ ] Test 11: Audit logging
- [ ] Test 12: Backward compatibility

---

## Common Issues & Troubleshooting

### Issue: "Event type not found in database"
**Solution**: Run the migration script:
```bash
node scripts/migrate-event-types-qualifications.js
```

### Issue: "Qualification check always fails"
**Solution**: 
1. Verify scores are stored correctly in `performances` table
2. Check that `event_type` is set correctly on qualifying events
3. Verify `minimum_qualification_score` is set on the target event

### Issue: "Manual qualifications tab not showing"
**Solution**: 
1. Ensure event has `qualificationSource = 'MANUAL'`
2. Check browser console for errors
3. Verify API endpoint `/api/events/[id]/qualifications` is accessible

### Issue: "Entry blocked but should be allowed"
**Solution**:
1. Check `qualification_audit_logs` for the specific entry attempt
2. Verify dancer has qualifying performance with correct score
3. Check event's `qualification_required` and `qualification_source` values

---

## SQL Queries for Verification

### Check event configuration:
```sql
SELECT 
  id, 
  name, 
  event_type, 
  event_mode, 
  qualification_required, 
  qualification_source, 
  minimum_qualification_score 
FROM events 
WHERE id = 'YOUR_EVENT_ID';
```

### Check dancer's qualifying performances:
```sql
SELECT 
  p.id,
  p.score,
  e.name as event_name,
  e.event_type
FROM performances p
JOIN event_entries ee ON p.entry_id = ee.id
JOIN events e ON ee.event_id = e.id
WHERE ee.participant_ids @> '["DANCER_ID"]'::jsonb
  AND e.event_type = 'REGIONAL_EVENT'
  AND p.score >= 75;
```

### Check manual qualifications:
```sql
SELECT 
  emq.*,
  d.name as dancer_name,
  d.eodsa_id
FROM event_manual_qualifications emq
JOIN dancers d ON emq.dancer_id = d.id
WHERE emq.event_id = 'YOUR_EVENT_ID';
```

### Check audit logs:
```sql
SELECT 
  action_type,
  action_details,
  performed_by,
  performed_at
FROM qualification_audit_logs
WHERE event_id = 'YOUR_EVENT_ID'
ORDER BY performed_at DESC;
```

---

## Next Steps After Testing

1. **If all tests pass**: System is ready for production! 🎉
2. **If tests fail**: 
   - Check error messages in browser console
   - Check server logs for API errors
   - Verify database schema is correct
   - Review the implementation files

3. **Performance Testing** (Optional):
   - Test with large number of entries
   - Test qualification checks with many qualifying performances
   - Test manual qualifications search with many dancers
