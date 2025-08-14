# 🚀 Deploy Noderr for Remote Access

## Quick Deploy (5 minutes)

### Option 1: Vercel + Railway (Recommended - Free)

#### Step 1: Deploy Frontend to Vercel
```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Deploy frontend (run from repo root)
vercel --prod

# Follow prompts:
# - Link to existing project: N
# - Project name: noderr-ui (or your choice)
# - Deploy docs directory: Y
```

#### Step 2: Deploy Backend to Railway
1. Go to [railway.app](https://railway.app)
2. Connect your GitHub account
3. Click "Deploy from GitHub repo"
4. Select this repository
5. Railway will auto-detect Node.js and deploy

**Your app will be live at:**
- Frontend: `https://noderr-ui.vercel.app`
- Backend: `https://your-app.railway.app`

---

### Option 2: Netlify (Drag & Drop - 30 seconds)

#### Frontend Only (Simple Demo)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the `docs` folder from your file explorer
3. **Done!** Your app is live instantly

---

### Option 3: Full Stack on Render (Free)

#### Deploy Both Frontend + Backend
1. Go to [render.com](https://render.com)
2. Connect GitHub
3. Click "New Web Service"
4. Select this repo
5. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `node instant-backend.js`
   - **Environment**: Add `PORT=10000`

Render will serve both frontend and backend from one URL.

---

## Production Deploy with Real Database

### Deploy to Fly.io + Vercel (Production-Ready)

#### Backend to Fly.io
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login to Fly.io
fly auth login

# Deploy backend
fly deploy

# Your backend will be at: https://your-app.fly.dev
```

#### Frontend to Vercel
```bash
# Update API URL in docs/deploy-config.js
# Change API_BASE_URL to your Fly.io URL
vercel --prod
```

---

## Environment Variables

For production deployments, set these environment variables:

```bash
# Required
PORT=3000

# Optional (for enhanced features)
OPENAI_API_KEY=your_openai_key
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

---

## Quick Test After Deployment

1. Go to your deployed URL
2. Click "🧠 Brainstorm" tab
3. Type: "Add user authentication"
4. Watch it generate 25+ detailed tasks
5. Click "📤 Export to Kanban"

---

## Troubleshooting

### Frontend not loading?
- Check `docs/deploy-config.js` has correct API URL
- Ensure CORS is enabled on backend

### Backend not working?
- Check environment variables
- Ensure PORT is set correctly
- Check logs in hosting platform

### Tasks not exporting?
- Ensure frontend can reach backend API
- Check browser network tab for errors

---

## Cost Breakdown

| Service | Frontend | Backend | Database | Total |
|---------|----------|---------|----------|-------|
| **Free Tier** | Vercel/Netlify | Railway/Render | In-memory | $0/month |
| **Hobby** | Vercel Pro | Railway Pro | PostgreSQL | $25/month |
| **Production** | Vercel | Fly.io | Managed DB | $50/month |

The free tier is perfect for testing and personal use!