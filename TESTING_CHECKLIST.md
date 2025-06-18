# 🧪 COMPREHENSIVE TESTING CHECKLIST

## **Testing Status: Ready to Begin**
**Server**: http://localhost:3000
**Database**: Clean and ready for testing

---

## **🗂️ TESTING PHASES**

### **Phase 1: Database Setup & Admin Functions**
- [ ] **1.1** Navigate to admin dashboard (`/portal/admin`)
- [ ] **1.2** Test "Clean Database" functionality
- [ ] **1.3** Verify admin accounts are preserved
- [ ] **1.4** Create test events and judges

### **Phase 2: Registration System Testing**
- [ ] **2.1** Test adult registration (≥18) - email/phone required
- [ ] **2.2** Test minor registration (<18) - guardian info required
- [ ] **2.3** Test studio registration
- [ ] **2.4** Verify registration form validation logic

### **Phase 3: Navigation & Portal Fixes**
- [ ] **3.1** Test homepage portal links (admin/judge)
- [ ] **3.2** Verify judge portal redirect works
- [ ] **3.3** Test region selection auto-assignment
- [ ] **3.4** Verify duplicate event selection is skipped

### **Phase 4: Studio Dashboard Features**
- [ ] **4.1** Test studio login and dashboard
- [ ] **4.2** Test "Register New Dancer" functionality
- [ ] **4.3** Test large studio searchable dropdown (20+ dancers)
- [ ] **4.4** Verify private dancer labeling when linked to studio

### **Phase 5: Event Entry System**
- [ ] **5.1** Test group/duet/trio entries without pre-filled EODSA ID
- [ ] **5.2** Test participant search functionality
- [ ] **5.3** Verify auto-assignment logic for single events
- [ ] **5.4** Test entry flow with multiple participants

### **Phase 6: Judge Dashboard & Scoring**
- [ ] **6.1** Test judge login and event assignment
- [ ] **6.2** Test scoring interface with improved font contrast
- [ ] **6.3** Verify "SCORED" status only shows after ALL judges submit
- [ ] **6.4** Test partial scoring status display
- [ ] **6.5** Verify 5-criteria scoring system (0-20 each)

### **Phase 7: Admin Rankings & Analytics**
- [ ] **7.1** Test admin rankings dashboard
- [ ] **7.2** Verify "Total Items per Region" statistics
- [ ] **7.3** Test streamlined filters (removed unused ones)
- [ ] **7.4** Verify correct contestant names vs studio display
- [ ] **7.5** Test ranking calculations and percentages

---

## **🎯 DETAILED TEST SCENARIOS**

### **Scenario A: Complete Adult Registration Flow**
```
1. Go to /register
2. Enter adult birth date (e.g., 1990-01-01)
3. Verify email/phone fields show "*" (required)
4. Verify blue "Adult Registration" message appears
5. Try submitting without email/phone - should fail
6. Complete with valid email/phone - should succeed
7. Verify EODSA ID is generated
```

### **Scenario B: Complete Minor Registration Flow**
```
1. Go to /register  
2. Enter minor birth date (e.g., 2010-01-01)
3. Verify email/phone fields show "(Optional for minors)"
4. Verify yellow "Guardian Required" message appears
5. Try submitting without guardian info - should fail
6. Complete with guardian info - should succeed
```

### **Scenario C: Group Entry Without Pre-filled ID**
```
1. Go to event dashboard
2. Select region and performance type
3. Choose "Group" performance
4. Verify participant search appears
5. Search and add multiple participants
6. Complete entry - should use first participant's ID
```

### **Scenario D: Judge Scoring Complete Flow**
```
1. Login as judge
2. Select event to judge
3. Score a performance (all 5 criteria)
4. Verify status shows as partial until ALL judges score
5. Have other judges score same performance
6. Verify "SCORED" badge appears only when complete
```

### **Scenario E: Studio Dashboard Large List**
```
1. Login as studio with 20+ dancers
2. Verify automatic dropdown mode
3. Test search functionality
4. Verify "Large Studio" badge appears
5. Test switching between list/dropdown views
```

---

## **🔍 CRITICAL AREAS TO VERIFY**

### **Font Contrast & Accessibility**
- [ ] Score input fields are clearly readable
- [ ] All text meets WCAG standards
- [ ] Focus states are visible
- [ ] Labels have sufficient contrast

### **Age-Based Logic**
- [ ] 18+ requires email/phone
- [ ] <18 requires guardian info
- [ ] Labels update dynamically
- [ ] Server-side validation matches client-side

### **Auto-Assignment Logic**
- [ ] Single event regions auto-redirect
- [ ] Single performance type auto-redirects
- [ ] Multi-option scenarios show selection
- [ ] Back navigation works correctly

### **Scoring System**
- [ ] 5 criteria × 20 points = 100 max
- [ ] Percentage calculations accurate
- [ ] Ranking levels correct (Bronze/Silver/Gold/Pro Gold)
- [ ] "SCORED" only after ALL judges complete

---

## **⚠️ KNOWN ISSUES TO WATCH FOR**

1. **reCAPTCHA**: May need valid keys for testing
2. **Email System**: Disabled in Phase 1 (expected)
3. **Rate Limiting**: 3 registrations per IP per hour
4. **Database**: Clean between major test runs

---

## **📋 TEST COMPLETION CHECKLIST**

### **Core Functionality** ✅/❌
- [ ] Registration (Adult/Minor logic)
- [ ] Studio dashboard features
- [ ] Event entry system
- [ ] Judge scoring interface
- [ ] Admin rankings dashboard
- [ ] Navigation improvements

### **User Experience** ✅/❌
- [ ] Font contrast improvements
- [ ] Auto-assignment logic
- [ ] Search functionality
- [ ] Dynamic form validation
- [ ] Clear error messages
- [ ] Responsive design

### **Data Integrity** ✅/❌
- [ ] Correct participant names in rankings
- [ ] Proper studio attribution
- [ ] Accurate score calculations
- [ ] Complete scoring status logic
- [ ] Regional statistics accuracy

---

## **🚀 NEXT STEPS AFTER TESTING**

1. **Document any bugs found**
2. **Create list of minor improvements**
3. **Prepare for production deployment**
4. **Plan Phase 2 features**

---

**Testing Started**: [Date/Time]
**Testing Completed**: [Date/Time]
**Overall Status**: 🔄 In Progress 