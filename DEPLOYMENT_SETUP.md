# 🚀 EODSA Deployment Setup - Official Guide

## 📋 Repository & Branch Structure

### **PRODUCTION** 🟢
- **Vercel Project**: `eodsa-demo`
- **Repository**: `Upstream-Creatives/eodsa-production`
- **Branch**: `main`
- **URL**: `https://eodsa.vercel.app` (or your production domain)
- **Purpose**: Live production environment

### **STAGING** 🟡 (OFFICIAL STAGING ENVIRONMENT)
- **Vercel Project**: `eodsa-stagingv2`
- **Repository**: `Upstream-Creatives/eodsa-production`
- **Branch**: `staging-v2` ⭐ **THIS IS THE STAGING BRANCH**
- **URL**: `https://eodsa-staging-v2.vercel.app`
- **Purpose**: Testing environment before production

---

## 🔧 Git Remotes Configuration

Your local repository has two remotes:

```bash
origin    → git@github.com:Upstream-Creatives/eodsa-staging.git
staging   → git@github.com:Upstream-Creatives/eodsa-production.git
```

### ⚠️ Important Notes:
- **`origin`** = Development repository (not used for deployments)
- **`staging`** = Production repository (used for both staging AND production)

---

## 📤 How to Deploy to Staging

### Step 1: Make sure you're on the correct branch
```bash
git checkout staging-v2
```

### Step 2: Merge changes from main (if needed)
```bash
git merge main
```

### Step 3: Push to staging remote
```bash
git push staging staging-v2
```

### Step 4: Vercel will auto-deploy
- Go to: https://vercel.com/angelosolis-projects/eodsa-staging-v2
- Check deployment status
- Staging URL: https://eodsa-staging-v2.vercel.app

---

## 📤 How to Deploy to Production

### Step 1: Switch to main branch
```bash
git checkout main
```

### Step 2: Merge staging-v2 into main (after testing)
```bash
git merge staging-v2
```

### Step 3: Push to staging remote (yes, same remote!)
```bash
git push staging main
```

### Step 4: Vercel will auto-deploy
- Go to: https://vercel.com/angelosolis-projects/eodsa-demo
- Check deployment status

---

## 🎯 Quick Reference

| Environment | Vercel Project | Repository | Branch | URL |
|------------|---------------|------------|-------|-----|
| **STAGING** 🟡 | `eodsa-stagingv2` | `eodsa-production` | `staging-v2` | https://eodsa-staging-v2.vercel.app |
| **PRODUCTION** 🟢 | `eodsa-demo` | `eodsa-production` | `main` | https://eodsa.vercel.app |

---

## 🔍 Verification Commands

### Check current branch
```bash
git branch --show-current
```

### Check remotes
```bash
git remote -v
```

### Check which remote a branch tracks
```bash
git branch -vv
```

### See what's different between branches
```bash
git diff staging-v2..main --name-only
```

---

## ⚠️ Common Mistakes to Avoid

1. ❌ **Don't push to `origin`** - That's the dev repo, not for deployments
2. ✅ **Always push to `staging` remote** - This is the deployment repo
3. ❌ **Don't confuse `eodsa-staging` repo with staging environment** - They're different!
4. ✅ **Use `staging-v2` branch for staging** - This is the official staging branch
5. ✅ **Use `main` branch for production** - This is the production branch

---

## 🆘 Troubleshooting

### "Which branch should I use?"
- **For testing/development**: `staging-v2` branch → pushes to `staging` remote
- **For production**: `main` branch → pushes to `staging` remote

### "Which remote should I push to?"
- **Always push to `staging` remote** for deployments
- `origin` remote is only for development work

### "How do I know if I'm on the right branch?"
```bash
git branch --show-current
# Should show: staging-v2 (for staging) or main (for production)
```

---

## 📝 Deployment Checklist

### Before Deploying to Staging:
- [ ] All changes tested locally
- [ ] On `staging-v2` branch
- [ ] Merged latest from `main` (if needed)
- [ ] Run `git push staging staging-v2`
- [ ] Check Vercel dashboard for deployment

### Before Deploying to Production:
- [ ] All changes tested in staging
- [ ] On `main` branch
- [ ] Merged `staging-v2` into `main`
- [ ] Run `git push staging main`
- [ ] Check Vercel dashboard for deployment

---

## 🎯 Summary

**STAGING = `staging-v2` branch in `eodsa-production` repo → `eodsa-stagingv2` Vercel project**

**PRODUCTION = `main` branch in `eodsa-production` repo → `eodsa-demo` Vercel project**

Both use the same repository (`eodsa-production`) but different branches!

