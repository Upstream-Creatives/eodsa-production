# 🧪 Certificate Template Testing Guide

## Quick Test Overview

This guide will help you test the event-level certificate template feature that was just implemented.

---

## 📋 Prerequisites

1. **Admin Access**: You need admin credentials to test
   - URL: `/portal/admin` or `/admin`
   - Email: `mains@elementscentral.com`
   - Password: `624355Mage55!`

2. **Test Image**: Prepare a PNG or JPG certificate template image
   - Recommended size: 904x1280 pixels (or similar aspect ratio)
   - Format: PNG or JPG only
   - File size: Keep under 10MB for faster upload

---

## 🧪 Testing Steps

### Test 1: Upload Template During Event Creation

**Goal**: Test uploading a certificate template when creating a new event.

1. **Login to Admin Dashboard**
   ```
   Navigate to: /portal/admin
   Login with admin credentials
   ```

2. **Create New Event**
   - Click **"Events"** tab
   - Click **"Create Event"** button
   - Fill in required event fields:
     - Event Name: "Test Event - Custom Template"
     - Description: "Testing certificate templates"
     - Event Date: Any future date
     - Venue: "Test Venue"
     - Registration Deadline: Any date

3. **Upload Certificate Template**
   - Scroll to **"🏆 Certificate Settings"** section
   - Click **"Choose File"** under "Upload Certificate Template (JPG/PNG)"
   - Select a PNG or JPG image file
   - ✅ **Expected**: File name appears with "Remove" button
   - ✅ **Expected**: No error messages

4. **Create Event**
   - Click **"Create Event"** button
   - ✅ **Expected**: Success message appears
   - ✅ **Expected**: If upload succeeds, message shows "Event created successfully!"
   - ✅ **Expected**: If upload fails, shows warning but event still created

5. **Verify Upload**
   - Find the created event in the events list
   - Click **"Edit"** on the event
   - Scroll to Certificate Settings section
   - ✅ **Expected**: See preview of uploaded template
   - ✅ **Expected**: "View Full Size" and "Remove Template" buttons visible

---

### Test 2: Upload Template to Existing Event

**Goal**: Test adding/updating certificate template on an existing event.

1. **Access Event Edit**
   - Go to Events tab
   - Find an existing event (or create one without template)
   - Click **"Edit"** button

2. **Upload Template**
   - Scroll to **"🏆 Certificate Settings"** section
   - If no template exists: Upload a new file
   - If template exists: Upload a different file to replace it
   - ✅ **Expected**: File selection works
   - ✅ **Expected**: New file name appears

3. **Save Changes**
   - Click **"Update Event"** button
   - ✅ **Expected**: Success message
   - ✅ **Expected**: Template uploaded and saved

4. **Verify Preview**
   - After saving, edit the event again
   - ✅ **Expected**: See thumbnail preview of template
   - ✅ **Expected**: "View Full Size" link works (opens in new tab)
   - ✅ **Expected**: Template image loads correctly

---

### Test 3: Remove Template

**Goal**: Test removing a certificate template and reverting to default.

1. **Edit Event with Template**
   - Open an event that has a certificate template
   - Go to Certificate Settings section

2. **Remove Template**
   - Click **"Remove Template"** button
   - ✅ **Expected**: Confirmation dialog appears
   - Click **"OK"** to confirm

3. **Verify Removal**
   - ✅ **Expected**: Success message: "Certificate template removed successfully"
   - ✅ **Expected**: Template preview disappears
   - ✅ **Expected**: Only file upload input visible

4. **Verify Default Template Used**
   - Generate a certificate for this event (see Test 4)
   - ✅ **Expected**: Uses default `/Template.jpg` background

---

### Test 4: Generate Certificate with Custom Template

**Goal**: Verify certificates use the custom template when generating.

**Option A: Using Test Certificate Page**

1. **Access Test Page**
   ```
   Navigate to: /certificates/test
   ```

2. **Generate Test Certificate**
   - Fill in test data:
     - Dancer Name: "Test Dancer"
     - Percentage: 92
     - Style: "Contemporary"
     - Title: "Test Performance"
   - Click **"Preview Certificate"**
   - ✅ **Expected**: Certificate displays with custom template (if event has one)
   - ✅ **Expected**: All text fields overlay correctly on template

**Option B: Using Real Performance**

1. **Create Test Performance**
   - Create an event with custom template
   - Add a test entry/performance
   - Complete the performance (mark as completed)
   - Add scores for the performance

2. **Generate Certificate**
   - Navigate to: `/certificates/[performanceId]`
   - Replace `[performanceId]` with actual performance ID
   - ✅ **Expected**: Certificate page loads
   - ✅ **Expected**: Custom template used as background
   - ✅ **Expected**: All fields (name, percentage, style, title, medallion, date) display correctly

3. **Check Certificate Image API**
   ```
   GET /api/certificates/[performanceId]/image
   ```
   - ✅ **Expected**: Returns JPEG image
   - ✅ **Expected**: Image uses custom template background
   - ✅ **Expected**: Text overlays are correctly positioned

---

### Test 5: File Validation

**Goal**: Ensure only PNG/JPG files are accepted.

1. **Try Invalid File Types**
   - Go to event create/edit
   - Try uploading:
     - PDF file → ✅ **Expected**: Error message "Invalid file type. Only PNG or JPG files are allowed."
     - Text file → ✅ **Expected**: Error message
     - Video file → ✅ **Expected**: Error message

2. **Try Valid File Types**
   - Upload PNG file → ✅ **Expected**: Accepted
   - Upload JPG file → ✅ **Expected**: Accepted
   - Upload JPEG file → ✅ **Expected**: Accepted

3. **Verify Upload Endpoint**
   - Check browser console for errors
   - ✅ **Expected**: No console errors for valid files
   - ✅ **Expected**: Upload progress/status visible

---

### Test 6: Error Handling

**Goal**: Test error scenarios and fallbacks.

1. **Upload Failure**
   - Try uploading with network disconnected (or invalid file)
   - ✅ **Expected**: Error message displayed
   - ✅ **Expected**: Existing template not overwritten
   - ✅ **Expected**: Event still saved (if creating)

2. **Missing Template**
   - Create event without template
   - Generate certificate
   - ✅ **Expected**: Uses default template (`/Template.jpg`)
   - ✅ **Expected**: No errors in console

3. **Invalid Template URL**
   - Manually set invalid URL in database (for testing)
   - Generate certificate
   - ✅ **Expected**: Falls back to default template
   - ✅ **Expected**: Error logged but certificate still generates

---

### Test 7: UI/UX Verification

**Goal**: Verify all UI elements work correctly.

1. **Create Event Form**
   - ✅ File input accepts `.png,.jpg,.jpeg` files
   - ✅ Selected file name displays
   - ✅ "Remove" button clears selection
   - ✅ Help text explains feature

2. **Edit Event Form**
   - ✅ Current template preview shows (if exists)
   - ✅ Preview image loads correctly
   - ✅ "View Full Size" opens in new tab
   - ✅ "Remove Template" button works
   - ✅ New file selection replaces old one
   - ✅ "Cancel" button clears new selection

3. **Visual Feedback**
   - ✅ Loading states during upload
   - ✅ Success/error messages clear
   - ✅ File validation happens immediately

---

## 🔍 Verification Checklist

After testing, verify:

- [ ] Can upload PNG template during event creation
- [ ] Can upload JPG template during event creation
- [ ] Can upload template to existing event
- [ ] Can replace existing template
- [ ] Can remove template
- [ ] Template preview displays correctly
- [ ] "View Full Size" link works
- [ ] Certificates use custom template when generating
- [ ] Certificates fall back to default if no template
- [ ] File validation rejects invalid types
- [ ] Error messages are clear and helpful
- [ ] No console errors during normal operation

---

## 🐛 Troubleshooting

### Issue: Template not uploading
- **Check**: File size (should be < 10MB)
- **Check**: File format (must be PNG or JPG)
- **Check**: Browser console for errors
- **Check**: Cloudinary credentials in environment variables

### Issue: Template not showing in certificate
- **Check**: Event has `certificateTemplateUrl` set in database
- **Check**: URL is accessible (not broken link)
- **Check**: Certificate generation logs for template selection

### Issue: Preview not loading
- **Check**: Image URL is valid
- **Check**: CORS settings (if external URL)
- **Check**: Browser network tab for failed requests

---

## 📝 Test Data Examples

### Sample Event Data
```json
{
  "name": "Test Event - Custom Template",
  "description": "Testing certificate template feature",
  "region": "Nationals",
  "eventDate": "2025-12-01",
  "venue": "Test Venue",
  "registrationDeadline": "2025-11-15"
}
```

### Sample Certificate Data
```json
{
  "dancerName": "Test Dancer",
  "percentage": 92,
  "style": "Contemporary",
  "title": "Rising Phoenix",
  "medallion": "Opus",
  "date": "October 11, 2025"
}
```

---

## 🚀 Quick Test Commands

### Test Upload Endpoint Directly
```bash
curl -X POST http://localhost:3000/api/upload/certificate-template \
  -F "file=@/path/to/template.jpg" \
  -F "eventId=test-event-id"
```

### Check Event Template URL
```sql
SELECT id, name, certificate_template_url 
FROM events 
WHERE certificate_template_url IS NOT NULL;
```

### Test Certificate Generation
```bash
# Get performance ID from database, then:
curl http://localhost:3000/api/certificates/[performanceId]/image \
  -o test-certificate.jpg
```

---

## 📊 Expected Results Summary

| Test Scenario | Expected Result |
|--------------|----------------|
| Upload PNG during create | ✅ Accepted, saved to event |
| Upload JPG during edit | ✅ Accepted, replaces old template |
| Remove template | ✅ Removed, reverts to default |
| Generate certificate | ✅ Uses custom template if available |
| Invalid file type | ❌ Rejected with error message |
| No template set | ✅ Uses default template |
| Template preview | ✅ Shows thumbnail in edit form |

---

## 🎯 Next Steps After Testing

1. **Document Issues**: Note any bugs or unexpected behavior
2. **Verify Production**: Test on staging/production environment
3. **User Acceptance**: Have end users test the feature
4. **Performance**: Check upload times and certificate generation speed

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Check server logs for API errors
3. Verify Cloudinary configuration
4. Test with different file sizes/formats

---

**Last Updated**: After certificate template feature implementation
**Feature Status**: ✅ Ready for Testing

