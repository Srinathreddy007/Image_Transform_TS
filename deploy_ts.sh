#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# Build & Deploy TypeScript Backend to Google Cloud App Engine
#
# Prerequisites:
#   1. Install the Google Cloud SDK:  https://cloud.google.com/sdk/docs/install
#   2. Authenticate:  gcloud auth login
#   3. Set your project:  gcloud config set project YOUR_PROJECT_ID
#   4. Secrets must be created in Secret Manager (already done)
#
# Usage:
#   chmod +x deploy_ts.sh
#   ./deploy_ts.sh
# ──────────────────────────────────────────────────────────────────────────────

set -e  # Exit on any error

# Always run from repo root (where this script lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "══════════════════════════════════════════════════════════"
echo "  Image Transformation Service (TypeScript) — Build & Deploy"
echo "══════════════════════════════════════════════════════════"

# ── Step 1: Build the React frontend (clean build) ──────────────────────────
echo ""
echo "▸ Step 1/4: Building frontend..."
rm -rf frontend/dist
cd frontend
npm install
npm run build
echo " Frontend built successfully"

# ── Step 2: Build the TypeScript backend ────────────────────────────────────
echo ""
echo "▸ Step 2/4: Building TypeScript backend..."
cd ../backend_ts
npm install
npm run build
echo " TypeScript compiled successfully"

# ── Step 3: Copy frontend build into backend_ts/static ────────────────────────
echo ""
echo "▸ Step 3/4: Copying frontend build to backend_ts/static..."
cd ..
rm -rf backend_ts/static
cp -r frontend/dist backend_ts/static
echo " Static files copied"

# ── Step 4: Deploy to App Engine ─────────────────────────────────────────────
echo ""
echo "▸ Step 4/4: Deploying to App Engine..."
cd backend_ts
gcloud app deploy app.yaml --quiet
echo ""
echo "  Deployed successfully!"
echo ""

# ── Print the URL ────────────────────────────────────────────────────────────
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
echo "══════════════════════════════════════════════════════════"
echo "  app is live at:"
echo "  https://${PROJECT_ID}.appspot.com"
echo ""
echo "  If you don't see your latest changes: hard refresh"
echo "  (Ctrl+Shift+R or Cmd+Shift+R) or open in an incognito window."
echo "══════════════════════════════════════════════════════════"
