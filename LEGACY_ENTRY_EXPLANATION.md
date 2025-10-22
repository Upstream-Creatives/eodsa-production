# Legacy Entry Studio Issue - Explanation & Solution

## 🔍 **WHAT IS "LEGACY ENTRY"?**

"Legacy Entry" appears when the system cannot find studio information for a dancer's competition entry. This happens because the system has TWO different registration systems:

### **Two Systems:**

1. **OLD System (Legacy "Contestant" System)**
   - Used before the unified dancer/studio system
   - Entries stored with `contestant_id` referencing the `contestants` table
   - **NO studio association** stored with the entry
   - When displayed, shows as **"Legacy Entry"**

2. **NEW System (Unified Dancer/Studio System)**
   - Current system with proper dancer and studio management
   - Dancers are linked to studios via `studio_id`
   - Studio information properly displayed

## 📍 **WHERE "LEGACY ENTRY" IS SET**

### **File: `app/api/events/[id]/entries/route.ts` (Lines 138-143)**

```typescript
// Try legacy contestant system
const contestant = await db.getContestantById(entry.contestantId);
if (contestant) {
  console.log(`Found legacy contestant: ${contestant.name} (${contestant.eodsaId})`);
  return {
    ...entry,
    contestantName: contestant.name,
    contestantEmail: contestant.email || '',
    participantNames: entry.participantIds.map(id => {
      const dancer = contestant.dancers.find(d => d.id === id);
      return dancer?.name || 'Unknown Dancer';
    }),
    // Legacy system - studio info may not be available
    studioName: 'Legacy Entry',  // ← SET HERE
    studioId: null,
    studioEmail: null,
    participantStudios: entry.participantIds.map(() => 'Legacy Entry'),
    computedAgeCategory
  };
}
```

## 🔄 **HOW THE LOOKUP WORKS**

When loading event entries, the system tries (in order):

1. **Try Unified System First** (Lines 83-124)
   - Look up dancer in `dancers` table
   - Find studio association
   - Display proper studio name ✅

2. **Fallback to Legacy System** (Lines 126-144)
   - Look up contestant in `contestants` table
   - **NO studio info available**
   - Default to **"Legacy Entry"** ❌

3. **Final Fallback** (Lines 146-169)
   - Try to match by EODSA ID
   - Try to find studio by registration number

## 🛠️ **SOLUTION: MIGRATE LEGACY ENTRIES**

### **Option 1: SQL Script to Identify Legacy Entries**

I created `fix-legacy-entries.sql` with queries to:

1. **Find all legacy entries:**
```sql
SELECT 
  ee.id,
  ee.item_number,
  ee.item_name,
  ee.contestant_name,
  ee.studio_name,
  ee.eodsa_id
FROM event_entries ee
WHERE ee.studio_name = 'Legacy Entry' 
   OR ee.contestant_name = 'Legacy Entry'
ORDER BY ee.item_number;
```

2. **Check contestant-studio associations:**
```sql
SELECT 
  c.id,
  c.name,
  c.studio_name,
  c.type,
  COUNT(ee.id) as entry_count
FROM contestants c
LEFT JOIN event_entries ee ON ee.contestant_id = c.id
WHERE c.studio_name IS NOT NULL 
GROUP BY c.id, c.name, c.studio_name, c.type
ORDER BY entry_count DESC;
```

3. **Update entries with proper studio names:**
```sql
UPDATE event_entries 
SET studio_name = c.studio_name,
    contestant_name = c.name
FROM contestants c
WHERE event_entries.contestant_id = c.id
  AND event_entries.studio_name = 'Legacy Entry'
  AND c.studio_name IS NOT NULL;
```

### **Option 2: Migrate Legacy Contestants to Unified System**

To fully fix this, you would need to:

1. **Create studios** in the `studios` table for legacy contestants
2. **Create dancers** in the `dancers` table linked to studios
3. **Update event_entries** to reference the new dancer IDs
4. **Preserve old contestant data** for historical records

## 📊 **TO FIX YOUR CURRENT ISSUE**

### **Step 1: Identify Legacy Entries**
Run the SQL query to find all entries showing as "Legacy Entry":
```sql
SELECT 
  ee.id,
  ee.item_number,
  ee.item_name,
  ee.contestant_name,
  ee.eodsa_id,
  c.name as actual_name,
  c.studio_name as actual_studio
FROM event_entries ee
LEFT JOIN contestants c ON ee.contestant_id = c.id
WHERE ee.studio_name = 'Legacy Entry';
```

### **Step 2: Check if Contestants Have Studio Info**
```sql
SELECT * FROM contestants 
WHERE id IN (
  SELECT contestant_id FROM event_entries 
  WHERE studio_name = 'Legacy Entry'
);
```

### **Step 3: Update Event Entries**
If the contestants table has studio information:
```sql
UPDATE event_entries 
SET studio_name = c.studio_name,
    contestant_name = c.name
FROM contestants c
WHERE event_entries.contestant_id = c.id
  AND event_entries.studio_name = 'Legacy Entry'
  AND c.studio_name IS NOT NULL
  AND c.studio_name != '';
```

## 🎯 **QUICK FIX FOR SPECIFIC ENTRIES**

If you know the studio name for specific entries, you can manually update:
```sql
-- For Item 44, 64, etc.
UPDATE event_entries 
SET studio_name = 'Actual Studio Name'
WHERE item_number = 44 -- or 64, etc.
  AND studio_name = 'Legacy Entry';
```

## ⚠️ **WHY THIS HAPPENS**

The "Legacy Entry" issue occurs because:
1. Old competition entries were created using the `contestants` system
2. The `contestants` table doesn't have proper studio associations
3. The new unified system expects dancers to be linked to studios
4. When the studio link is missing, the code defaults to "Legacy Entry"

## ✅ **LONG-TERM SOLUTION**

To prevent this in the future:
1. **Migrate all contestants** to the unified dancer/studio system
2. **Ensure all dancers are linked to studios**
3. **Use only the unified system** for new entries
4. **Keep legacy system** only for historical data display

