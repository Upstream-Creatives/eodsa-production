# ⚡ Quick Setup: Staging V2 Auto-Deploy

## ✅ What's Done
- Created `staging-v2` branch locally

## 🚀 Next Steps

### 1. Push Branch to GitHub (Required)
```bash
git push production staging-v2
```

### 2. Configure Vercel Dashboard (Critical!)

Go to: [vercel.com/dashboard](https://vercel.com/dashboard)

**Steps:**
1. Select project: `eodsa-staging-v2` (or the project for staging-v2.vercel.app)
2. Go to **Settings** → **Git**
3. **IMPORTANT**: Set **Production Branch** to `staging-v2`
4. Verify repository shows: `Upstream-Creatives/eodsa-production`
5. Click **Save**

### 3. Verify Webhook (Check GitHub)

1. Go to: `https://github.com/Upstream-Creatives/eodsa-production/settings/hooks`
2. Find Vercel webhook
3. Check recent deliveries - should show activity for `staging-v2` branch

### 4. Test Deployment

After pushing, make a test commit:
```bash
git commit --allow-empty -m "Test: Verify staging-v2 auto-deploy"
git push production staging-v2
```

Then check Vercel dashboard - you should see a new deployment within 30 seconds.

## 🔍 Verification

After setup, every push to `staging-v2` should:
- ✅ Trigger automatic deployment in Vercel
- ✅ Appear in Vercel Dashboard → Deployments
- ✅ Update `https://eodsa-staging-v2.vercel.app`

## ⚠️ Common Issue

**If deployments don't trigger:**
- Most likely cause: Production Branch in Vercel is set to `main` instead of `staging-v2`
- Fix: Settings → Git → Change Production Branch to `staging-v2`


