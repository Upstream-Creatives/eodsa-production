# Event Participation Mode Feature

## Feature Overview

Added the ability to restrict events to specific entry types (live-only, virtual-only, or hybrid).

## Problem Solved

Previously, all events allowed both live and virtual entries. There was no way to create an event that only accepted one type. This feature adds that capability.

## Implementation

### 1. Database Schema Changes

**File**: `lib/database.ts` (line 75)

Added new column to `events` table:
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS participation_mode TEXT DEFAULT 'hybrid' 
CHECK (participation_mode IN ('live', 'virtual', 'hybrid'))
```

**Default**: `hybrid` (allows both live and virtual entries for backward compatibility)

### 2. Type Definitions

**File**: `lib/types.ts` (lines 91-92)

Added `participationMode` field to Event interface:
```typescript
export interface Event {
  // ... existing fields ...
  participationMode?: 'live' | 'virtual' | 'hybrid';
}
```

**Values**:
- `live`: Only live in-person performances allowed
- `virtual`: Only virtual video submissions allowed  
- `hybrid`: Both types allowed (default)

### 3. Database Functions

**File**: `lib/database.ts` (line 2113)

Updated `getEventById` to include participation mode:
```typescript
return {
  // ... existing fields ...
  participationMode: row.participation_mode || 'hybrid'
} as Event;
```

### 4. API Validation

**File**: `app/api/event-entries/route.ts` (lines 148-164)

Added server-side validation to enforce participation mode:
```typescript
const entryType = body.entryType || 'live';
const participationMode = event.participationMode || 'hybrid';

if (participationMode === 'live' && entryType === 'virtual') {
  return NextResponse.json(
    { error: 'This event only accepts live entries. Virtual entries are not allowed.' },
    { status: 400 }
  );
}

if (participationMode === 'virtual' && entryType === 'live') {
  return NextResponse.json(
    { error: 'This event only accepts virtual entries. Live entries are not allowed.' },
    { status: 400 }
  );
}
```

### 5. UI Changes

**File**: `app/event-dashboard/[region]/competition/page.tsx` (lines 1651-1710)

Updated the entry type selection UI to:
- **Disable** live button if event is virtual-only
- **Disable** virtual button if event is live-only
- Show visual feedback (opacity, cursor, colors)
- Display informational message explaining the restriction

**UI Features**:
```typescript
// Live button
<button
  disabled={event?.participationMode === 'virtual'}
  className={event?.participationMode === 'virtual' 
    ? 'opacity-50 cursor-not-allowed' 
    : 'hover:scale-[1.02]'
  }
>
  {event?.participationMode === 'virtual' 
    ? 'Not available for this event' 
    : 'Upload music file for in-person performance'
  }
</button>

// Virtual button  
<button
  disabled={event?.participationMode === 'live'}
  className={event?.participationMode === 'live' 
    ? 'opacity-50 cursor-not-allowed' 
    : 'hover:scale-[1.02]'
  }
>
  {event?.participationMode === 'live' 
    ? 'Not available for this event' 
    : 'Submit video URL (YouTube/Vimeo)'
  }
</button>
```

**Info Messages**:
- Virtual-only events show blue info box: "This event only accepts video submissions"
- Live-only events show purple info box: "This event only accepts live in-person performances"

## Usage

### For Admins Creating Events

When creating an event (future enhancement), admins can set:
- `participationMode: 'live'` - For traditional in-person competitions
- `participationMode: 'virtual'` - For online-only competitions
- `participationMode: 'hybrid'` - For events accepting both (default)

### For Dancers/Studios

1. Navigate to competition entry page
2. Select an event
3. Entry type buttons will automatically:
   - Show only available options
   - Disable unavailable options
   - Display helpful messages

## Backward Compatibility

✅ **Fully backward compatible**

- All existing events default to `hybrid` mode
- No changes required to existing data
- Existing functionality unchanged

## Validation Layers

**Three layers of protection**:

1. **UI Layer**: Buttons are disabled and show visual feedback
2. **API Layer**: Server validates entry type against event participation mode
3. **Database Layer**: Column constraint ensures only valid values

## Benefits

### For Event Organizers
- ✅ Control entry types per event
- ✅ Clearly communicate event format
- ✅ Prevent invalid entries

### For Participants  
- ✅ Clear guidance on what's allowed
- ✅ Prevent wasted time on invalid entries
- ✅ Better user experience

### Technical
- ✅ Database-level validation
- ✅ Type-safe implementation
- ✅ Backward compatible
- ✅ Clean UI/UX

## Testing Recommendations

1. **Create virtual-only event** → Verify live button is disabled
2. **Create live-only event** → Verify virtual button is disabled
3. **Create hybrid event** → Verify both buttons work
4. **Try API bypass** → Verify server rejects invalid entry types
5. **Check existing events** → Verify they still work as hybrid

## Future Enhancements

### Admin UI (TODO: Task ID 2)
Update event creation form to include participation mode selector:
```typescript
<select name="participationMode">
  <option value="hybrid">Hybrid (Live + Virtual)</option>
  <option value="live">Live Only</option>
  <option value="virtual">Virtual Only</option>
</select>
```

This can be added to:
- `/app/api/events/route.ts` (POST handler)
- Admin event creation page
- Admin event edit page

---

**Date**: October 25, 2025
**Status**: ✅ Complete (except admin UI for setting participation mode)
**Files Modified**:
- `lib/types.ts` (lines 91-92)
- `lib/database.ts` (lines 75, 2113)
- `app/api/event-entries/route.ts` (lines 148-164)
- `app/event-dashboard/[region]/competition/page.tsx` (lines 1651-1710)

**Database Migration**: Auto-applies on next server start (line 75 in database.ts)





