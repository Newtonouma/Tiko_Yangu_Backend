# Deployment Guide - Render.com

## Memory Error Fix

The "JavaScript heap out of memory" error occurs when Node.js runs out of RAM. We've fixed this by:

1. **Using pre-compiled JavaScript** instead of TypeScript compilation at runtime
2. **Limiting Node.js memory** to 512MB (suitable for Render's free tier)
3. **Disabling TypeORM sync** in production to reduce memory usage
4. **Optimizing database connection pooling**

## Deployment Steps

### 1. Prerequisites
- GitHub repository with your code
- Render.com account (free tier works)
- PostgreSQL database (use Render's free PostgreSQL or external provider)

### 2. Database Setup

**Option A: Render PostgreSQL (Recommended)**
1. Go to Render Dashboard → New → PostgreSQL
2. Create a free PostgreSQL instance
3. Copy the connection details (Internal Database URL)

**Option B: External PostgreSQL (Supabase, Neon, etc.)**
1. Create a PostgreSQL database on your preferred provider
2. Note the connection details

### 3. Deploy Backend on Render

#### Method 1: Using render.yaml (Automatic)
1. Push your code to GitHub
2. In Render Dashboard → New → Blueprint
3. Connect your repository
4. Render will detect `render.yaml` and configure automatically
5. Set environment variables (see below)

#### Method 2: Manual Setup
1. In Render Dashboard → New → Web Service
2. Connect your GitHub repository
3. Configure:
   - **Name**: tikoyangu-backend
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Plan**: Starter (Free - 512MB RAM)

### 4. Environment Variables

Set these in Render Dashboard → Environment:

```bash
# Node Environment
NODE_ENV=production
PORT=3000

# Database (from your PostgreSQL instance)
DB_HOST=<your-db-host>
DB_PORT=5432
DB_USERNAME=<your-db-username>
DB_PASSWORD=<your-db-password>
DB_NAME=<your-db-name>

# JWT Secret (auto-generated or custom)
JWT_SECRET=<generate-a-secure-random-string>

# Supabase (for image uploads)
SUPABASE_URL=https://dcnsjnstunostfygblql.supabase.co
SUPABASE_API_KEY=<your-supabase-key>
SUPABASE_BUCKET=uploads

# Email Configuration (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-gmail-address>
SMTP_PASS=<your-gmail-app-password>
SMTP_FROM=<your-gmail-address>
EMAIL_USER=<your-gmail-address>
EMAIL_PASS=<your-gmail-app-password>
EMAIL_FROM_NAME=Tikoyangu

# M-Pesa Configuration
MPESA_CONSUMER_KEY=<your-mpesa-consumer-key>
MPESA_CONSUMER_SECRET=<your-mpesa-consumer-secret>
MPESA_SHORTCODE=<your-paybill-number>
MPESA_PASSKEY=<your-mpesa-passkey>
MPESA_CALLBACK_URL=https://your-backend-url.onrender.com/mpesa/callback

# Frontend URL (for CORS and email links)
FRONTEND_URL=https://your-frontend-url.vercel.app
```

### 5. Important Notes

#### Database Migration
Since `synchronize: true` is disabled in production:
- Run migrations manually before first deploy
- Or enable sync temporarily for initial setup, then disable

```bash
# If using synchronize temporarily
# Set: NODE_ENV=development in Render (one time)
# Deploy and let TypeORM create tables
# Then set back to: NODE_ENV=production
```

#### Memory Optimization
- The `--max-old-space-size=512` flag limits Node.js to 512MB
- This matches Render's free tier (512MB RAM)
- For paid plans with more RAM, increase this value:
  - Starter: `--max-old-space-size=512`
  - Standard: `--max-old-space-size=2048`
  - Pro: `--max-old-space-size=4096`

#### Port Configuration
- Render automatically sets the `PORT` environment variable
- Our app.module.ts uses `process.env.PORT || 3000`
- No code changes needed

### 6. Post-Deployment

1. **Verify deployment**: Check Render logs for "Backend server running on port 3000"
2. **Test endpoints**: 
   ```bash
   curl https://your-app.onrender.com/
   ```
3. **Update CORS**: Ensure your frontend URL is in CORS whitelist (main.ts)
4. **Update M-Pesa callback**: Set correct callback URL in M-Pesa portal

### 7. Frontend Deployment (Vercel/Netlify)

Update frontend `.env.local`:
```bash
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

### 8. Troubleshooting

**Memory errors persist?**
- Upgrade to Render Starter+ plan (1GB RAM)
- Increase memory limit: `--max-old-space-size=1024`

**Database connection fails?**
- Check if DB_HOST is correct (use internal URL if on Render)
- Verify database is running and credentials are correct
- Check if database allows external connections

**Build fails?**
- Ensure `dist` folder is not in .gitignore
- Check that all dependencies are in `dependencies`, not `devDependencies`

**TypeORM sync issues?**
- For first deploy, temporarily set `NODE_ENV=development`
- Let TypeORM create tables
- Then switch to `NODE_ENV=production`
- Or create migrations properly

## Production Checklist

- [ ] Database created and connection tested
- [ ] All environment variables set in Render
- [ ] JWT_SECRET is strong and random
- [ ] SMTP credentials are valid (test with Gmail)
- [ ] M-Pesa callback URL updated in Safaricom portal
- [ ] Frontend CORS origin added to backend
- [ ] TypeORM synchronize disabled (`NODE_ENV=production`)
- [ ] Build and start commands are correct
- [ ] Logs show successful startup
- [ ] API endpoints respond correctly
- [ ] Frontend can connect to backend

## Monitoring

**Render Dashboard provides:**
- Real-time logs
- Resource usage (CPU/Memory)
- Deployment history
- Automatic restarts on crashes

**Set up alerts for:**
- High memory usage (>90%)
- Application crashes
- Failed deployments

## Scaling

**Free Tier Limitations:**
- 512MB RAM
- Sleeps after 15 minutes of inactivity
- Cold starts (15-30 seconds)

**Upgrade if you need:**
- Always-on service
- More RAM/CPU
- Custom domains
- Background workers
