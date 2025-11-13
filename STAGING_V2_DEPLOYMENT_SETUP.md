# 🚀 Staging V2 Deployment Setup Guide

## Current Configuration
- **Staging URL**: `https://eodsa-staging-v2.vercel.app`
- **Repository**: `Upstream-Creatives/eodsa-production`
- **Branch**: `staging-v2`
- **Remote**: `production` (git@github.com:Upstream-Creatives/eodsa-production.git)

## Step 1: Verify Branch Exists

### Check if staging-v2 branch exists on remote:
```bash
git fetch production
git branch -r | grep staging-v2
```

### If branch doesn't exist, create it:
```bash
# Option A: Create from current main branch
git checkout -b staging-v2
git push production staging-v2

# Option B: Create from existing branch
git checkout main  # or any branch you want to base it on
git checkout -b staging-v2
git push production staging-v2
```

## Step 2: Configure Vercel Project Settings

### In Vercel Dashboard:

1. **Go to Project Settings**
   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Select project: `eodsa-staging-v2` (or the project linked to staging-v2.vercel.app)

2. **Configure Git Integration**
   - Go to **Settings** → **Git**
   - Verify repository: `Upstream-Creatives/eodsa-production`
   - **Production Branch**: Set to `staging-v2` (NOT `main`)
   - **Preview Branches**: Enable auto-deploy for all branches (optional)

3. **Configure Branch Deployments**
   - Go to **Settings** → **Git** → **Production Branch**
   - Ensure `staging-v2` is selected
   - Save changes

## Step 3: Verify Webhook Configuration

### In Vercel Dashboard:
1. **Settings** → **Git**
2. Check webhook URL is active
3. Note the webhook URL (should be something like `https://api.vercel.com/v1/integrations/...`)

### In GitHub:
1. Go to `Upstream-Creatives/eodsa-production` repository
2. **Settings** → **Webhooks**
3. Verify Vercel webhook exists and is active
4. Check recent deliveries for `staging-v2` branch pushes

## Step 4: Test Deployment

### Push a test commit to staging-v2:
```bash
# Switch to staging-v2 branch
git checkout staging-v2

# Make a small change or empty commit
git commit --allow-empty -m "Test: Verify staging-v2 deployment"
git push production staging-v2
```

### Monitor Deployment:
1. Go to Vercel Dashboard → **Deployments**
2. You should see a new deployment triggered within seconds
3. Check build logs for any errors

## Step 5: Verify Auto-Deploy is Working

### Checklist:
- ✅ Branch `staging-v2` exists on `Upstream-Creatives/eodsa-production`
- ✅ Vercel project is connected to correct repository
- ✅ Production branch is set to `staging-v2` in Vercel
- ✅ Webhook is active in GitHub
- ✅ Test commit triggers deployment

## Troubleshooting

### Issue: Deployments not triggering

**Solution 1: Reconnect Git Integration**
1. Vercel Dashboard → Settings → Git
2. Click **Disconnect**
3. Click **Connect Git Repository**
4. Select `Upstream-Creatives/eodsa-production`
5. Select `staging-v2` as production branch

**Solution 2: Check Branch Name**
- Ensure branch is exactly `staging-v2` (case-sensitive)
- No typos or extra spaces

**Solution 3: Verify Webhook**
- GitHub → Repository Settings → Webhooks
- Check if Vercel webhook has recent successful deliveries
- If not, reconnect Git integration in Vercel

**Solution 4: Manual Deployment**
- Vercel Dashboard → Deployments
- Click **Create Deployment**
- Select branch: `staging-v2`
- Deploy manually to test

### Issue: Wrong branch being deployed

**Fix:**
1. Vercel Dashboard → Settings → Git
2. Change **Production Branch** to `staging-v2`
3. Save changes
4. Push a new commit to verify

## Workflow for Future Deployments

### Standard Workflow:
```bash
# 1. Make changes on staging-v2 branch
git checkout staging-v2
# ... make your changes ...

# 2. Commit and push
git add .
git commit -m "Your commit message"
git push production staging-v2

# 3. Vercel will automatically deploy
# Check Vercel dashboard for deployment status
```

### Alternative: Push from any branch to staging-v2
```bash
# If you're on a different branch and want to deploy to staging
git push production your-branch:staging-v2
```

## Environment Variables

### Ensure Environment Variables are Set:
1. Vercel Dashboard → Settings → Environment Variables
2. Verify all required variables are present
3. Check that variables are available for `staging-v2` branch
4. Variables can be set per branch if needed

## Monitoring Deployments

### Check Deployment Status:
- **Vercel Dashboard** → **Deployments** tab
- Look for deployments from `staging-v2` branch
- Green checkmark = successful
- Red X = failed (check logs)

### Deployment URL:
- Production: `https://eodsa-staging-v2.vercel.app`
- Preview deployments: Check individual deployment URLs

## Quick Reference Commands

```bash
# Switch to staging-v2 branch
git checkout staging-v2

# Pull latest changes
git pull production staging-v2

# Push changes (triggers deployment)
git push production staging-v2

# Create and push new branch as staging-v2
git checkout -b staging-v2
git push production staging-v2

# Force update (if needed, use with caution)
git push production staging-v2 --force
```

## Verification Checklist

After setup, verify:
- [ ] `staging-v2` branch exists on GitHub
- [ ] Vercel project is connected to `Upstream-Creatives/eodsa-production`
- [ ] Production branch is set to `staging-v2`
- [ ] Test commit triggers automatic deployment
- [ ] Deployment appears in Vercel dashboard
- [ ] Site updates at `https://eodsa-staging-v2.vercel.app`


