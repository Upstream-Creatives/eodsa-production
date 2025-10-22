# Debug Fee Update Issue

## 🔍 **TWO FIXES APPLIED**

### **Fix 1: Frontend - Admin Form Initialization**
**File:** `app/admin/page.tsx` (Line 535-543)

**Problem:**
```typescript
// BEFORE (BROKEN)
registrationFeePerDancer: event.registrationFeePerDancer || 300,
solo1Fee: event.solo1Fee || 400,
```

When the database has `0` for a fee, `0 || 400` evaluates to `400`, so the form shows the default instead of the actual value!

**Fix:**
```typescript
// AFTER (FIXED)
registrationFeePerDancer: event.registrationFeePerDancer ?? 300,
solo1Fee: event.solo1Fee ?? 400,
```

Using `??` (nullish coalescing) only uses the default if the value is `null` or `undefined`, not `0`.

---

### **Fix 2: Backend - API Update Logic**
**File:** `app/api/events/[id]/route.ts` (Line 136-158)

**Problem:**
```typescript
// BEFORE (BROKEN)
solo_1_fee = COALESCE(${updates.solo_1_fee || null}, solo_1_fee)
```

When updating with `0`, the expression `0 || null` evaluates to `null`, so the old value is kept!

**Fix:**
```typescript
// AFTER (FIXED)
solo_1_fee = COALESCE(${updates.solo_1_fee !== undefined ? updates.solo_1_fee : null}, solo_1_fee)
```

Now `0` values are properly sent to the database.

---

## 🐛 **HOW TO DEBUG**

### **Step 1: Check Browser Console**
Open Admin Dashboard → Edit Event → Open Browser Console (F12)

When you click "Update Event", you should see:
```
📤 Sending event update: {
  name: "Event Name",
  registrationFeePerDancer: 10,
  solo1Fee: 31.5,
  solo2Fee: 54,
  ...
}
```

✅ **Good:** All fee values are present
❌ **Bad:** Fee values are missing or showing defaults instead of entered values

---

### **Step 2: Check Server Console**
Look at the terminal where `npm run dev` is running.

You should see:
```
📝 Update data received: {
  name: "Event Name",
  registrationFeePerDancer: 10,
  solo1Fee: 31.5,
  ...
}

🔄 Converted to DB fields: {
  name: "Event Name",
  registration_fee_per_dancer: 10,
  solo_1_fee: 31.5,
  ...
}

✅ Event updated: Event Name (ID: event-123)
```

✅ **Good:** Values match what was sent from frontend
❌ **Bad:** Values are different or missing

---

### **Step 3: Check Database**
After updating, query the database:

```sql
SELECT 
  id,
  name,
  currency,
  registration_fee_per_dancer,
  solo_1_fee,
  solo_2_fee,
  solo_3_fee,
  solo_additional_fee,
  duo_trio_fee_per_dancer,
  group_fee_per_dancer,
  large_group_fee_per_dancer
FROM events
WHERE name = 'Your Event Name';
```

✅ **Good:** Values match what you entered in the form
❌ **Bad:** Values are null, wrong, or show old values

---

## 🧪 **TEST SCENARIOS**

### **Test 1: Update USD Event**
1. Create event with USD currency
2. Set: Registration = $10, Solo 1 = $31.50, Duo = $18
3. Click Update
4. Refresh page
5. Click Edit again
6. **Verify:** All fees show the values you entered

### **Test 2: Update to Zero**
1. Edit any event
2. Set all fees to 0 (for a free event)
3. Click Update
4. Refresh page
5. Click Edit again
6. **Verify:** All fees show 0, not the defaults

### **Test 3: Mix of Zero and Non-Zero**
1. Edit event
2. Set: Registration = 0, Solo 1 = 100, Solo 2 = 0
3. Click Update
4. Refresh page
5. Click Edit again
6. **Verify:** Shows exactly 0, 100, 0

---

## 🔧 **WHAT WAS CHANGED**

### **Frontend Changes (app/admin/page.tsx)**
- Line 535-543: Changed `||` to `??` for fee initialization
- Line 571: Added console.log to show what's being sent

### **Backend Changes (app/api/events/[id]/route.ts)**
- Line 131-132: Added console.log for debugging
- Line 136-158: Changed `|| null` to `!== undefined ? value : null`

---

## ✅ **EXPECTED BEHAVIOR NOW**

1. **Opening Edit Modal:** Shows actual values from database (including 0)
2. **Sending Update:** All fee values are sent to API
3. **Database Update:** All fees are saved correctly
4. **Reload:** Saved values persist and display correctly

---

## 📞 **IF STILL NOT WORKING**

1. Check browser console for the `📤 Sending event update` log
2. Check server console for the `📝 Update data received` log
3. Check if the values match at each step
4. Share the console output to identify where the values are getting lost

