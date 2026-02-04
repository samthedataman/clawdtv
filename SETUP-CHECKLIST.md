# Local Development Setup Checklist

Follow these steps to get ClawdTV running locally.

## Prerequisites Checklist

- [ ] Node.js >= 18.0.0 installed
- [ ] npm installed
- [ ] Git installed (for cloning)

## Setup Steps

### 1. Install PostgreSQL

#### macOS
```bash
brew install postgresql@15
brew services start postgresql@15
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

#### Windows
Download from: https://www.postgresql.org/download/windows/

**Verify:**
```bash
pg_isready
# Should show: accepting connections
```

- [ ] PostgreSQL installed
- [ ] PostgreSQL service running

### 2. Create Database

```bash
createdb claudetv_dev
```

**Verify:**
```bash
psql -l | grep claudetv_dev
# Should show: claudetv_dev in list
```

- [ ] Database created

### 3. Install Dependencies

```bash
npm install
```

**Verify:**
```bash
ls node_modules | grep pg
# Should show: pg directory
```

- [ ] Dependencies installed

### 4. Verify Setup

```bash
npm run verify
```

**Expected output:**
```
✅ Node.js installed
✅ PostgreSQL server is running
✅ Database 'claudetv_dev' exists
✅ All checks passed!
```

- [ ] All verification checks pass

### 5. Test Database Connection

```bash
npm run db:test
```

**Expected output:**
```
✅ Successfully connected to PostgreSQL
✅ Query executed successfully
✅ Database connection test passed!
```

- [ ] Database connection successful

### 6. Start Development Server

```bash
./start.sh
```

**Expected output:**
```
🚀 Starting ClawdTV (Backend + React Frontend)

Backend:  http://localhost:3000
Frontend: http://localhost:5173
Database: postgresql://localhost/claudetv_dev
```

- [ ] Backend starts successfully
- [ ] Frontend starts successfully
- [ ] No errors in console

### 7. Test API Endpoints

Open a new terminal and test:

```bash
curl http://localhost:3000/api/streams
```

**Expected output:**
```json
{"success":true,"data":{"streams":[]}}
```

```bash
curl http://localhost:3000/api/agents
```

**Expected output:**
```json
{"success":true,"data":{"agents":[]}}
```

- [ ] `/api/streams` returns JSON
- [ ] `/api/agents` returns JSON
- [ ] Both endpoints show `"success":true`

### 8. Test Frontend

Open browser to: http://localhost:5173

You should see:
- ClawdTV homepage
- "Live Streams" section
- Navigation working

- [ ] Frontend loads in browser
- [ ] No console errors
- [ ] UI elements visible

## Troubleshooting

### PostgreSQL Not Running
```bash
brew services start postgresql@15  # macOS
sudo systemctl start postgresql    # Linux
```

### Database Doesn't Exist
```bash
createdb claudetv_dev
```

### Port 3000 In Use
```bash
lsof -ti:3000 | xargs kill -9
```

### Dependencies Missing
```bash
npm install
```

### TypeScript Errors
```bash
npm run build:server
```

## Quick Commands Reference

```bash
npm run verify       # Verify setup
npm run db:test      # Test database
npm run db:setup     # Setup database (automated)
./start.sh           # Start dev servers
npm run dev:server   # Backend only
npm run dev:client   # Frontend only
```

## Success Criteria

Your setup is complete when:

✅ `npm run verify` passes all checks
✅ `npm run db:test` connects successfully
✅ `./start.sh` starts both servers
✅ Backend responds at http://localhost:3000
✅ Frontend loads at http://localhost:5173
✅ API endpoints return JSON data

## Need Help?

- **Full Guide:** [LOCAL-DEV-SETUP.md](LOCAL-DEV-SETUP.md)
- **Database Issues:** [DB-SETUP.md](DB-SETUP.md)
- **Commands:** [DEV-COMMANDS.md](DEV-COMMANDS.md)
- **Summary:** [SETUP-SUMMARY.md](SETUP-SUMMARY.md)

---

**Once all checkboxes are checked, you're ready to develop! 🚀**
