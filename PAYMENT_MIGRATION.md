# 💳 Payment Reference Migration Guide

## Overview

The payment tracking system has been enhanced with additional fields to track payment references and payment dates.

### New Payment Fields Added

- **`payment_reference`**: Stores transaction IDs, check numbers, bank reference numbers, etc.
- **`payment_date`**: Automatically records when a payment is marked as paid

## Database Migration Required

⚠️ **IMPORTANT**: The database schema has been updated and requires migration to add the new payment tracking columns.

### Option 1: Automatic Migration (Recommended)

The system will automatically detect and add the required columns when you:
1. Restart the application (`npm run dev`)
2. Use any payment management feature in the admin panel

The columns will be added automatically using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

### Option 2: Manual Migration

If you prefer to run the migration manually:

```bash
# Navigate to your project directory
cd /path/to/your/project

# Ensure your .env file has DATABASE_URL set
# DATABASE_URL should be in your .env file (globally ignored)

# Run the migration script
node scripts/add-payment-reference-columns.js
```

### Option 3: Using the Database Function

You can also call the migration programmatically:

```javascript
const { db } = require('./lib/database');

// Call the migration function
await db.addPaymentReferenceColumns();
```

## What's Updated

### ✅ Database Schema
- **`event_entries` table**: Added `payment_reference` and `payment_date` columns
- **Automatic migration**: Runs when payment API is used
- **Safe migration**: Uses `IF NOT EXISTS` to prevent errors

### ✅ Payment Management
- **Payment Reference Tracking**: Required when marking payments as paid
- **Payment Date Tracking**: Automatically set when payment status changes to 'paid'
- **Outstanding Balance Calculation**: Shows exactly what's owed
- **Payment History**: Displays payment references and dates in admin interface

### ✅ Admin Interface
- **Enhanced Payment Column**: Shows payment reference and date
- **Payment Management Modal**: Easy interface for updating payment status
- **Outstanding Balance Warnings**: Visual indicators for unpaid entries
- **Real-time Updates**: No page refresh required

### ✅ API Endpoints
- **GET `/api/admin/entries/[id]/payment`**: Retrieve payment information
- **PUT `/api/admin/entries/[id]/payment`**: Update payment status and reference
- **Admin Authentication**: Secure payment management

## New Features Available

1. **Payment Reference Numbers**: Track transaction IDs, check numbers, etc.
2. **Outstanding Balance Tracking**: See exactly what's owed per entry
3. **Payment Date Tracking**: Know when payments were processed
4. **Enhanced Admin UI**: Better payment management interface

## Testing the New System

1. **Start the application**: `npm run dev`
2. **Login as admin**: Use admin credentials
3. **Navigate to event participants**: Go to any event's participant page
4. **Test payment management**: Click "Manage Payment" on any entry
5. **Mark as paid**: Enter a payment reference and mark as paid
6. **Verify tracking**: Check that reference and date are displayed

## Migration Details

### Columns Added:
```sql
ALTER TABLE event_entries ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE event_entries ADD COLUMN IF NOT EXISTS payment_date TEXT;
```

### Migration Safety:
- Uses `IF NOT EXISTS` to prevent duplicate columns
- Non-destructive - existing data is preserved
- Automatic rollback not needed (columns are nullable)

## Environment Requirements

Make sure your environment file contains DATABASE_URL:
```
DATABASE_URL=your_neon_database_url_here
```

The script will automatically load from:
- **`.env.local`** (Next.js standard, recommended)
- **`.env`** (your current setup)  
- **`.env.development`** (development-specific)

The DATABASE_URL should already be configured if your application is working.

## Troubleshooting

### Migration Fails
1. **Check DATABASE_URL**: Ensure environment variable is set correctly
2. **Database Connection**: Verify you can connect to the database
3. **Permissions**: Ensure database user has ALTER TABLE permissions
4. **Table Exists**: Verify `event_entries` table exists

### Columns Not Appearing
1. **Restart Application**: Sometimes a restart is needed
2. **Check Migration Logs**: Look for migration success messages
3. **Manual Verification**: Check database directly for new columns

### API Errors
1. **Column Not Found**: Run migration manually
2. **Permission Denied**: Check admin authentication
3. **Validation Errors**: Ensure payment reference is provided when marking as paid

## Support

If you encounter any issues:
1. Check the console logs for detailed error messages
2. Verify your DATABASE_URL is correct
3. Ensure all environment variables are set
4. Check that you have proper database permissions

---

**Migration Status**: Ready to deploy  
**Compatibility**: Maintains all existing data  
**Downtime**: None (migration is non-blocking)  
**Rollback**: Not needed (additive changes only)