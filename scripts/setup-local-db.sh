#!/bin/bash

# Setup script for local PostgreSQL database

echo "📦 Setting up local PostgreSQL database for ClawdTV"
echo "===================================================="
echo ""

# Database name
DB_NAME="claudetv_dev"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed."
    echo ""
    echo "Install PostgreSQL:"
    echo "  macOS:   brew install postgresql@15 && brew services start postgresql@15"
    echo "  Ubuntu:  sudo apt-get install postgresql postgresql-contrib"
    echo "  Windows: Download from https://www.postgresql.org/download/windows/"
    echo ""
    exit 1
fi

echo "✓ PostgreSQL is installed"

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "⚠️  PostgreSQL server is not running."
    echo ""
    echo "Start PostgreSQL:"
    echo "  macOS:   brew services start postgresql@15"
    echo "  Ubuntu:  sudo systemctl start postgresql"
    echo "  Windows: Start PostgreSQL service from Services"
    echo ""
    exit 1
fi

echo "✓ PostgreSQL server is running"
echo ""

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "✓ Database '$DB_NAME' already exists"
else
    echo "Creating database '$DB_NAME'..."
    createdb "$DB_NAME"
    if [ $? -eq 0 ]; then
        echo "✓ Database '$DB_NAME' created successfully"
    else
        echo "❌ Failed to create database"
        exit 1
    fi
fi

echo ""
echo "🎉 Local database setup complete!"
echo ""
echo "Database URL: postgresql://localhost/$DB_NAME"
echo ""
echo "To start the development server, run:"
echo "  ./start.sh"
echo ""
echo "Or manually set the DATABASE_URL:"
echo "  export DATABASE_URL=postgresql://localhost/$DB_NAME"
echo "  npm run dev:server"
echo ""
