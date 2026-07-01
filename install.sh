#!/bin/bash

# ============================================================
# A.L.S — Advanced Local Storage
# Install Script: install.sh
# Description: One-click setup for A.L.S system
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo "  ✨ A.L.S — Advanced Local Storage"
echo "  Installation Script v1.0.0"
echo "=========================================="
echo ""

# ============================================================
# CHECK SYSTEM REQUIREMENTS
# ============================================================

echo -e "${BLUE}📋 Checking system requirements...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found.${NC}"
    echo -e "${YELLOW}Please install Node.js 18+ and try again.${NC}"
    echo -e "  Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version $NODE_VERSION detected.${NC}"
    echo -e "${YELLOW}Please upgrade to Node.js 18+${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js v$(node -v) detected${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm v$(npm -v) detected${NC}"

# Check disk space (minimum 1GB free)
if command -v df &> /dev/null; then
    FREE_SPACE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
    if [ "$FREE_SPACE" -lt 1 ]; then
        echo -e "${YELLOW}⚠️  Low disk space: ${FREE_SPACE}GB free. Minimum 1GB recommended.${NC}"
    else
        echo -e "${GREEN}✅ Disk space: ${FREE_SPACE}GB free${NC}"
    fi
fi

echo ""

# ============================================================
# CREATE DIRECTORY STRUCTURE
# ============================================================

echo -e "${BLUE}📁 Creating directory structure...${NC}"

mkdir -p public
mkdir -p database/system
mkdir -p database/users
mkdir -p database/megaverses
mkdir -p database/uploads
mkdir -p systemdata
mkdir -p logs

echo -e "${GREEN}✅ Directory structure created${NC}"

# ============================================================
# INSTALL DEPENDENCIES
# ============================================================

echo -e "${BLUE}📦 Installing dependencies...${NC}"
echo ""

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found.${NC}"
    exit 1
fi

npm install --production --no-audit --no-fund

echo ""
echo -e "${GREEN}✅ Dependencies installed${NC}"

# ============================================================
# CREATE INITIAL CONFIGURATION
# ============================================================

echo -e "${BLUE}⚙️  Creating initial configuration...${NC}"

# System config
cat > database/system/config.json << EOF
{
  "system_name": "A.L.S",
  "version": "1.0.0",
  "created_at": "$(date -Iseconds)",
  "admin_email": null,
  "max_file_size": 104857600,
  "allowed_mime_types": [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/json",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "video/mp4",
    "video/webm",
    "audio/mpeg",
    "audio/wav"
  ],
  "default_quota": 10737418240,
  "backup_retention": 100,
  "session_timeout_hours": 24,
  "otp_expiry_minutes": 5
}
EOF

# Sessions
cat > database/system/sessions.json << EOF
{
  "sessions": []
}
EOF

# Users
cat > database/users/users.json << EOF
{
  "users": []
}
EOF

# Megaverses index
cat > database/megaverses/_index.json << EOF
{
  "megaverses": []
}
EOF

# Activity log
cat > systemdata/activity.log.json << EOF
{
  "activities": []
}
EOF

# OTP store
cat > systemdata/otp.store.json << EOF
{
  "otps": []
}
EOF

echo -e "${GREEN}✅ Configuration created${NC}"

# ============================================================
# CREATE .env FILE
# ============================================================

if [ ! -f ".env" ]; then
    echo -e "${BLUE}🔐 Creating .env file...${NC}"
    
    cat > .env << EOF
# A.L.S — Environment Configuration
# Generated: $(date)

# Server
PORT=3000
HOST=0.0.0.0

# Email (OTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
SMTP_FROM_NAME=A.L.S System

# Download
DOWNLOAD_TIMEOUT=30000
DOWNLOAD_MAX_SIZE=104857600

# Security
SESSION_TIMEOUT_HOURS=24
OTP_EXPIRY_MINUTES=5
EOF
    
    echo -e "${YELLOW}⚠️  Please edit .env file with your email credentials!${NC}"
    echo -e "${GREEN}✅ .env file created${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# ============================================================
# SET PERMISSIONS
# ============================================================

echo -e "${BLUE}🔧 Setting permissions...${NC}"

chmod +x server.js
chmod +x install.sh
chmod +x uninstall.sh

# Make database directories writable
chmod -R 755 database 2>/dev/null || true
chmod -R 755 systemdata 2>/dev/null || true
chmod -R 755 logs 2>/dev/null || true

echo -e "${GREEN}✅ Permissions set${NC}"

# ============================================================
# CREATE .gitignore
# ============================================================

if [ ! -f ".gitignore" ]; then
    cat > .gitignore << EOF
# A.L.S — Git Ignore

# Dependencies
node_modules/
package-lock.json

# Database
database/uploads/
database/*.tmp
database/**/*.tmp

# System data
systemdata/*.tmp
logs/
*.log

# Environment
.env
.env.local
.env.production

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Backup
*.backup
*.bak
EOF
    echo -e "${GREEN}✅ .gitignore created${NC}"
fi

# ============================================================
# SHOW COMPLETION
# ============================================================

echo ""
echo "=========================================="
echo -e "${GREEN}✅ A.L.S Installation Complete!${NC}"
echo "=========================================="
echo ""
echo -e "${CYAN}📁 Installation Directory:${NC} $(pwd)"
echo ""
echo -e "${CYAN}🚀 To start the server:${NC}"
echo "  npm start"
echo "  # or"
echo "  node server.js"
echo ""
echo -e "${CYAN}🌐 Access the system:${NC}"
echo "  http://localhost:3000"
echo "  https://data.ailifesolution.com"
echo ""
echo -e "${CYAN}📖 Documentation:${NC}"
echo "  http://localhost:3000/"
echo ""
echo -e "${CYAN}🔐 Login:${NC}"
echo "  http://localhost:3000/auth.html"
echo ""
echo -e "${YELLOW}⚠️  Next steps:${NC}"
echo "  1. Edit .env with your email credentials"
echo "  2. Start the server: npm start"
echo "  3. Visit http://localhost:3000"
echo ""
echo -e "${CYAN}👑 First user will become admin automatically!${NC}"
echo ""
echo "=========================================="
