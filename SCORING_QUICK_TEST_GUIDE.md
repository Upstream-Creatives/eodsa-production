# Scoring System - Quick Test Guide
**Ready for Thursday's Live Event**

## 🎯 Quick Verification Steps

### 1. Judge Assignment Check (5 min)
**URL:** `/admin` → "Event Management" → Select Event → "Assign Judges"

**Verify:**
- [ ] 4 judges assigned to Sasolburg event
- [ ] Judge names displayed correctly
- [ ] All judges have active accounts

**How to Fix:** If judges missing, use "Assign Judge" button to add them.

---

### 2. Virtual Scoring Test (10 min)
**Test Goal:** Confirm judges can score immediately without approval.

**Steps:**
1. Login as Judge: `/judge/login`
2. Go to dashboard: `/judge/dashboard`
3. Find a virtual performance
4. Submit score (all 5 categories: 0-20 each)
5. **Expected:** Success message "Score submitted successfully"
6. **Expected:** No approval step, score saved immediately

**Verify Database:**
```sql
SELECT * FROM scores WHERE judge_id = 'judge-id' ORDER BY submitted_at DESC LIMIT 1;
```

---

### 3. Approval Dashboard Test (10 min)
**URL:** `/admin/scoring-approval`

**Test Scenario A - Incomplete Scoring:**
1. Have only 2 out of 4 judges score a performance
2. **Expected:** Performance does NOT appear in approval list
3. **Reason:** System waiting for all 4 judges

**Test Scenario B - Complete Scoring:**
1. Have all 4 judges score a performance
2. **Expected:** Performance appears in approval list
3. **Expected:** Shows all 4 judge scores + average

**Visual Check:**
- [ ] Each judge's total displayed (e.g., "Judge Smith: 85/100")
- [ ] Average score displayed
- [ ] Percentage displayed
- [ ] Medal calculated (Legend/Gold/Silver/Bronze)

---

### 4. Score Editing Test (5 min)
**URL:** `/admin/scoring-approval` → Click "View Details" on any performance

**Steps:**
1. Click "Edit" button next to a judge's score
2. Change total from e.g. 85 to 90
3. Click "Save Total"
4. **Expected:** Success message
5. **Expected:** Average recalculates automatically
6. **Expected:** Medal updates if threshold crossed

**Verify Edit Log:**
```sql
SELECT * FROM score_edit_logs ORDER BY edited_at DESC LIMIT 1;
```

**Expected Fields:**
- `old_values: {"total": 85}`
- `new_values: {"total": 90}`
- `edited_by: admin-id`
- `edited_at: timestamp`

---

### 5. Score Publishing Test (5 min)
**URL:** `/admin/scoring-approval`

**Steps:**
1. Select a fully scored performance
2. Click "Publish Scores" button
3. **Expected:** Success message
4. **Expected:** Performance moves to "Published" filter
5. **Expected:** Edit button still available (admin can edit after publishing)

**Verify Database:**
```sql
SELECT scores_published, scores_published_at, scores_published_by 
FROM performances WHERE id = 'performance-id';
```

---

### 6. Dancer View Test (5 min)
**URL:** `/dancer-dashboard`

**Steps:**
1. Login as dancer who has published scores
2. Scroll to "My Scores & Feedback" section
3. **Expected:** See list of scored performances
4. **Expected:** Each shows total, medal, judge name
5. Click on a score card
6. **Expected:** Modal opens with full breakdown

**What Dancers Should See:**
- ✅ Total score (e.g., 85/100)
- ✅ Medal (Legend/Gold/Silver/Bronze)
- ✅ Judge name
- ✅ All 5 category scores
- ✅ Judge comments
- ✅ Submission timestamp

**What Dancers Should NOT See:**
- ❌ Unpublished scores
- ❌ Edit logs
- ❌ Admin actions

---

## 🔥 Thursday Live Event - Real-Time Checklist

### Before Event (30 min before)
- [ ] All 4 judges logged in and can see their dashboard
- [ ] Test judge can submit score successfully
- [ ] Admin can see scoring-approval dashboard
- [ ] Test performance appears after all judges score
- [ ] Test publish works and dancer sees score

### During Event - Per Performance
1. **Judges Score:** All 4 judges submit scores (live)
2. **Admin Checks:** Performance appears in `/admin/scoring-approval`
3. **Admin Reviews:** Check all scores look correct
4. **Admin Edits (if needed):** Adjust any obvious errors
5. **Admin Publishes:** Click "Publish Scores"
6. **Dancers See:** Results show in `/dancer-dashboard`

### If Something Goes Wrong

**Problem:** Performance not showing in approval dashboard
- **Check:** Are all 4 judges assigned to the event?
- **Check:** Have all 4 judges submitted scores?
- **SQL Check:**
  ```sql
  SELECT COUNT(*) FROM scores WHERE performance_id = 'perf-id';
  SELECT COUNT(*) FROM judge_event_assignments WHERE event_id = 'event-id';
  ```

**Problem:** Judge can't submit score
- **Check:** Is judge assigned to this event?
- **Check:** Has judge already scored this performance? (can't edit)
- **Solution:** Admin can edit via scoring-approval dashboard

**Problem:** Dancer not seeing published scores
- **Check:** Are scores actually published?
  ```sql
  SELECT scores_published FROM performances WHERE id = 'perf-id';
  ```
- **Check:** Is dancer's EODSA ID matching entry?
  ```sql
  SELECT * FROM nationals_event_entries WHERE eodsa_id = 'E123456';
  ```

---

## 📊 Key SQL Queries for Debugging

### Check Judge Assignments
```sql
SELECT e.name as event_name, j.name as judge_name, jea.assigned_at
FROM judge_event_assignments jea
JOIN events e ON e.id = jea.event_id
JOIN judges j ON j.id = jea.judge_id
WHERE e.id = 'event-id'
ORDER BY j.name;
```

### Check Performance Scoring Status
```sql
SELECT 
  p.title as performance,
  COUNT(DISTINCT s.judge_id) as scored_judges,
  (SELECT COUNT(DISTINCT judge_id) FROM judge_event_assignments WHERE event_id = p.event_id) as total_judges,
  p.scores_published
FROM performances p
LEFT JOIN scores s ON s.performance_id = p.id
WHERE p.id = 'performance-id'
GROUP BY p.id, p.title, p.event_id, p.scores_published;
```

### Check Individual Judge Scores
```sql
SELECT 
  j.name as judge,
  s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score as total,
  s.submitted_at
FROM scores s
JOIN judges j ON j.id = s.judge_id
WHERE s.performance_id = 'performance-id'
ORDER BY j.name;
```

### View Edit Logs
```sql
SELECT 
  sel.edited_at,
  sel.edited_by_name as admin,
  sel.judge_name,
  sel.old_values,
  sel.new_values
FROM score_edit_logs sel
WHERE sel.performance_id = 'performance-id'
ORDER BY sel.edited_at DESC;
```

### Check Dancer's Published Scores
```sql
SELECT 
  p.title as performance,
  j.name as judge,
  s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score as total,
  p.scores_published,
  s.submitted_at
FROM nationals_event_entries nee
JOIN scores s ON s.performance_id = nee.id
JOIN judges j ON j.id = s.judge_id
JOIN performances p ON p.id = nee.id
WHERE (nee.eodsa_id = 'E123456' OR nee.participant_ids::text LIKE '%E123456%')
ORDER BY s.submitted_at DESC;
```

---

## 🎓 Understanding the Flow

### Data Flow Diagram
```
1. JUDGE SCORES
   ↓
2. Score stored in `scores` table
   ↓
3. System counts: scored_judges vs total_judges
   ↓
4. IF scored_judges = total_judges:
   → Performance appears in admin approval dashboard
   ↓
5. ADMIN REVIEWS
   → (Optional) Edit totals
   → Edits logged in `score_edit_logs`
   ↓
6. ADMIN PUBLISHES
   → `performances.scores_published = true`
   ↓
7. DANCERS SEE RESULTS
   → Query filters WHERE scores_published = true
```

### Key Tables
- `scores` - Individual judge scores (5 categories each)
- `performances` - Performance records with `scores_published` flag
- `judge_event_assignments` - Which judges are assigned to which events
- `score_edit_logs` - Audit trail of admin edits
- `nationals_event_entries` - Links dancers to performances

---

## 🚀 Performance Optimization Tips

### For Large Events (100+ performances)
1. **Pagination:** Approval dashboard loads all at once - works fine for < 500 performances
2. **Filtering:** Use status filter (Pending/Published) to reduce visible items
3. **Search:** Use search bar to find specific performances quickly

### For Multiple Events
1. Each event has its own judge assignments
2. System automatically filters by event
3. Judges only see performances from their assigned events

---

## 📞 Emergency Contacts

**If system completely breaks during live event:**

### Fallback Plan A - Manual Scoring
1. Judges write scores on paper
2. Admin enters scores via SQL after event
3. Publish once all entered

### Fallback Plan B - Skip Approval
1. Direct SQL update to publish all scores:
   ```sql
   UPDATE performances 
   SET scores_published = true, 
       scores_published_at = NOW(), 
       scores_published_by = 'admin-id'
   WHERE event_id = 'event-id';
   ```

### Fallback Plan C - Restore Previous Version
1. Git revert to last stable commit
2. Redeploy

---

## ✅ Final Pre-Event Checklist

**24 Hours Before:**
- [ ] Database backup completed
- [ ] All judges have accounts and know their login credentials
- [ ] Admin has tested full flow end-to-end
- [ ] Dancers can access their dashboard

**1 Hour Before:**
- [ ] All systems online and responding
- [ ] Test score submission working
- [ ] Admin approval dashboard loading
- [ ] Database connection stable

**Go Live:**
- [ ] All 4 judges logged in
- [ ] Admin monitoring approval dashboard
- [ ] Ready to publish scores immediately after all judges score

---

## 🎉 Success Metrics

**System is working if:**
- ✅ Judges can score without errors
- ✅ Performances appear in approval after all judges score
- ✅ Admin can edit and publish
- ✅ Dancers see published scores within 1 minute
- ✅ No data loss or duplicate scores

**Expected Performance:**
- Score submission: < 1 second
- Approval dashboard load: < 2 seconds
- Publish action: < 1 second
- Dancer view update: < 1 second

