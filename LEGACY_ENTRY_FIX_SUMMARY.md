# Legacy Entry Studio Fix - Complete Solution

## 🎯 **PROBLEM IDENTIFIED**

Items showing as **"Studio: Legacy Entry"** with **"Unknown Dancer"** participants, even though all dancers are registered and linked to **MOVE Dance Company (S209357)**.

### **Affected Items:**
- Item #44 - Triple scoop (Trio) - MOVE Dance Company
- Item #29 - Cheer squad (Trio) - MOVE Dance Company  
- Item #63 - Me too (Duet) - MOVE Dance Company
- Item #101 - MVMNT Crew (Group) - MOVE Dance Company

## 🔍 **ROOT CAUSE**

The code in `app/api/events/[id]/entries/route.ts` was:
1. Looking up `contestant_id` (old contestant system)
2. Finding legacy contestant record with **NO studio information**
3. Defaulting to **"Legacy Entry"** and **"Unknown Dancer"**
4. **NEVER checking** the actual participant IDs for their studio associations

### **The Issue:**
```typescript
// OLD CODE (BROKEN)
const contestant = await db.getContestantById(entry.contestantId);
if (contestant) {
  return {
    studioName: 'Legacy Entry',  // ❌ Always "Legacy Entry"
    studioId: null,
    participantNames: entry.participantIds.map(() => 'Unknown Dancer')  // ❌ Never looked up
  };
}
```

## ✅ **SOLUTION IMPLEMENTED**

Updated `app/api/events/[id]/entries/route.ts` (Lines 126-188) to:
1. Look up **each participant** by their ID in the `dancers` table
2. Join with `studio_applications` table (status = 'accepted')
3. Get the studio information from there
4. Display the **correct studio name and dancer names**

### **The Fix:**
```typescript
// NEW CODE (FIXED)
const participantDetails = await Promise.all(
  entry.participantIds.map(async (participantId) => {
    // Look up dancer with studio info via studio_applications
    const dancerRows = await sqlClient`
      SELECT 
        d.name,
        s.id as studio_id,
        s.name as studio_name,
        s.email as studio_email
      FROM dancers d
      LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
      LEFT JOIN studios s ON sa.studio_id = s.id
      WHERE d.id = ${participantId}
    `;
    
    return {
      name: dancerRows[0].name,  // ✅ Actual dancer name
      studioName: dancerRows[0].studio_name,  // ✅ Actual studio name
      ...
    };
  })
);

// Get studio from first participant
const studioInfo = participantDetails.find(p => p.studioName);

return {
  studioName: studioInfo?.studioName || 'Independent',  // ✅ Shows correct studio
  participantNames: participantDetails.map(p => p.name),  // ✅ Shows actual names
  ...
};
```

## 📊 **HOW IT WORKS**

### **Database Relationship:**
```
event_entries
  └─> participant_ids (array)
       └─> dancers table (by dancer.id)
            └─> studio_applications (where status='accepted')
                 └─> studios table
                      └─> studio name!
```

### **Key Insight:**
- Dancers are NOT directly linked to studios
- The link is through the `studio_applications` table
- Only applications with `status = 'accepted'` count
- This is the **proper way** to get studio information

## 🧪 **VERIFIED RESULTS**

All affected items now correctly show:
- ✅ **Studio:** MOVE Dance Company
- ✅ **Participants:** Actual dancer names (Katia Do Amaral, Katia Gouveia, Gianna Silva-Ferreira, Lianey Kotze)
- ✅ **Studio Reg:** S209357

## 🎉 **RESULT**

**"Legacy Entry" is now fixed!** The system correctly:
1. Looks up participants by their IDs
2. Finds their studio via `studio_applications` table
3. Displays the correct studio name
4. Shows actual dancer names instead of "Unknown Dancer"

## 📝 **FILES MODIFIED**

- **`app/api/events/[id]/entries/route.ts`** (Lines 126-188)
  - Added participant lookup with studio_applications join
  - Changed from "Legacy Entry" to actual studio name
  - Changed from "Unknown Dancer" to actual dancer names

## 💡 **KEY TAKEAWAY**

The system has TWO ways to link dancers to studios:
1. **New System:** via `studio_applications` table ✅ (what we use now)
2. **Old System:** legacy contestants ❌ (no studio info)

Always look up participants through `studio_applications` to get correct studio information!

