# Fee Calculation Logic - Complete Explanation

## Overview
The fee calculation system uses **cumulative package pricing** for solo entries, where the total cost is based on the number of solos, and subsequent solos are charged incrementally.

## Key Concepts

### 1. Registration Fee (R175)
- **Charged ONCE per event per dancer** (not per entry)
- Tracked by "assignment" not "payment" - if dancer has ANY entry (paid or unpaid) in the event, registration is waived
- Checked by looking for entries where:
  - `eodsa_id` matches dancer's EODSA ID
  - `contestant_id` matches dancer's internal ID
  - `participant_ids` JSON array contains dancer's ID or EODSA ID

### 2. Solo Package Pricing (Cumulative)
Package totals are **cumulative**, not individual:
- **1 Solo Package**: R550 (total for 1 solo)
- **2 Solos Package**: R942 (total for 2 solos)
- **3 Solos Package**: R1,256 (total for 3 solos)
- **4+ Solos**: R1,256 + (number - 3) × R349

### 3. Incremental Charging
When a dancer adds a new solo, they pay the **difference** between:
- New package total (for all solos they'll have)
- Previous package total (for solos they already have)

## Step-by-Step Logic Flow

### For Solo Entries:

#### Step 1: Get Dancer Information
```typescript
participantId = "1753770347873lwb2fg"  // Internal dancer ID from frontend
```

#### Step 2: Get EODSA ID
```sql
SELECT eodsa_id FROM dancers WHERE id = participantId
-- Result: "E739820"
```

#### Step 3: Collect All Possible IDs
```typescript
allDancerIds = [
  "1753770347873lwb2fg",  // Internal ID
  "E739820"                // EODSA ID
]
// Also check for any other internal IDs with same EODSA ID
```

#### Step 4: Find Existing Solo Entries
```sql
SELECT * FROM event_entries
WHERE event_id = eventId
AND performance_type = 'Solo'
```

Then filter client-side by checking if entry matches dancer:
- `entry.eodsa_id === dancerEodsaId` OR
- `entry.contestant_id` in `allDancerIds` OR
- `entry.participant_ids` array contains any ID from `allDancerIds`

**Result**: `existingSoloCount = 2` (for Ruben Kruger)

#### Step 5: Calculate Package Totals

**Previous Package Total** (for existing solos):
```typescript
if (existingSoloCount === 0) previousPackageTotal = 0
if (existingSoloCount === 1) previousPackageTotal = 550
if (existingSoloCount === 2) previousPackageTotal = 942  // ← Ruben has 2
if (existingSoloCount === 3) previousPackageTotal = 1256
```

**New Package Total** (for new total count):
```typescript
newTotalSoloCount = existingSoloCount + 1  // 2 + 1 = 3
if (newTotalSoloCount === 1) newPackageTotal = 550
if (newTotalSoloCount === 2) newPackageTotal = 942
if (newTotalSoloCount === 3) newPackageTotal = 1256  // ← New total
```

#### Step 6: Calculate Performance Fee
```typescript
performanceFee = newPackageTotal - previousPackageTotal
                = 1256 - 942
                = 314  // ← What Ruben should pay for 3rd solo
```

#### Step 7: Check Registration Fee
```typescript
if (dancer has ANY entry in event) {
  registrationFee = 0  // Already assigned
} else {
  registrationFee = 175  // First entry
}
```

#### Step 8: Calculate Total
```typescript
totalFee = performanceFee + registrationFee
         = 314 + 0
         = 314
```

## Example Scenarios

### Scenario 1: First Solo
- Existing solos: 0
- Previous package: R0
- New package (1 solo): R550
- Performance fee: R550 - R0 = **R550**
- Registration: R175 (first entry)
- **Total: R725**

### Scenario 2: Second Solo (Ruben's Case)
- Existing solos: 1
- Previous package: R550
- New package (2 solos): R942
- Performance fee: R942 - R550 = **R392**
- Registration: R0 (already assigned)
- **Total: R392**

### Scenario 3: Third Solo
- Existing solos: 2
- Previous package: R942
- New package (3 solos): R1,256
- Performance fee: R1,256 - R942 = **R314**
- Registration: R0 (already assigned)
- **Total: R314**

## Current Issue

The system is showing:
- `existingSoloCount = 0` (should be 2)
- `previousPackageTotal = 0` (should be R942)
- `performanceFee = 550` (should be R314)

**Root Cause**: The query to find existing entries is not matching correctly. The matching logic checks:
1. `eodsa_id` field
2. `contestant_id` field  
3. `participant_ids` JSON array

But entries might be stored with different ID formats, causing the match to fail.

## Debugging

The system now logs:
- All solo entries in the event
- What IDs we're searching for
- Why each entry matches or doesn't match
- Detailed breakdown of matching logic

Check server logs to see:
```
🔍 Searching for existing solos with IDs: 1753770347873lwb2fg, E739820
🔍 Found X total solo entries in event
📋 All solo entries in event:
   Entry 1: eodsa_id=..., contestant_id=..., participant_ids=...
   - ✅ Matched entry... OR ❌ No match for entry...
```

This will show why entries aren't being found.

