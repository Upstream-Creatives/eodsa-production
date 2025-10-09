# 🏛️ Client Account System Setup Guide

## Overview

The client account system allows external clients to have their own accounts with restricted access to specific dashboards. This is perfect for giving partners, sponsors, or other stakeholders controlled access to the competition system.

## 🚀 Quick Setup

### 1. Database Setup

Run the SQL script to create the client tables:

```bash
# Apply the database schema
psql $DATABASE_URL -f scripts/create-clients-table.sql
```

Or manually execute the SQL in your database:
```sql
-- See scripts/create-clients-table.sql for the complete schema
```

### 2. Environment Variables

**No additional environment variables needed!** The system uses the existing `DATABASE_URL`.

For production, ensure you have:
```env
DATABASE_URL=your_production_database_url
```

### 3. Test the System

1. **Access Admin Dashboard**: Go to `/admin` → **Clients** tab
2. **Create Test Client**: 
   - Name: "Test Client"
   - Email: "test@client.com" 
   - Password: "testpass123"
   - Select allowed dashboards
3. **Test Client Login**: Go to `/portal/client`
4. **Verify Access**: Client should only see authorized dashboards

## 📊 Available Dashboards

Clients can be granted access to these dashboards:

| Dashboard | ID | Description |
|-----------|----|-----------| 
| 📢 Announcer | `announcer-dashboard` | Event announcements |
| 🎭 Backstage | `backstage-dashboard` | Performance management |
| 📸 Media | `media-dashboard` | Media access |
| 📝 Registration | `registration-dashboard` | Registration management |
| 🏆 Event Viewing | `event-dashboard` | Event monitoring |
| ⚖️ Judge | `judge-dashboard` | Scoring interface |

## 🔐 Access Control Features

### Dashboard Permissions
- **Granular Control**: Select specific dashboards per client
- **Real-time Enforcement**: Middleware blocks unauthorized access
- **Automatic Redirects**: Unauthorized users redirected to client dashboard

### Event Access
- **All Events**: Client can view all events in the system
- **Restricted Events**: Client only sees assigned events (future feature)

### Account Management
- **Active/Inactive**: Enable/disable client accounts
- **Audit Trail**: Track creation, updates, and login history
- **Notes**: Internal notes for admin reference

## 🛠️ Admin Management

### Creating Clients

1. Go to **Admin Dashboard** → **Clients** tab
2. Fill out the client creation form:
   - **Required**: Name, Email, Password
   - **Optional**: Company, Contact Person, Phone
   - **Permissions**: Select allowed dashboards
   - **Access Level**: All events or restricted
   - **Notes**: Internal reference

### Managing Clients

- **View All Clients**: See complete client list with status
- **Activate/Deactivate**: Toggle client access
- **Delete Clients**: Remove client accounts
- **Track Usage**: See last login dates

## 🔄 Client Experience

### Login Process
1. Visit `/portal/client`
2. Enter email and password
3. Redirected to `/client-dashboard`
4. See available dashboards based on permissions

### Dashboard Access
- **Authorized Dashboards**: Direct access via client dashboard
- **Unauthorized Access**: Blocked by middleware, redirected with error
- **Session Management**: Secure session storage

## 🚨 Security Features

### Authentication
- **Bcrypt Password Hashing**: Secure password storage
- **Session Validation**: Secure session management
- **Access Control**: Middleware-level protection

### Authorization
- **Dashboard-Level Permissions**: Fine-grained access control
- **Real-time Validation**: Every request checked
- **Audit Logging**: Track access attempts

## 📱 Integration Points

### Existing Systems
- **Admin Dashboard**: Full client management interface
- **Middleware**: Automatic access control
- **Database**: Integrated with existing schema

### Future Enhancements
- **Event-Level Permissions**: Restrict access to specific events
- **Role-Based Access**: More granular permission system
- **API Access**: Programmatic client management

## 🧪 Testing Checklist

- [ ] Database schema applied successfully
- [ ] Admin can create client accounts
- [ ] Client can login at `/portal/client`
- [ ] Client sees only authorized dashboards
- [ ] Unauthorized dashboard access is blocked
- [ ] Client can be activated/deactivated
- [ ] Client accounts can be deleted

## 🔧 Troubleshooting

### Common Issues

**Client can't login**
- Check if account is active and approved
- Verify password is correct
- Check database connection

**Access denied to dashboard**
- Verify dashboard is in client's `allowed_dashboards`
- Check middleware is running
- Confirm session is valid

**Admin can't see clients**
- Ensure `/api/clients` endpoint is working
- Check database table exists
- Verify admin permissions

### Debug Commands

```bash
# Check if clients table exists
psql $DATABASE_URL -c "SELECT * FROM clients LIMIT 5;"

# View client permissions
psql $DATABASE_URL -c "SELECT name, email, allowed_dashboards FROM clients;"

# Check middleware logs
# Look for "Client granted access" or "Client denied access" messages
```

## 🎯 Production Deployment

### Pre-deployment
1. **Test in staging** with real client accounts
2. **Verify all dashboards** work with client access
3. **Test access control** thoroughly

### Deployment Steps
1. **Apply database schema** to production
2. **Deploy application** with client system
3. **Create initial client accounts** via admin
4. **Test end-to-end** functionality

### Post-deployment
1. **Monitor client logins** and access patterns
2. **Gather feedback** from initial clients
3. **Adjust permissions** as needed

---

## 🎉 Ready to Go!

Your client account system is now ready! Clients can have secure, controlled access to specific dashboards while maintaining the security and integrity of your competition system.

**Need help?** Check the troubleshooting section or review the implementation files:
- `app/api/auth/client/route.ts` - Client authentication
- `app/api/clients/route.ts` - Client management API
- `app/client-dashboard/page.tsx` - Client interface
- `middleware.ts` - Access control
