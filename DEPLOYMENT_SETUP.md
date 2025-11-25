# 🚀 EODSA Deployment Setup - Official Guide

## ⚠️ IMPORTANT: Repository Naming Confusion

**The repository names are confusing but here's the ACTUAL setup:**

### **STAGING** 🟡 (OFFICIAL STAGING ENVIRONMENT)
- **Vercel Project**: `eodsa-stagingv2`
- **Repository**: `Upstream-Creatives/eodsa-production` ⚠️ (Yes, "production" repo is used for STAGING!)
- **Branch**: `staging-v2`
- **Remote**: `staging`
- **URL**: `https://eodsa-staging-v2.vercel.app`
- **Purpose**: Testing environment before production

### **PRODUCTION** 🟢 (LIVE PRODUCTION ENVIRONMENT)
- **Vercel Project**: `eodsa-demo`
- **Repository**: `Upstream-Creatives/eodsa-staging` ⚠️ (Yes, "staging" repo is used for PRODUCTION!)
- **Branch**: `main`
- **Remote**: `origin`
- **URL**: `https://eodsa.vercel.app` (or your production domain)
- **Purpose**: Live production environment

---

## 🔧 Git Remotes Configuration

Your local repository has two remotes:

```bash
origin    → git@github.com:Upstream-Creatives/eodsa-staging.git      (PRODUCTION)
staging   → git@github.com:Upstream-Creatives/eodsa-production.git   (STAGING)
```

### ⚠️ Important Notes:
- **`origin`** = `eodsa-staging` repository → Used for **PRODUCTION** deployments
- **`staging`** = `eodsa-production` repository → Used for **STAGING** deployments
- **Yes, the names are backwards!** This is due to historical reasons.

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

### Step 1: Make sure you're on main branch
```bash
git checkout main
```

### Step 2: Push to origin remote (eodsa-staging repo)
```bash
git push origin main
```

### Step 3: Vercel will auto-deploy
- Go to: https://vercel.com/angelosolis-projects/eodsa-demo
- Check deployment status
- Production URL: https://eodsa.vercel.app

---

## 🎯 Quick Reference

| Environment | Vercel Project | Repository | Branch | Remote | URL |
|------------|---------------|------------|--------|--------|-----|
| **STAGING** 🟡 | `eodsa-stagingv2` | `eodsa-production` | `staging-v2` | `staging` | https://eodsa-staging-v2.vercel.app |
| **PRODUCTION** 🟢 | `eodsa-demo` | `eodsa-staging` | `main` | `origin` | https://eodsa.vercel.app |

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

---

## ⚠️ Common Mistakes to Avoid

1. ❌ **Don't push production to `staging` remote** - Use `origin` remote for production
2. ❌ **Don't push staging to `origin` remote** - Use `staging` remote for staging
3. ✅ **Remember: `origin` = Production, `staging` = Staging** (backwards from what you'd expect!)
4. ✅ **Staging uses `eodsa-production` repo** (confusing but true)
5. ✅ **Production uses `eodsa-staging` repo** (confusing but true)

---

## 🆘 Quick Deployment Commands

### Deploy to Staging:
```bash
git checkout staging-v2
git merge main  # if needed
git push staging staging-v2
```

### Deploy to Production:
```bash
git checkout main
git push origin main
```

---

## 📝 Deployment Checklist

### Before Deploying to Staging:
- [ ] All changes tested locally
- [ ] On `staging-v2` branch
- [ ] Merged latest from `main` (if needed)
- [ ] Run `git push staging staging-v2`
- [ ] Check Vercel dashboard: https://vercel.com/angelosolis-projects/eodsa-staging-v2

### Before Deploying to Production:
- [ ] All changes tested in staging
- [ ] On `main` branch
- [ ] Run `git push origin main`
- [ ] Check Vercel dashboard: https://vercel.com/angelosolis-projects/eodsa-demo

---

## 🎯 Summary

**STAGING = `staging-v2` branch in `eodsa-production` repo → `eodsa-stagingv2` Vercel project**

**PRODUCTION = `main` branch in `eodsa-staging` repo → `eodsa-demo` Vercel project**

⚠️ **Yes, the repository names are backwards from what you'd expect!** This is the current setup and changing it would require reconfiguring Vercel projects.
