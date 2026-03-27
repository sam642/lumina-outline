#!/usr/bin/env bash

# Installation script for Lumina Outline inside a Debian-based LXC
# Run this inside your container.

set -e

# Update system
apt-get update && apt-get upgrade -y

# Install dependencies
apt-get install -y curl git build-essential

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Create application directory
mkdir -p /opt/lumina-outline
cd /opt/lumina-outline

# Clone the repository (User should replace this with their actual repo URL)
# For now, we'll assume the user will provide the source or we'll use a placeholder.
REPO_URL="https://github.com/USER/lumina-outline.git"

if [ ! -d ".git" ]; then
  git clone $REPO_URL .
fi

# Install and build
npm install
npm run build

# Create systemd service
cat <<EOF > /etc/systemd/system/lumina-outline.service
[Unit]
Description=Lumina Outline Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/lumina-outline
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable --now lumina-outline

echo "Lumina Outline is now running at http://$(hostname -I | awk '{print $1}'):3000"
