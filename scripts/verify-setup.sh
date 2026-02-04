#!/bin/bash

# Comprehensive setup verification script for ClawdTV

echo "🔍 ClawdTV Setup Verification"
echo "=============================="
echo ""

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check function
check() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✅ $2${NC}"
  else
    echo -e "${RED}❌ $2${NC}"
    ERRORS=$((ERRORS + 1))
  fi
}

warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
  WARNINGS=$((WARNINGS + 1))
}

# 1. Check Node.js
echo "📦 Checking Node.js..."
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v)
  check 0 "Node.js installed: $NODE_VERSION"

  # Check if version is >= 18
  MAJOR_VERSION=$(node -v | cut -d. -f1 | tr -d 'v')
  if [ "$MAJOR_VERSION" -ge 18 ]; then
    check 0 "Node.js version >= 18"
  else
    check 1 "Node.js version >= 18 (current: $NODE_VERSION, required: >= 18)"
  fi
else
  check 1 "Node.js installed"
  echo "   Install from: https://nodejs.org/"
fi

echo ""

# 2. Check npm
echo "📦 Checking npm..."
if command -v npm &> /dev/null; then
  NPM_VERSION=$(npm -v)
  check 0 "npm installed: $NPM_VERSION"
else
  check 1 "npm installed"
fi

echo ""

# 3. Check PostgreSQL
echo "🗄️  Checking PostgreSQL..."
if command -v psql &> /dev/null; then
  PG_VERSION=$(psql --version | awk '{print $3}')
  check 0 "PostgreSQL client installed: $PG_VERSION"
else
  check 1 "PostgreSQL client installed"
  echo "   Install with: brew install postgresql@15 (macOS)"
  echo "               sudo apt install postgresql (Ubuntu)"
fi

# Check if PostgreSQL is running
if command -v pg_isready &> /dev/null; then
  if pg_isready -q; then
    check 0 "PostgreSQL server is running"
  else
    check 1 "PostgreSQL server is running"
    echo "   Start with: brew services start postgresql@15 (macOS)"
    echo "              sudo systemctl start postgresql (Linux)"
  fi
fi

echo ""

# 4. Check database exists
echo "🗄️  Checking database..."
if command -v psql &> /dev/null && pg_isready -q; then
  if psql -lqt | cut -d \| -f 1 | grep -qw claudetv_dev; then
    check 0 "Database 'claudetv_dev' exists"
  else
    check 1 "Database 'claudetv_dev' exists"
    echo "   Create with: createdb claudetv_dev"
  fi
fi

echo ""

# 5. Check project dependencies
echo "📦 Checking project dependencies..."
if [ -d "node_modules" ]; then
  check 0 "node_modules directory exists"
else
  check 1 "node_modules directory exists"
  echo "   Run: npm install"
fi

# Check for critical dependencies
if [ -f "package.json" ]; then
  if [ -d "node_modules/pg" ]; then
    check 0 "PostgreSQL driver (pg) installed"
  else
    warn "PostgreSQL driver (pg) not found - run: npm install"
  fi

  if [ -d "node_modules/fastify" ]; then
    check 0 "Fastify installed"
  else
    warn "Fastify not found - run: npm install"
  fi

  if [ -d "node_modules/react" ]; then
    check 0 "React installed"
  else
    warn "React not found - run: npm install"
  fi
fi

echo ""

# 6. Check configuration files
echo "⚙️  Checking configuration..."
if [ -f ".env" ]; then
  check 0 ".env file exists"
else
  warn ".env file not found (optional for local dev)"
fi

if [ -f ".env.local" ]; then
  check 0 ".env.local file exists"
else
  warn ".env.local file not found (using defaults)"
fi

if [ -f "start.sh" ]; then
  check 0 "start.sh script exists"
  if [ -x "start.sh" ]; then
    check 0 "start.sh is executable"
  else
    warn "start.sh is not executable - run: chmod +x start.sh"
  fi
else
  check 1 "start.sh script exists"
fi

echo ""

# 7. Check database schema
echo "🗄️  Checking database schema..."
if [ -f "db/schema-pg.sql" ]; then
  check 0 "PostgreSQL schema file exists"
else
  check 1 "PostgreSQL schema file exists"
fi

echo ""

# 8. Check TypeScript compilation
echo "📝 Checking TypeScript..."
if [ -f "tsconfig.json" ]; then
  check 0 "TypeScript config exists"
else
  warn "TypeScript config not found"
fi

echo ""

# 9. Test database connection
echo "🔌 Testing database connection..."
if command -v node &> /dev/null && [ -f "scripts/test-db-connection.js" ]; then
  if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="postgresql://localhost/claudetv_dev"
  fi

  # Run database connection test with timeout
  if timeout 5 node scripts/test-db-connection.js > /dev/null 2>&1; then
    check 0 "Database connection successful"
  else
    warn "Database connection failed - see scripts/test-db-connection.js for details"
  fi
fi

echo ""
echo "=============================="
echo "📊 Summary"
echo "=============================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed!${NC}"
  echo ""
  echo "You're ready to start development:"
  echo "  ./start.sh"
  echo ""
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Setup complete with $WARNINGS warning(s)${NC}"
  echo ""
  echo "You can still start development:"
  echo "  ./start.sh"
  echo ""
  echo "Review warnings above and fix if needed."
  exit 0
else
  echo -e "${RED}❌ Setup incomplete: $ERRORS error(s), $WARNINGS warning(s)${NC}"
  echo ""
  echo "Fix the errors above before starting development."
  echo ""
  echo "Quick fixes:"
  echo "  - Install PostgreSQL: brew install postgresql@15"
  echo "  - Start PostgreSQL: brew services start postgresql@15"
  echo "  - Create database: createdb claudetv_dev"
  echo "  - Install dependencies: npm install"
  echo ""
  echo "For detailed help, see: LOCAL-DEV-SETUP.md"
  exit 1
fi
