# 🔄 Certificate Regeneration Guide

## Problem

When scores are published, certificates are automatically generated. However, if:
- The certificate template wasn't uploaded yet when scores were published
- Certificate generation failed initially
- You need to update certificates with a new template

The certificate won't be generated or will use the default template.

## Solution: Manual Certificate Regeneration

### Method 1: Using the Scoring Approval Page (Recommended)

1. **Go to Scoring Approval Page:**
   - Navigate to: `/admin/scoring-approval`
   - Login as admin

2. **Find the Performance:**
   - Look for performances with "✅ Published" status
   - These will show a "🔄 Regenerate Cert" button

3. **Regenerate Certificate:**
   - Click "🔄 Regenerate Cert" button
   - The system will:
     - Delete the old certificate (if exists)
     - Generate a new certificate using the current event template
     - Send email notifications to dancer and studio

### Method 2: Using the API Directly

**For a specific performance:**

```bash
curl -X POST http://localhost:3000/api/certificates/regenerate \
  -H "Content-Type: application/json" \
  -d '{
    "performanceId": "YOUR_PERFORMANCE_ID",
    "forceRegenerate": true
  }'
```

**List all performances needing certificates:**

```bash
# All events
curl "http://localhost:3000/api/certificates/regenerate"

# Specific event
curl "http://localhost:3000/api/certificates/regenerate?eventId=YOUR_EVENT_ID"
```

This will show:
- Performances with published scores
- Which ones have certificates
- Which ones have templates uploaded

---

## When to Use Regeneration

✅ **Use regeneration when:**
- Template was uploaded after scores were published
- Certificate generation failed initially
- Need to update certificate with new template
- Certificate exists but uses wrong template

❌ **Don't regenerate if:**
- Scores aren't published yet (publish scores first)
- Certificate is already correct
- No template is uploaded (will use default)

---

## What Happens During Regeneration

1. **Checks:**
   - Performance exists
   - Scores are published
   - Scores exist for the performance

2. **Calculations:**
   - Recalculates average percentage
   - Determines medallion
   - Gets participant names/studio name

3. **Generation:**
   - Deletes old certificate (if `forceRegenerate: true`)
   - Generates new certificate using current event template
   - Saves to database

4. **Notifications:**
   - Sends email to dancer (if email exists)
   - Sends email to studio (if email exists)

---

## Example: Fixing Bernado's Certificate

**Scenario:** 
- Performance: "Regionals Entry" by Bernado
- Scores were published before template was uploaded
- Certificate wasn't generated or uses default template

**Solution:**

1. **Upload Template First:**
   - Go to event edit page
   - Upload the certificate template for the event

2. **Regenerate Certificate:**
   - Go to `/admin/scoring-approval`
   - Find "Regionals Entry" performance
   - Click "🔄 Regenerate Cert" button

3. **Verify:**
   - Check that certificate was generated
   - Verify it uses the correct template
   - Confirm email was sent to Bernado

---

## API Endpoints

### POST `/api/certificates/regenerate`
Regenerate certificate for a specific performance.

**Request:**
```json
{
  "performanceId": "string (required)",
  "forceRegenerate": true (optional, deletes existing certificate)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Certificate regenerated successfully",
  "certificateId": "cert_123",
  "performanceId": "perf_456",
  "dancerName": "Bernado",
  "percentage": 92,
  "medallion": "Gold"
}
```

### GET `/api/certificates/regenerate?eventId=XXX`
List all performances with published scores and their certificate status.

**Response:**
```json
{
  "success": true,
  "performances": [
    {
      "performanceId": "perf_123",
      "title": "Regionals Entry",
      "itemNumber": 5,
      "eventName": "Regional Testing",
      "contestantName": "Bernado",
      "scoreCount": 3,
      "hasCertificate": false,
      "hasTemplate": true
    }
  ],
  "summary": {
    "total": 10,
    "withCertificates": 8,
    "withoutCertificates": 2,
    "withTemplates": 9
  }
}
```

---

## Troubleshooting

### "Scores not published"
- **Fix:** Publish scores first using "✅ Publish Scores" button

### "No scores found"
- **Fix:** Ensure judges have scored the performance

### "Performance not found"
- **Fix:** Check the performance ID is correct

### Certificate still not showing
- **Fix:** 
  1. Check certificate was actually created in database
  2. Verify template URL is correct
  3. Check dancer dashboard filters

---

## Quick Checklist

Before regenerating:
- [ ] Template is uploaded to the event
- [ ] Scores are published
- [ ] Performance has scores from judges
- [ ] You have admin access

After regenerating:
- [ ] Certificate appears in database
- [ ] Certificate uses correct template
- [ ] Email notifications sent
- [ ] Dancer can see certificate in dashboard

