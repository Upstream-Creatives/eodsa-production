# 🏛️ Client System - Quick Reference

## 🎯 What You Need to Know

### For Production Deployment

**1. Environment Variable (Same as existing)**
```env
DATABASE_URL=postgres://your-production-database-url
```

**2. Run This Once in Production**
```bash
node scripts/setup-clients.js
```

---

## 📍 Key URLs

| Purpose | URL | Who |
|---------|-----|-----|
| Client Login | `/portal/client` | Clients |
| Client Dashboard | `/client-dashboard` | Clients |
| Admin Management | `/admin` → Clients tab | Admin |

---

## 👤 Test Account (Already Created)

```
Email: client@example.com
Password: client123
Access: Announcer, Media, Registration dashboards
```

---

## 🎨 Dashboard List

Clients can access these (you choose which ones per client):

1. **📢 Announcer Dashboard** - `announcer-dashboard`
2. **🎭 Backstage Dashboard** - `backstage-dashboard`
3. **📸 Media Dashboard** - `media-dashboard`
4. **📝 Registration Dashboard** - `registration-dashboard`
5. **🏆 Event Dashboard** - `event-dashboard`
6. **⚖️ Judge Dashboard** - `judge-dashboard`

---

## 🔧 Admin Tasks

### Create Client
1. Go to Admin → Clients tab
2. Fill form (Name, Email, Password required)
3. Check allowed dashboards
4. Click "Create Client"

### Manage Client
- **Activate/Deactivate**: Toggle in Actions column
- **Delete**: Click Delete button
- **View Info**: See in table

---

## 📊 What Was Created

| Component | Location | Purpose |
|-----------|----------|---------|
| Database Table | `clients` | Store accounts |
| Auth API | `/api/auth/client` | Login |
| Management API | `/api/clients` | CRUD operations |
| Login Page | `/portal/client` | Client entry |
| Dashboard | `/client-dashboard` | Client portal |
| Admin Tab | `/admin` Clients | Management UI |
| Middleware | `middleware.ts` | Access control |

---

## ✅ System Ready

- ✅ Database setup complete
- ✅ Sample account created
- ✅ Admin can create clients
- ✅ Clients can login
- ✅ Access control active
- ✅ Production ready

---

## 🚀 Next Steps

1. **Test**: Login with sample account
2. **Create**: Make real client accounts in admin
3. **Deploy**: Push to production (database setup included)
4. **Use**: Share client login URL with your clients

---

## 📞 Quick Help

**Client can't login?**
→ Check Active & Approved status in admin

**Access denied?**
→ Check allowed dashboards in admin

**Need to reset?**
→ Deactivate then reactivate in admin

---

**That's it! System is ready to use! 🎉**
