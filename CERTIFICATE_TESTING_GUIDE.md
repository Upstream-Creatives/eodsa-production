# Certificate Generation & Email Testing Guide

## Overview
This guide explains how to test the automatic certificate generation and email notification system that triggers when scores are published.

---

## 🎯 Testing Flow

### Step 1: Prepare a Performance with Scores

1. **Ensure you have a performance with scores:**
   - Navigate to an event that has performances
   - Make sure at least one performance has been scored by all assigned judges
   - The performance should have:
     - ✅ Approved and paid entry
     - ✅ Scores from all assigned judges
     - ✅ Not yet published

2. **Check if performance has scores:**
   ```sql
   SELECT p.id, p.title, p.scores_published, 
          COUNT(s.id) as score_count
   FROM performances p
   LEFT JOIN scores s ON s.performance_id = p.id
   WHERE p.id = 'YOUR_PERFORMANCE_ID'
   GROUP BY p.id;
   ```

---

## 🧪 Test Method 1: Full End-to-End Test (Recommended)

### A. Publish Scores via Admin Dashboard

1. **Login as Admin:**
   - Go to: `http://localhost:3000/portal/admin`
   - Login with admin credentials

2. **Navigate to Score Approval:**
   - Go to: `http://localhost:3000/admin/scoring-approval`
   - You should see performances that have been scored by all judges

3. **Publish Scores:**
   - Find a performance that shows "✅ Publish Scores" button
   - Click the button
   - Wait for success message: "Scores for '[Performance Title]' published successfully"

4. **What Happens Automatically:**
   - ✅ Certificate is generated automatically
   - ✅ Certificate is saved to database
   - ✅ Email sent to dancer (if email exists)
   - ✅ Email sent to studio (if email exists)

### B. Verify Certificate Generation

1. **Check Certificate in Database:**
   ```sql
   SELECT * FROM certificates 
   WHERE performance_id = 'YOUR_PERFORMANCE_ID';
   ```

2. **View Certificate:**
   - Go to: `http://localhost:3000/certificates/YOUR_PERFORMANCE_ID`
   - Should display the certificate with:
     - ✅ Custom template (if event has one)
     - ✅ Dancer name (or studio name for groups)
     - ✅ Percentage score
     - ✅ Style, Title, Medallion
     - ✅ Event date

3. **Check Server Logs:**
   - Look for: `✅ Certificate generated automatically for performance [ID]`
   - Check for any errors in the console

### C. Verify Email Notifications

1. **Check Email Service Logs:**
   - Look in server console for email sending attempts
   - Check for: `Email sent successfully` or error messages

2. **Verify Email Recipients:**
   ```sql
   SELECT 
     d.email as dancer_email,
     d.name as dancer_name,
     c.email as studio_email,
     c.studio_name
   FROM event_entries ee
   LEFT JOIN dancers d ON ee.eodsa_id = d.eodsa_id
   LEFT JOIN contestants c ON ee.contestant_id = c.id
   WHERE ee.id = 'YOUR_EVENT_ENTRY_ID';
   ```

3. **Test Email API Directly:**
   ```bash
   curl -X POST http://localhost:3000/api/certificates/notify \
     -H "Content-Type: application/json" \
     -d '{
       "performanceId": "YOUR_PERFORMANCE_ID",
       "eventEntryId": "YOUR_EVENT_ENTRY_ID",
       "certificateUrl": "http://localhost:3000/certificates/YOUR_PERFORMANCE_ID",
       "dancerName": "Test Dancer",
       "performanceTitle": "Test Performance",
       "percentage": 92,
       "medallion": "Gold"
     }'
   ```

---

## 🧪 Test Method 2: Direct Certificate Generation Test

### A. Test Certificate Generation API

1. **Generate Certificate Directly:**
   ```bash
   curl -X POST http://localhost:3000/api/certificates/generate \
     -H "Content-Type: application/json" \
     -d '{
       "performanceId": "YOUR_PERFORMANCE_ID",
       "dancerId": "YOUR_DANCER_ID",
       "dancerName": "Test Dancer",
       "eventId": "YOUR_EVENT_ID",
       "eventEntryId": "YOUR_EVENT_ENTRY_ID",
       "percentage": 92,
       "style": "Contemporary",
       "title": "Rising Phoenix",
       "medallion": "Gold",
       "eventDate": "2025-01-15",
       "createdBy": "admin-user-id"
     }'
   ```

2. **Check Response:**
   - Should return: `{ "success": true, "certificateId": "..." }`

### B. Test Certificate Image Generation

1. **View Certificate Image:**
   - Go to: `http://localhost:3000/api/certificates/YOUR_PERFORMANCE_ID/image`
   - Should return the certificate image (PNG/JPEG)

2. **Test with Custom Template:**
   - Make sure the event has a custom template uploaded
   - The certificate should use the custom template as background

---

## 🧪 Test Method 3: Certificate Test Page

### A. Use the Test Page

1. **Navigate to Test Page:**
   - Go to: `http://localhost:3000/certificates/test`

2. **Select Event:**
   - Choose an event from the dropdown
   - If the event has a custom template, it will be used

3. **Fill Test Data:**
   - Dancer Name: "Test Dancer"
   - Percentage: 92
   - Style: "Contemporary"
   - Title: "Rising Phoenix" (max 26 chars)
   - Medallion: "Gold"
   - Date: Select a date

4. **Generate Test Certificate:**
   - Click "Generate Test Certificate"
   - Should display the certificate preview

5. **Verify:**
   - ✅ Template is correct (custom or default)
   - ✅ Text alignment is correct
   - ✅ No "%" symbol on percentage
   - ✅ No descriptive prefixes (STYLE:, TITLE:, etc.)
   - ✅ Date is aligned correctly
   - ✅ Title is truncated to 26 characters if needed

---

## 🔍 Verification Checklist

### Certificate Generation
- [ ] Certificate is created in database
- [ ] Certificate image is generated correctly
- [ ] Custom template is used (if event has one)
- [ ] Default template is used (if no custom template)
- [ ] All text fields are correctly positioned
- [ ] Title is truncated to 26 characters max
- [ ] Percentage shows without "%" symbol
- [ ] Date uses event start date

### Email Notifications
- [ ] Email API route is called (`/api/certificates/notify`)
- [ ] Dancer email is sent (if dancer has email)
- [ ] Studio email is sent (if studio has email)
- [ ] Email contains correct certificate URL
- [ ] Email contains correct performance details

### Error Handling
- [ ] Certificate generation doesn't block score publishing
- [ ] Errors are logged but don't fail the publish operation
- [ ] Missing emails don't cause failures
- [ ] Missing template falls back to default

---

## 🐛 Troubleshooting

### Issue: Certificate Not Generated

**Check:**
1. Does the performance have scores?
   ```sql
   SELECT COUNT(*) FROM scores WHERE performance_id = 'YOUR_PERFORMANCE_ID';
   ```

2. Are scores published?
   ```sql
   SELECT scores_published FROM performances WHERE id = 'YOUR_PERFORMANCE_ID';
   ```

3. Check server logs for errors

4. Verify `publishPerformanceScores()` is being called

### Issue: Email Not Sent

**Check:**
1. Does the dancer have an email?
   ```sql
   SELECT email FROM dancers WHERE eodsa_id = 'YOUR_EODSA_ID';
   ```

2. Does the studio have an email?
   ```sql
   SELECT email FROM contestants WHERE id = 'YOUR_CONTESTANT_ID';
   ```

3. Check email service configuration in `lib/email.ts`
4. Verify SMTP settings in environment variables

### Issue: Wrong Template Used

**Check:**
1. Does the event have a custom template?
   ```sql
   SELECT certificate_template_url FROM events WHERE id = 'YOUR_EVENT_ID';
   ```

2. Is the template URL valid?
3. Check Cloudinary configuration

### Issue: Text Alignment Issues

**Check:**
1. Verify text positioning in:
   - `app/api/certificates/generate/route.ts`
   - `app/api/certificates/test/image/route.ts`
   - `app/api/certificates/[performanceId]/image/route.ts`

2. Test with the test page to see alignment
3. Compare with original template design

---

## 📝 Quick Test Commands

### Test Certificate Generation API
```bash
# Replace with actual IDs
PERFORMANCE_ID="1763303467018"
EVENT_ID="your-event-id"
DANCER_ID="your-dancer-id"
EVENT_ENTRY_ID="your-entry-id"

curl -X POST http://localhost:3000/api/certificates/generate \
  -H "Content-Type: application/json" \
  -d "{
    \"performanceId\": \"$PERFORMANCE_ID\",
    \"dancerId\": \"$DANCER_ID\",
    \"dancerName\": \"Test Dancer\",
    \"eventId\": \"$EVENT_ID\",
    \"eventEntryId\": \"$EVENT_ENTRY_ID\",
    \"percentage\": 92,
    \"style\": \"Contemporary\",
    \"title\": \"Rising Phoenix\",
    \"medallion\": \"Gold\",
    \"eventDate\": \"2025-01-15\",
    \"createdBy\": \"test-admin\"
  }"
```

### Test Email Notification API
```bash
curl -X POST http://localhost:3000/api/certificates/notify \
  -H "Content-Type: application/json" \
  -d "{
    \"performanceId\": \"$PERFORMANCE_ID\",
    \"eventEntryId\": \"$EVENT_ENTRY_ID\",
    \"certificateUrl\": \"http://localhost:3000/certificates/$PERFORMANCE_ID\",
    \"dancerName\": \"Test Dancer\",
    \"performanceTitle\": \"Rising Phoenix\",
    \"percentage\": 92,
    \"medallion\": \"Gold\"
  }"
```

### View Certificate
```bash
# Open in browser
open http://localhost:3000/certificates/$PERFORMANCE_ID

# Or view image directly
open http://localhost:3000/api/certificates/$PERFORMANCE_ID/image
```

---

## ✅ Expected Results

### After Publishing Scores:
1. ✅ Success message: "Scores for '[Title]' published successfully"
2. ✅ Certificate record created in database
3. ✅ Certificate accessible at `/certificates/[performanceId]`
4. ✅ Email sent to dancer (if email exists)
5. ✅ Email sent to studio (if email exists)
6. ✅ Server logs show: "✅ Certificate generated automatically for performance [ID]"

### Certificate Display:
- ✅ Correct template (custom or default)
- ✅ Dancer name or studio name (for groups)
- ✅ Percentage without "%"
- ✅ Style, Title, Medallion aligned on template lines
- ✅ Date aligned correctly
- ✅ Title truncated to 26 characters if needed

---

## 🎬 Next Steps After Testing

1. **Verify in Production:**
   - Test with real event data
   - Verify email delivery
   - Check certificate quality

2. **Monitor:**
   - Check server logs for errors
   - Monitor email delivery rates
   - Track certificate generation success rate

3. **Optimize:**
   - Adjust text positioning if needed
   - Update email templates if needed
   - Fine-tune character limits if needed

