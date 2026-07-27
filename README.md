# PrintDrop 🖨️

> Auto-print platform for Indian print shops. Customer scans QR → uploads → pays UPI → printer fires automatically.

---

## Project Structure

```
printdrop/
├── backend/          ← Node.js + Express API
├── frontend/         ← React app (shopkeeper + customer)
└── pc-agent/         ← Python script on shopkeeper's PC
```

---

## Quick Start (Local Dev)

### 1. Backend

```bash
cd backend
cp .env.example .env        # fill in your values
npm install
npx prisma db push          # create DB tables (needs DATABASE_URL set)
npm run dev                 # runs on port 4000
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                 # runs on port 5173
```

### 3. PC Agent (shopkeeper's PC)

```bash
cd pc-agent
pip install requests schedule pywin32

# Edit config.env with your shop ID + server URL
# Then:
python agent.py
```

---

## Environment Variables

### Backend `.env`

| Key | Description |
|-----|-------------|
| `DATABASE_URL` | PostgreSQL URL (Supabase / Neon free tier) |
| `JWT_SECRET` | Any long random string |
| `RAZORPAY_KEY_ID` | From Razorpay dashboard |
| `RAZORPAY_KEY_SECRET` | From Razorpay dashboard |
| `AGENT_SECRET` | Random string shared with PC agent |

### Frontend `.env`

| Key | Description |
|-----|-------------|
| `VITE_API_URL` | Backend URL e.g. `https://your-app.railway.app/api` |

---

## Free Hosting Plan

| Part | Platform | Cost |
|------|----------|------|
| Frontend | Vercel | Free |
| Backend | Railway / Render | Free tier |
| Database | Supabase / Neon | Free tier |
| Files | Stored on server, auto-deleted | Free |

### Deploy Frontend (Vercel)

```bash
cd frontend
npm run build
# push to GitHub → import in vercel.com → set VITE_API_URL
```

### Deploy Backend (Railway)

1. Push backend folder to GitHub
2. Import in railway.app
3. Set all env variables
4. Deploy

---

## Auto File Deletion

Files are auto-deleted in two ways:

1. **After print** — deleted 30 minutes after `printedAt`
2. **Safety net** — any file older than 2 hours deleted regardless of status

Cron job runs every 10 minutes on the server. Zero manual work.

---

## PC Agent Setup for Shopkeeper

1. Download `agent.py` and `config.env` from your dashboard
2. Edit `config.env`:
   - Paste Shop ID (from dashboard)
   - Paste Agent Secret (from dashboard)
   - Set printer names (exact Windows name)
3. Run: `python agent.py`
4. Or build exe: `pyinstaller --onefile --noconsole agent.py`

Agent polls server every 5 seconds. On new paid job:
- Downloads file to temp folder
- Sends to correct printer
- Marks order as PRINTED
- Deletes temp file

---

## Customer Flow

1. Customer scans QR on shop wall
2. Opens `yourapp.vercel.app/shop/SHOP_ID`
3. Uploads PDF/DOCX/image
4. Selects color or B&W, copies
5. Pays via Razorpay (GPay/PhonePe/UPI/Card)
6. Status page shows: Paid → Printing → Done ✓
7. Printer fires automatically
8. Shopkeeper hands over print

---

## Razorpay Setup

1. Register at razorpay.com
2. Complete KYC (PAN card sufficient to start)
3. Get API keys from Dashboard → Settings → API Keys
4. Use test keys first (`rzp_test_xxx`)
5. Go live after testing

---

## Build .exe for PC Agent

```bash
pip install pyinstaller
cd pc-agent
pyinstaller --onefile --noconsole agent.py
# dist/agent.exe → give to shopkeeper
```

---

## Pricing Strategy

| Plan | Price | Features |
|------|-------|---------|
| Starter | ₹499/mo | 1 shop, unlimited orders |
| Growth | ₹999/mo | 3 shops |
| Pro | ₹1999/mo | Unlimited shops + analytics |

Or one-time: ₹3000 setup + ₹299/mo maintenance.

---

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Prisma ORM
- **Database**: PostgreSQL (Supabase/Neon)
- **Payments**: Razorpay (UPI/GPay/Cards)
- **PC Agent**: Python + win32print
- **Auth**: JWT tokens

---

Built with ❤️ for Indian print shop owners.
