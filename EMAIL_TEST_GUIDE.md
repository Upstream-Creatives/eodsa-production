# 📧 Simple Email Testing Guide

## 🚀 Quick Test (Easiest Way)

### Option 1: Using npm script (Recommended)
```bash
npm run test:email your-email@example.com
```

**Example:**
```bash
npm run test:email solisangelo882@gmail.com
```

### Option 2: Direct node command
```bash
node test-email-simple.js your-email@example.com
```

**Example:**
```bash
node test-email-simple.js solisangelo882@gmail.com
```

### Option 3: Test via API (if server is running)

**Test connection:**
```bash
curl http://localhost:3000/api/email/test
```

**Send test email:**
```bash
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com"}'
```

---

## ✅ What to Expect

When you run the test, you should see:
- ✅ SMTP connection successful
- ✅ Test email sent successfully
- 📧 Message ID displayed
- 📬 Instructions to check your inbox

If successful, check your email inbox (and spam folder) for the test email!

---

## ❌ Troubleshooting

**If you get an error:**
1. Make sure `.env.local` has all the email settings:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASSWORD`
   - `SMTP_FROM_EMAIL`

2. Check that your email credentials are correct

3. Make sure your firewall/network allows SMTP connections on port 587

---

## 📝 Notes

- The test script automatically reads from `.env.local`
- You can test to any email address
- If you don't provide an email, it defaults to `solisangelo882@gmail.com`

