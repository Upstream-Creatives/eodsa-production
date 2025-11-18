#!/bin/bash

# 🟡 Deploy to OFFICIAL STAGING Environment
# This script deploys to: https://eodsa-staging-v2.vercel.app

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║        🟡 DEPLOYING TO OFFICIAL STAGING 🟡                   ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 Staging URL: https://eodsa-staging-v2.vercel.app"
echo "📍 Branch: staging-v2"
echo "📍 Repository: eodsa-production"
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📋 Current branch: $CURRENT_BRANCH"
echo ""

# Check if staging remote exists
if ! git remote | grep -q "^staging$"; then
    echo "❌ Error: 'staging' remote not found"
    echo "   Expected: git@github.com:Upstream-Creatives/eodsa-production.git"
    exit 1
fi

# Switch to staging-v2 branch
echo "🔄 Switching to staging-v2 branch..."
git checkout staging-v2

# Merge main into staging-v2
echo "🔄 Merging main into staging-v2..."
git merge main --no-edit

# Push to staging remote
echo "🚀 Pushing to staging remote..."
git push staging staging-v2

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "📊 Check deployment status at:"
echo "   https://vercel.com/angelosolis-projects/eodsa-staging-v2"
echo ""
echo "🌐 Staging URL: https://eodsa-staging-v2.vercel.app"
echo ""

