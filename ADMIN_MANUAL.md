# 👑 Avalon Competition System - Admin Manual

## 📋 Table of Contents
1. [Getting Started](#getting-started)
2. [Login Process](#login-process)
3. [Admin Dashboard Overview](#admin-dashboard-overview)
4. [Event Management](#event-management)
5. [Judge Management](#judge-management)
6. [Judge Assignments](#judge-assignments)
7. [Dancer Management](#dancer-management)
8. [Studio Management](#studio-management)
9. [Rankings & Analytics](#rankings--analytics)
10. [System Maintenance](#system-maintenance)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)

---

## 🚀 Getting Started

### Admin Account Information
- **Current Admin**: mains@elementscentral.com
- **Password**: 624355Mage55!
- **Role**: Super Administrator with full system access

### System Access Levels
- **Super Admin**: Full system control (current account)
- **Regular Admin**: Limited admin functions
- **Judge with Admin**: Can access both judge and admin panels

### What You Can Manage
- ✅ **Events**: Create, edit, assign judges
- ✅ **Judges**: Create accounts, assign to events
- ✅ **Dancers**: Approve registrations, manage profiles
- ✅ **Studios**: Approve studio applications
- ✅ **Rankings**: View comprehensive analytics
- ✅ **System**: Clean database, maintain system health

---

## 🔐 Login Process

### Step 1: Access Admin Portal
1. Go to `/portal/admin` or click **"Admin Portal"**
2. **Do NOT** use the judge portal if you're an admin

### Step 2: Login Credentials
1. **Email**: mains@elementscentral.com
2. **Password**: 624355Mage55!
3. Click **"Sign In"**

### Step 3: Verify Access
- Should see **"Avalon Admin Dashboard"**
- Icon shows **"A"** (for Avalon)
- Six main tabs: Events, Judges, Assignments, Dancers, Studios, Verification

⚠️ **Security Note**: If you have both admin and judge privileges, you'll be redirected to admin panel by default.

---

## 📊 Admin Dashboard Overview

### Header Features
- **System Status**: Green dot shows "System Online"
- **Quick Actions**:
  - **"Clean DB"**: Reset database (remove test data)
  - **"Rankings"**: View comprehensive rankings analytics

### Main Tabs
1. **Events** 🏆: Create and manage competition events
2. **Judges** 👨‍⚖️: Create and manage judge accounts  
3. **Assignments** 🔗: Assign judges to specific events
4. **Dancers** 💃: Approve/manage individual dancer registrations
5. **Studios** 🏢: Approve/manage studio applications
6. **Verification** 🔍: Handle pending approvals

### Navigation Tips
- **Single Click**: Switch between tabs instantly
- **Real-time Updates**: Data refreshes automatically
- **Search Functions**: Available in each section
- **Batch Operations**: Handle multiple items at once

---

## 🏆 Event Management

### Creating New Events

#### Step 1: Access Events Tab
1. Click **"Events"** tab in dashboard
2. Click **"Create Event"** button

#### Step 2: Event Details
**Required Information:**
- **Event Name**: e.g., "Nationals Championship 2024"
- **Description**: Brief event description
- **Region**: Select "Nationals" (default for nationals system)
- **Event Date**: Competition start date
- **Event End Date**: Competition end date (if multi-day)
- **Registration Deadline**: Last day for entries
- **Venue**: Competition location

#### Step 3: Advanced Settings
**Automatic Features:**
- ✅ **All Performance Types**: Solo, Duet, Trio, Group supported
- ✅ **All Age Categories**: Automatic age-appropriate grouping
- ✅ **Fee Structure**: Handled by separate fee system

#### Step 4: Save Event
1. Review all information
2. Click **"Create Event"**
3. Success message: "Event created successfully!"

### Managing Existing Events

#### View Event Details
- **Event List**: Shows all events with status
- **Quick Info**: Date, venue, performance types
- **Status Indicators**: Active, upcoming, completed

#### Edit Events
1. Click event name in list
2. Click **"Edit Event"** button
3. Modify required fields
4. Click **"Save Changes"**

#### Event Participants
1. Click **"View Participants"** button
2. See all registered participants
3. **Download Excel**: Export participant data
4. **Item Numbers**: Assign performance order
5. **Approval Status**: Approve/reject entries

---

## 👨‍⚖️ Judge Management

### Creating Judge Accounts

#### Step 1: Access Judges Tab
1. Click **"Judges"** tab
2. Click **"Create Judge"** button

#### Step 2: Judge Information
**Required Fields:**
- **Full Name**: Judge's complete name
- **Email Address**: Login email (must be unique)
- **Password**: Secure password for judge
- **Admin Status**: Check if judge should have admin access

#### Step 3: Optional Settings
- **Specialization**: Judge's dance expertise areas
- **Contact Information**: Additional contact details

#### Step 4: Account Creation
1. Review judge information
2. Click **"Create Judge"**
3. Judge receives login credentials
4. Account appears in judge list

### Managing Existing Judges

#### Judge List Features
- **Search Function**: Find judges by name/email
- **Status Indicators**: Active, admin privileges
- **Assignment Count**: Shows how many events assigned to

#### Judge Actions
- **Edit Details**: Update judge information
- **Reset Password**: Generate new password
- **Delete Account**: Remove judge (use carefully)
- **Toggle Admin**: Grant/remove admin privileges

#### Admin Judge Notes
- **Super Admins**: Cannot be deleted by other admins
- **Active Assignments**: Check before deleting judges
- **Password Security**: Use strong passwords for all accounts

---

## 🔗 Judge Assignments

### Assigning Judges to Events

#### Step 1: Access Assignments Tab
1. Click **"Assignments"** tab
2. View current assignments

#### Step 2: Create New Assignment
1. Click **"Assign Judge"** button
2. **Select Judge**: Choose from dropdown
3. **Select Event**: Choose target event
4. Click **"Assign Judge"**

#### Step 3: Verify Assignment
- Assignment appears in list
- Judge can now see event in their dashboard
- Judge can score performances for that event

### Managing Assignments

#### Assignment Overview
- **Judge Name**: Who is assigned
- **Event Details**: Which event they're judging
- **Assignment Date**: When assignment was made
- **Status**: Active/inactive

#### Reassignment Process
1. **Remove Assignment**: Click "Unassign" if needed
2. **Bulk Assignment**: Assign one judge to multiple events
3. **Event Coverage**: Ensure all events have sufficient judges

#### Assignment Requirements
- **Minimum Judges**: 3 judges per event recommended
- **Coverage Check**: All performances need judge coverage
- **Specialization Match**: Consider judge expertise

---

## 💃 Dancer Management

### Individual Dancer Approvals

#### Step 1: Access Dancers Tab
1. Click **"Dancers"** tab
2. View all registered dancers

#### Step 2: Review Applications
**Dancer Information Displayed:**
- **Name & Age**: Dancer details
- **EODSA ID**: Unique dancer identifier
- **Registration Status**: Pending/Approved/Rejected
- **Guardian Info**: For minors under 18
- **Contact Details**: Email, phone (for adults)

#### Step 3: Approval Process
**For Each Dancer:**
1. **Review Information**: Check completeness
2. **Verify Eligibility**: Confirm age, requirements
3. **Click "Approve"**: Approve qualified dancers
4. **Click "Reject"**: Reject with reason if needed

### Dancer Search & Filtering

#### Search Options
- **Name Search**: Find dancers by name
- **EODSA ID Search**: Search by unique ID
- **Status Filter**: Pending/Approved/Rejected
- **Age Filter**: Filter by age groups

#### Bulk Operations
- **Select Multiple**: Use checkboxes for bulk actions
- **Bulk Approval**: Approve multiple dancers at once
- **Export Data**: Download dancer information

### Dancer Status Management

#### Status Types
- **Pending**: Awaiting admin approval
- **Approved**: Can participate in competitions
- **Rejected**: Cannot participate (with reason)

#### Status Changes
- **Approve**: Changes pending to approved
- **Reject**: Requires rejection reason
- **Reactivate**: Restore previously rejected dancers

---

## 🏢 Studio Management

### Studio Application Approval

#### Step 1: Access Studios Tab
1. Click **"Studios"** tab
2. View studio applications

#### Step 2: Review Studio Information
**Details Available:**
- **Studio Name**: Official studio name
- **Registration Number**: Unique studio identifier
- **Contact Person**: Studio representative
- **Address & Details**: Studio location information
- **Email & Phone**: Contact information

#### Step 3: Approval Process
**For Each Studio:**
1. **Verify Information**: Check studio legitimacy
2. **Contact Verification**: Confirm contact details
3. **Click "Approve"**: Approve legitimate studios
4. **Click "Reject"**: Reject with reason if needed

### Studio Search & Management

#### Search Features
- **Studio Name**: Search by studio name
- **Registration Number**: Find by unique ID
- **Email Search**: Search by contact email
- **Status Filter**: Pending/Approved/Rejected

#### Studio Status Management
- **Approved Studios**: Can accept dancers and enter competitions
- **Pending Studios**: Awaiting approval
- **Rejected Studios**: Cannot operate (with reason)

---

## 📈 Rankings & Analytics

### Accessing Rankings

#### Step 1: Open Rankings
1. Click **"Rankings"** button in header
2. Navigate to `/admin/rankings`

#### Step 2: Rankings Overview
**Statistics Displayed:**
- **Total Performances**: Number of performances scored
- **Studios**: Number of participating studios
- **Age Categories**: Number of different age groups
- **Dance Styles**: Variety of dance styles

### View Modes

#### 1. **All Rankings** (Default)
- Shows all scored performances
- Ordered by total score percentage
- Includes all age groups and styles

#### 2. **Top 3 by Age Category**
- Groups performances by age category
- Shows top 3 in each age group
- Perfect for age category awards

#### 3. **Top 3 by Style**
- Groups by dance style (Ballet, Jazz, etc.)
- Shows top performers in each style
- Great for style-specific awards

#### 4. **Top 3 Duets/Groups/Trios**
- Filters by performance type
- Shows top group performances
- Separate from solo rankings

#### 5. **Top 10 Soloists**
- Shows overall top 10 solo performances
- Across all ages and styles
- For overall solo championship

#### 6. **Overall Top 10**
- Top 10 performances overall
- All categories combined
- For grand championship awards

### Filtering Options

#### Mastery Level Filters
- **All Levels**: Shows all performance levels
- **Competitive (Water)**: Competition level only
- **Advanced (Fire)**: Advanced level only

#### Performance Filters
- **Age Category**: Filter by specific age groups
- **Performance Type**: Solo/Duet/Trio/Group
- **Dance Style**: Specific dance styles

### Award Ceremony Features

#### Medal Categories
The system automatically calculates:
- **Bronze**: ≤69% total score
- **Silver**: 70-74% total score
- **Silver Plus**: 75-79% total score
- **Gold**: 80-84% total score
- **Legend**: 85-89% total score (Gold with Legend emblem)
- **Opus**: 90-94% total score (Gold with Opus emblem)
- **Elite**: 95%+ total score (Gold with Elite emblem)

#### Program Order
- **Item Numbers**: Shows performance order
- **Studio Information**: Studio affiliation displayed
- **Participant Names**: All performer names listed

---

## 🛠️ System Maintenance

### Database Management

#### Clean Database Function
**Purpose**: Removes all test data while preserving admin accounts

**Steps to Clean Database:**
1. Click **"Clean DB"** button in header
2. **Warning Dialog**: Confirms you want to proceed
3. **Confirmation**: Type "CLEAN" to confirm
4. **Processing**: System removes test data
5. **Success**: Only admin accounts remain

**What Gets Removed:**
- ✅ All test scores and rankings
- ✅ All test performances and entries
- ✅ All test events
- ✅ All test dancers and studios
- ✅ All test judge assignments

**What Stays:**
- ✅ Admin accounts and credentials
- ✅ Fee structure
- ✅ Database structure

#### When to Clean Database
- **Before Production**: Remove all test data
- **Between Seasons**: Clear old competition data
- **System Reset**: Start fresh for new competition
- **Troubleshooting**: Reset system state

### System Monitoring

#### Health Indicators
- **System Online**: Green indicator in header
- **Database Status**: Automatic health checks
- **Performance Metrics**: Response time monitoring

#### Regular Maintenance
- **Data Backups**: Ensure regular system backups
- **Security Updates**: Keep system updated
- **User Cleanup**: Remove inactive accounts
- **Performance Review**: Monitor system speed

---

## ⚠️ Troubleshooting

### Common Admin Issues

#### **Issue**: "Cannot approve studio/dancer"
**Solutions:**
1. Check database connectivity
2. Verify admin permissions
3. Refresh page and try again
4. Check server logs for errors

#### **Issue**: "Judge cannot see assigned events"
**Solutions:**
1. Verify judge assignment was successful
2. Check judge login credentials
3. Confirm event is active
4. Have judge logout and login again

#### **Issue**: "Rankings not updating"
**Solutions:**
1. Verify scores have been submitted
2. Check if all required judges have scored
3. Refresh rankings page
4. Clear browser cache

#### **Issue**: "Event participants not showing"
**Solutions:**
1. Check event dates and deadlines
2. Verify participant approval status
3. Confirm entries were submitted properly
4. Check for withdrawn performances

### System Recovery

#### Database Issues
1. **Check Connectivity**: Verify database connection
2. **Restart System**: Restart application server
3. **Restore Backup**: Use latest backup if needed
4. **Contact Support**: Get technical assistance

#### Performance Issues
1. **Clear Cache**: Clear browser cache
2. **Check Internet**: Verify connection speed
3. **Close Tabs**: Reduce browser load
4. **Restart Browser**: Fresh browser session

---

## ✨ Best Practices

### Event Management
1. **Plan Ahead**: Create events well before competition dates
2. **Clear Names**: Use descriptive event names
3. **Accurate Dates**: Double-check all dates and deadlines
4. **Judge Coverage**: Ensure adequate judge assignments

### User Management
1. **Secure Passwords**: Use strong passwords for all accounts
2. **Regular Cleanup**: Remove inactive accounts periodically
3. **Role Management**: Only grant admin access when necessary
4. **Contact Info**: Keep contact information updated

### Competition Day
1. **System Check**: Verify all systems operational
2. **Judge Support**: Have technical support available
3. **Backup Plan**: Prepare manual processes if needed
4. **Monitor Progress**: Watch scoring progress throughout day

### Security Practices
1. **Admin Access**: Limit admin account sharing
2. **Regular Logout**: Always logout when finished
3. **Password Changes**: Change passwords regularly
4. **Access Review**: Regularly review who has access

### Data Management
1. **Regular Backups**: Backup data frequently
2. **Clean Data**: Remove test data before production
3. **Monitor Storage**: Watch database size and performance
4. **Archive Old**: Archive completed competition data

---

## 📞 Support & Resources

### Emergency Contacts
- **System Admin**: mains@elementscentral.com
- **Technical Support**: Contact system developer
- **Competition Director**: Local competition organizer

### Training Resources
- **Admin Documentation**: This manual
- **Video Tutorials**: Available from system provider
- **Practice Environment**: Test features in development

### System Information
- **Current Version**: Avalon Competition System v2024
- **Database**: PostgreSQL with automatic scaling
- **Hosting**: Cloud-based with 99.9% uptime
- **Support**: 24/7 monitoring and support

---

## 🎉 Conclusion

The Avalon Admin System provides complete control over your dance competition. Key capabilities include:

- ✅ **Complete Event Management**: From creation to awards
- ✅ **User Administration**: Judges, dancers, and studios
- ✅ **Real-time Analytics**: Comprehensive rankings and statistics
- ✅ **System Maintenance**: Database management and monitoring
- ✅ **Security Features**: Role-based access and data protection

**Remember**: As an administrator, you have significant control over the competition system. Use these tools responsibly to ensure fair, efficient, and successful competitions.

**Your role is crucial** for:
- 🎯 **Fair Competition**: Ensuring all participants have equal opportunity
- 📊 **Accurate Results**: Maintaining data integrity and scoring accuracy  
- 🛡️ **System Security**: Protecting participant data and system access
- 🎪 **Smooth Operations**: Keeping competitions running efficiently

Good luck managing your competitions! 🌟 