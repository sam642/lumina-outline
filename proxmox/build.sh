#!/usr/bin/env bash

# Build script for Lumina Outline LXC
# This script runs inside the LXC container.

set -e

# Helper functions for colored output
function msg_info() {
  local msg="$1"
  echo -e "\e[34m[INFO]\e[0m ${msg}"
}

function msg_ok() {
  local msg="$1"
  echo -e "\e[32m[OK]\e[0m ${msg}"
}

function msg_error() {
  local msg="$1"
  echo -e "\e[31m[ERROR]\e[0m ${msg}"
}

msg_info "Updating system..."
apt-get update &>/dev/null
apt-get -y upgrade &>/dev/null
msg_ok "System updated"

msg_info "Installing dependencies..."
apt-get install -y curl git build-essential sudo &>/dev/null
msg_ok "Dependencies installed"

msg_info "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - &>/dev/null
apt-get install -y nodejs &>/dev/null
msg_ok "Node.js $(node -v) installed"

msg_info "Setting up application..."
mkdir -p /opt/lumina-outline
cd /opt/lumina-outline

# Clone the repository
REPO_URL="https://github.com/sam642/lumina-outline.git"

if [ ! -d ".git" ]; then
  msg_info "Cloning repository..."
  git clone $REPO_URL . &>/dev/null
fi

msg_info "Installing npm packages..."
npm install &>/dev/null
msg_ok "npm packages installed"

msg_info "Building application..."
npm run build &>/dev/null
msg_ok "Application built"

msg_info "Creating systemd service..."
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

systemctl daemon-reload
systemctl enable --now lumina-outline &>/dev/null
msg_ok "Lumina Outline service started"

msg_info "Cleaning up..."
apt-get autoremove -y &>/dev/null
apt-get autoclean -y &>/dev/null
msg_ok "Cleanup complete"

echo -e "\n\e[32mInstallation Successful!\e[0m"
echo -e "Lumina Outline is now running at http://$(hostname -I | awk '{print $1}'):3000\n"
