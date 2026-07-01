#!/bin/bash

# ============================================================
# A.L.S — Advanced Local Storage
# Uninstall Script: uninstall.sh
# Description: Clean removal of A.L.S system
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  🗑️  A.L.S — Uninstall Script"
echo "=========================================="
echo ""

# ============================================================
# CONFIRMATION
# ============================================================

echo -e "${RED}⚠️  WARNING: This will permanently delete all A.L.S data!${NC}"
echo ""
echo -e "${YELLOW}This includes:${NC}"
echo "  • All uploaded files"
echo "  • All user accounts"
echo "  • All backups and versions"
echo "  • All configuration"
echo "  • All logs"
echo ""
echo -e "${RED}This action cannot be undone!${NC}"
echo ""

read -p "Are you sure you want to uninstall? (y/N): " confirm

if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}❌ Uninstall cancelled.${NC}"
    exit 0
fi

echo ""
read -p "Type 'DELETE' to confirm: " confirm2

if [[ "$confirm2" != "DELETE" ]]; then
    echo -e "${GREEN}❌ Uninstall cancelled.${NC}"
    exit 0
fi

# ============================================================
# STOP SERVICES
# ============================================================

echo -e "${BLUE}🛑 Stopping services...${NC}"

# Check if PM2 is running
if command -v pm2 &> /dev/null; then
    pm2 delete als 2>/dev/null || true
    pm2 save 2>/dev/null || true
fi

# Kill any node processes running in this directory
pkill -f "node.*server.js" 2>/dev/null || true

echo -e "${GREEN}✅ Services stopped${NC}"

# ============================================================
# BACKUP OPTION
# ============================================================

echo ""
read -p "Create backup before deletion? (y/N): " backupChoice

if [[ "$backupChoice" =~ ^[Yy]$ ]]; then
    BACKUP_DIR="../als_backup_$(date +%Y%m%d_%H%M%S)"
    echo -e "${BLUE}📦 Creating backup to ${BACKUP_DIR}...${NC}"
    
    mkdir -p "$BACKUP_DIR"
    cp -r database "$BACKUP_DIR/" 2>/dev/null || true
    cp -r systemdata "$BACKUP_DIR/" 2>/dev/null || true
    cp .env "$BACKUP_DIR/" 2>/dev/null || true
    cp package.json "$BACKUP_DIR/" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Backup created at ${BACKUP_DIR}${NC}"
fi

# ============================================================
# DELETE FILES
# ============================================================

echo -e "${BLUE}🗑️  Deleting files...${NC}"

# Delete directories
rm -rf database 2>/dev/null || true
rm -rf systemdata 2>/dev/null || true
rm -rf logs 2>/dev/null || true
rm -rf node_modules 2>/dev/null || true
rm -rf public 2>/dev/null || true

# Delete files
rm -f server.js 2>/dev/null || true
rm -f file.js 2>/dev/null || true
rm -f API.js 2>/dev/null || true
rm -f package.json 2>/dev/null || true
rm -f package-lock.json 2>/dev/null || true
rm -f .env 2>/dev/null || true
rm -f .gitignore 2>/dev/null || true
rm -f install.sh 2>/dev/null || true
rm -f uninstall.sh 2>/dev/null || true

echo -e "${GREEN}✅ Files deleted${NC}"

# ============================================================
# COMPLETION
# ============================================================

echo ""
echo "=========================================="
echo -e "${GREEN}✅ A.L.S Uninstalled Successfully!${NC}"
echo "=========================================="
echo ""
echo -e "${YELLOW}📝 Note:${NC}"
echo "  • All data has been permanently deleted"
echo "  • Backup was${backupChoice:-not} created"
echo "  • You can reinstall with: ./install.sh"
echo ""
echo -e "${CYAN}Thank you for using A.L.S!${NC}"
echo ""
