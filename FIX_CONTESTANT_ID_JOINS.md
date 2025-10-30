# Fix: Change contestant_id JOINs to LEFT JOIN

## Problem

`contestant_id` in performances table references contestants that may not exist:
- Foreign key constraint was already removed
- But queries use INNER JOIN with contestants table
- If contestant doesn't exist → performance is invisible

## Solution

Change all INNER JOINs to LEFT JOINs in `lib/database.ts`

### Changes Needed

**Line 835-839** - `getAllPerformances()`:
```typescript
// BEFORE
SELECT p.*, c.name as contestant_name 
FROM performances p 
JOIN contestants c ON p.contestant_id = c.id

// AFTER
SELECT p.*, c.name as contestant_name 
FROM performances p 
LEFT JOIN contestants c ON p.contestant_id = c.id
```

**Line 866-870** - `getPerformanceById()`:
```typescript
// BEFORE
SELECT p.*, c.name as contestant_name 
FROM performances p 
JOIN contestants c ON p.contestant_id = c.id 
WHERE p.id = ${performanceId}

// AFTER
SELECT p.*, c.name as contestant_name 
FROM performances p 
LEFT JOIN contestants c ON p.contestant_id = c.id 
WHERE p.id = ${performanceId}
```

**Lines 1176, 1222, 1262, 1296, 1330, 1373** - All rankings queries:
```typescript
// BEFORE
JOIN contestants c ON p.contestant_id = c.id

// AFTER
LEFT JOIN contestants c ON p.contestant_id = c.id
```

**Line 2291** - `getPerformancesByEvent()`:
```typescript
// Already correct! Already uses LEFT JOIN ✅
LEFT JOIN contestants c ON p.contestant_id = c.id
```

### Result

- ✅ Performances visible even if contestant doesn't exist
- ✅ Shows contestant name when available
- ✅ Falls back to participant_names when not
- ✅ No data loss or hidden performances

### Alternative: Remove contestant_name Entirely

Since `participant_names` already exists in performances:
- Use `participant_names[0]` or `participant_names.join(', ')`
- Remove all contestant JOINs
- Simpler and more reliable

**Recommendation**: Use this approach for new code.

