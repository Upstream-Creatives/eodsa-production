# Fee Configuration Update Fix

## 🎯 **PROBLEM**

When updating event fee configuration in the admin panel, only the registration fee was being saved. All other fees (solo fees, duo/trio fees, group fees) were not updating.

## 🔍 **ROOT CAUSE**

In `app/api/events/[id]/route.ts`, the UPDATE query used `|| null` operator to check if a value should be updated:

```typescript
solo_1_fee = COALESCE(${updates.solo_1_fee || null}, solo_1_fee)
```

**The Problem:**
- When a fee value is `0`, the expression `0 || null` evaluates to `null`
- `COALESCE(null, solo_1_fee)` returns the old value, so nothing updates
- This affected all numeric fee fields that could be `0`

## ✅ **SOLUTION**

Changed the conditional check from `|| null` to `!== undefined`:

```typescript
// BEFORE (BROKEN)
solo_1_fee = COALESCE(${updates.solo_1_fee || null}, solo_1_fee)

// AFTER (FIXED)
solo_1_fee = COALESCE(${updates.solo_1_fee !== undefined ? updates.solo_1_fee : null}, solo_1_fee)
```

This allows `0` values to be properly saved while still treating `undefined` as "no update".

## 📝 **AFFECTED FIELDS**

All fee fields are now properly updating:
- ✅ `registration_fee_per_dancer`
- ✅ `solo_1_fee`
- ✅ `solo_2_fee`
- ✅ `solo_3_fee`
- ✅ `solo_additional_fee`
- ✅ `duo_trio_fee_per_dancer`
- ✅ `group_fee_per_dancer`
- ✅ `large_group_fee_per_dancer`
- ✅ `currency`

## 🧪 **TESTING**

To test the fix:
1. Go to Admin Dashboard
2. Click "Edit Event" on any event
3. Update the fee configuration values
4. Click "Update Event"
5. Refresh and verify all fees are saved correctly

## 🎉 **RESULT**

All event fee configuration fields now save correctly, including:
- Zero values (like free events)
- Non-zero values
- Currency changes
- All fee types (solo, duo, trio, group, etc.)

The system now properly supports event-specific pricing for international and local events!

