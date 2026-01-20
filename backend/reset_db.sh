#!/bin/bash
# Complete database reset - deletes everything including users
echo "⚠️  WARNING: This will delete ALL data including user accounts!"
read -p "Are you sure? (yes/no): " confirm
if [ "$confirm" = "yes" ]; then
    rm -f "$(dirname "$0")/game.db"
    echo "✅ Database deleted. Restart your backend server to recreate it."
else
    echo "❌ Cancelled."
fi
