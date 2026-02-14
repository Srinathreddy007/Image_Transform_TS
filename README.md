# Image Transformation Service

A full stack TypeScript application that lets users **upload an image**, **remove its background**, **flip it horizontally**, **optimize it**, and **host the result online** with a shareable URL.

---

## Live Demo

**Live app:** [https://image-transform-svc.appspot.com](https://image-transform-svc.appspot.com)

---

## Features

| Feature | Detail |
|---|---|
| **Background Removal** | Third-party integration with [remove.bg](https://www.remove.bg/api) API (50 free calls/month) |
| **Horizontal Flip** | Local processing with Sharp |
| **Image Optimization** | Automatic resizing (max 1920px) and compression for faster loading |
| **Cloud Hosting** | Processed images uploaded to [ImgBB](https://api.imgbb.com) — each image gets a unique public URL |
| **Image Deletion** | Delete hosted images via the UI or API |
| **Polished UI** | Dark elegant theme, loading states, toast notifications, animations |
| **Pagination** | Gallery shows 6 images per page (latest first); API supports `?page` and `?limit` |
| **Fast Image Loading** | Optimized loading with eager loading and preloading for newly uploaded images |
| **Upload limit** | 10 MB max per image (balance of quality, processing time, and remove.bg compatibility; configurable via `MAX_FILE_SIZE_MB`) |
| **Resolution** | 0.25–50 megapixels (e.g. 500×500 to 8000×6250); aligned with [remove.bg](https://www.remove.bg/api) limits,  configurable via `MIN_IMAGE_PIXELS` / `MAX_IMAGE_PIXELS` |
| **Formats** | PNG, JPEG, WebP only |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React + Vite + TypeScript |
| **Backend** | Node.js, Express, TypeScript |
| **Image Processing** | Sharp (horizontal flip, optimization, compression) |
| **Background Removal** | remove.bg REST API |
| **Cloud Storage** | ImgBB API |
| **Secrets Management** | Google Cloud Secret Manager (production) |
| **Deployment** | Google Cloud App Engine |

---

## Why These Third Party APIs?

### Background removal: remove.bg

- **Why over others:** Background removal is hard to do well in house. remove.bg offers a single REST call, clear docs and consistent quality for people, products and animals. Alternatives (e.g. [rembg](https://github.com/danielgatis/rembg) self-hosted, or other SaaS) either need more infra and tuning or similar API cost.
- **Why over self hosted models:** Running our own model (e.g. U² Net) would need GPU/compute, more code, and maintenance. remove.bg’s free tier (50 calls/month) is enough for light use without that overhead.

### Image hosting: ImgBB

- **Why over others:** We need a public URL for each processed image. ImgBB’s free API has no strict rate limit, needs only an API key and returns a permanent URL plus a delete link. No buckets, CORS or IAM to configure.
- **Trade off:** ImgBB has no “list my images” or “delete by ID” only the delete URL returned at upload. That’s why we keep a local registry (file or DB) mapping our IDs to ImgBB’s URLs and delete links.
- **Duplicate uploads:** Uploading the same image twice can result in the same ImgBB URL/delete link (ImgBB may deduplicate by content). The app uses reference counting: we only call the delete URL when the last registry entry for that URL is removed, so deleting one "copy" in the UI does not remove the image for the other.
- **Why not S3/GCS here:** For a small app, Google Cloud Storage would require buckets, CORS and often signed URLs or auth. ImgBB keeps setup minimal while still giving shareable links.

## Scaling: What to Use Instead

If we outgrow the current setup, we can swap services without changing the rest of the app much; the backend already isolates them in `backgroundRemoval.ts` and `cloudStorage.ts`.

### Background removal (higher volume / lower cost)

| Option | When to consider |
|--------|------------------|
| **remove.bg paid** | More than 50 calls/month; keep same API, higher limits. |
| **Self-hosted model (e.g. rembg, U²-Net)** | Many requests; you run the model on your own GPU/CPU and pay for compute instead of per call. |
| **Other SaaS (e.g. Cloudinary AI, dedicated ML APIs)** | Need different quality/SLA or multi region so evaluate per call vs fixed cost. |

### Image storage (listing, durability, control)

| Option | When to consider |
|--------|------------------|
| **Google Cloud Storage (GCS)** | Already on GCP and it need stable listing, delete-by-id and no dependency on a third-party free tier. Replace `cloudStorage.ts` with GCS client and store metadata (and optional delete tokens) in a DB. |
| **AWS S3** | Same idea on AWS. We use S3 client, optional CloudFront for CDN. |
| **Cloudinary** | Need transforms/CDN and a single API for upload, list and delete; good fit if you want more image APIs in one place. |

In all cases, keep the same app flow (upload → process → store → return URL); only the implementations of `removeBackground()` and `uploadImage` / `listImages` / `deleteImage` need to change.

---

## Project Structure

```
Image_Transform_TS/
├── backend_ts/
│   ├── src/
│   │   ├── config.ts              # Centralised settings & Secret Manager integration
│   │   ├── server.ts              # Express server entry point
│   │   ├── app.ts                 # Express app factory, CORS, static serving
│   │   ├── models/
│   │   │   └── schemas.ts         # TypeScript interfaces for API responses
│   │   ├── routes/
│   │   │   └── images.ts          # POST/GET/DELETE /api/images endpoints
│   │   ├── services/
│   │   │   ├── backgroundRemoval.ts    # remove.bg API integration
│   │   │   ├── cloudStorage.ts        # ImgBB upload/list/delete + local registry
│   │   │   └── imageProcessing.ts      # Sharp horizontal flip & optimization
│   │   ├── middleware/
│   │   │   └── errorHandler.ts    # Centralized error handling
│   │   └── utils/
│   │       └── HttpError.ts       # Custom HTTP error class
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example               # Template for environment variables
│   ├── .gcloudignore              # Files to exclude from deployment
│   └── app.yaml                   # GCP App Engine config
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Main app with upload + gallery
│   │   ├── api.ts                 # API client functions
│   │   ├── types.ts               # TypeScript type definitions
│   │   ├── components/
│   │   │   ├── UploadZone.tsx     # Drag and drop upload area
│   │   │   ├── ImageGallery.tsx   # Grid of processed images
│   │   │   └── ImageCard.tsx      # Individual image card with actions
│   │   └── index.css              # Global styles
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── deploy_ts.sh                   # One command build & deploy script
├── package.json                   # Root package.json with convenience scripts
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/images` | Upload image → remove background → flip → optimize → host → return URL |
| `GET` | `/api/images` | List processed images (paginated, latest first). Query: `?page=1&limit=6` (defaults: page 1, limit 6). Response: `{ count, total, images }`. |
| `DELETE` | `/api/images/{id}` | Delete a processed image from cloud storage |
| `GET` | `/api/health` | Health check |

---

## Getting Started

### Prerequisites

- **Node.js 20+** and npm
- API keys for [remove.bg](https://www.remove.bg/api) and [ImgBB](https://api.imgbb.com)

### 1. Clone the repo

```bash
git clone https://github.com/Srinathreddy007/Image_Transform_TS.git
cd Image_Transform_TS
```

### 2. Install dependencies

From the root directory:

```bash
npm run install:all
```

Or install separately:

```bash
# Backend dependencies
cd backend_ts
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### 3. Backend setup

```bash
cd backend_ts

# Configure environment variables
cp .env.example .env
# Edit .env and add your actual API keys:
#   REMOVE_BG_API_KEY=your_key_here
#   IMGBB_API_KEY=your_key_here
#   ENVIRONMENT=development

# Start the backend (development mode with hot-reload)
npm run dev
```

The API will be available at **http://localhost:8000** (or the port in `backend_ts/.env`).

### 4. Frontend setup

```bash
cd frontend

# Start the dev server
npm run dev
```

The frontend will be available at **http://localhost:5173** (default Vite port).

### 5. Run both together

From the root directory:

```bash
# Run both frontend and backend simultaneously
npm run dev:all
```

---

## Available Scripts

### Root Level

| Script | Description |
|---|---|
| `npm run dev` | Run backend dev server |
| `npm run dev:frontend` | Run frontend dev server |
| `npm run dev:backend` | Run backend dev server |
| `npm run dev:all` | Run both frontend and backend simultaneously |
| `npm run build` | Build both frontend and backend |
| `npm run build:frontend` | Build only frontend |
| `npm run build:backend` | Build only backend |
| `npm run start` | Start production backend server |
| `npm run lint` | Lint frontend code |
| `npm run deploy` | Run deployment script |

### Backend (`backend_ts/`)

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot-reload (tsx watch) |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start production server |

### Frontend (`frontend/`)

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

---

## Deployment (Google Cloud App Engine)

### Prerequisites

1. Install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. Authenticate: `gcloud auth login`
3. Set your project: `gcloud config set project YOUR_PROJECT_ID`
4. Create secrets in Secret Manager:
   ```bash
   echo -n "your_remove_bg_api_key" | gcloud secrets create REMOVE_BG_API_KEY --data-file=-
   echo -n "your_imgbb_api_key" | gcloud secrets create IMGBB_API_KEY --data-file=-
   ```

### Deploy

Run the deploy script:

```bash
chmod +x deploy_ts.sh
./deploy_ts.sh
```

Or use npm:

```bash
npm run deploy
```

This script:
1. Builds the React frontend
2. Compiles the TypeScript backend
3. Copies the frontend build into `backend_ts/static/`
4. Deploys everything to App Engine

---

## Environment Variables

### Development

Create `backend_ts/.env` file:

| Variable | Description | Required |
|---|---|---|
| `REMOVE_BG_API_KEY` | remove.bg API key (50 free calls/month) | Yes |
| `IMGBB_API_KEY` | ImgBB API key (free, no strict limit) | Yes |
| `ENVIRONMENT` | `development` or `production` | No (defaults to `development`) |
| `PORT` | Server port | No (defaults to 8000) |
| `MAX_FILE_SIZE_MB` | Max upload size in MB | No (defaults to 10) |
| `MIN_IMAGE_PIXELS` | Min resolution (width×height), e.g. 250000 for 0.25 MP | No (defaults to 250000) |
| `MAX_IMAGE_PIXELS` | Max resolution (width×height), e.g. 50000000 for 50 MP | No (defaults to 50000000) |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | No (defaults to `http://localhost:5173`) |

### Production (App Engine)

Secrets are automatically loaded from Google Cloud Secret Manager:
- `REMOVE_BG_API_KEY` - Retrieved from Secret Manager
- `IMGBB_API_KEY` - Retrieved from Secret Manager
- `ENVIRONMENT` - Set to `production` in `app.yaml`

---

## How It Works

```
User uploads image
        │
        ▼
  ┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
  │  remove.bg   │ ──▶ │ Sharp Flip   │ ──▶ │ Optimize     │ ──▶ │   ImgBB     │
  │  (bg removal)│     │ (horizontal) │     │ (resize &    │     │  (hosting)  │
  │              │     │              │     │  compress)   │     │             │
  └─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
                                                                        │
                                                                        ▼
                                                                Public URL returned
                                                                to user in the UI
```

### Processing Pipeline

1. **Background Removal**: Image sent to remove.bg API to remove background
2. **Horizontal Flip**: Image flipped horizontally using Sharp
3. **Optimization**: Image resized (max 1920px) and compressed for faster loading
4. **Cloud Upload**: Processed image uploaded to ImgBB
5. **URL Return**: Public URL returned to frontend and displayed immediately

---

## Performance Optimizations

- **Image Optimization**: Automatic resizing and compression before upload
- **Eager Loading**: Newly uploaded images load immediately (no lazy loading delay)
- **Preloading**: Images preloaded immediately after receiving URL
- **Fetch Priority**: High priority for newly uploaded images
- **Compression**: PNG compression with quality optimization (85% quality, level 9)

---

