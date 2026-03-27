#!/usr/bin/env bash

# Proxmox LXC Creation Script for Lumina Outline
# Run this on your Proxmox host.

set -e

# Default settings
CTID=$(pvesh get /cluster/nextid)
HOSTNAME="lumina-outline"
DISK_SIZE="8G"
CORES="1"
RAM="512"
BRIDGE="vmbr0"
GATEWAY=""
IP="dhcp"
STORAGE="local-lvm"

echo "Creating Lumina Outline LXC Container (ID: $CTID)..."

# Download Debian 12 template if not exists
TEMPLATE_STORAGE="local"
TEMPLATE="debian-12-standard_12.0-1_amd64.tar.zst"
if ! pveam list $TEMPLATE_STORAGE | grep -q $TEMPLATE; then
  echo "Downloading Debian 12 template..."
  pveam update
  pveam download $TEMPLATE_STORAGE $TEMPLATE
fi

# Create the container
pct create $CTID $TEMPLATE_STORAGE:vztmpl/$TEMPLATE \
  --hostname $HOSTNAME \
  --cores $CORES \
  --memory $RAM \
  --net0 name=eth0,bridge=$BRIDGE,ip=$IP${GATEWAY:+,gw=$GATEWAY} \
  --rootfs $STORAGE:$DISK_SIZE \
  --onboot 1 \
  --unprivileged 1 \
  --features nesting=1

# Start the container
pct start $CTID

echo "Container $CTID created and started. Waiting for network..."
sleep 5

# Run the install script inside the container
# We assume the install script is available at a public URL or we copy it.
# For this example, we'll use a heredoc to create the install script inside the container.

echo "Running installation inside container..."

pct exec $CTID -- bash -c "apt-get update && apt-get install -y curl git"
pct exec $CTID -- bash -c "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
pct exec $CTID -- bash -c "apt-get install -y nodejs"

# Clone the repository (User should replace this with their actual repo URL)
# For now, we'll assume the user will provide the source or we'll use a placeholder.
REPO_URL="https://github.com/sam642/lumina-outline.git"

pct exec $CTID -- bash -c "git clone $REPO_URL /opt/lumina-outline"
pct exec $CTID -- bash -c "cd /opt/lumina-outline && npm install && npm run build"

# Create systemd service
pct exec $CTID -- bash -c "cat <<EOF > /etc/systemd/system/lumina-outline.service
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
EOF"

pct exec $CTID -- bash -c "systemctl daemon-reload && systemctl enable --now lumina-outline"

echo "Lumina Outline is now running at http://\$(pct exec $CTID -- hostname -I | awk '{print \$1}'):3000"
