#!/usr/bin/env bash

# Proxmox LXC Creation Script for Lumina Outline
# Inspired by Proxmox Helper Scripts (community-scripts.org)

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

function error_handler() {
  local exit_code="$?"
  local line_number="$1"
  if [ "$exit_code" -ne 0 ]; then
    msg_error "An error occurred on line $line_number. Exit code: $exit_code"
  fi
}
trap 'error_handler $LINENO' EXIT

function header_info() {
  clear
  cat <<EOF
    __                      _                 ____        __  ___            
   / /   __  ______ ___  (_)___  ____ _    / __ \__  __/ /_/ (_)___  ___ 
  / /   / / / / __ '__ \/ / __ \/ __ '/   / / / / / / / __/ / / __ \/ _ \\
 / /___/ /_/ / / / / / / / / / / /_/ /   / /_/ / /_/ / /_/ / / / / /  __/
/_____/\__,_/_/ /_/ /_/_/_/ /_/\__,_/    \____/\__,_/\__/_/_/_/ /_/\___/ 
                                                                         
EOF
}

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
TEMPLATE_STORAGE="local"
TEMPLATE="debian-12-standard_12.0-1_amd64.tar.zst"

header_info
echo -e "\nThis script will create a new Lumina Outline LXC container.\n"

# Prompt for settings
read -p "Use default settings? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  read -p "Enter Container ID [$CTID]: " input_ctid
  CTID=${input_ctid:-$CTID}
  read -p "Enter Hostname [$HOSTNAME]: " input_hostname
  HOSTNAME=${input_hostname:-$HOSTNAME}
  read -p "Enter Disk Size [$DISK_SIZE]: " input_disk
  DISK_SIZE=${input_disk:-$DISK_SIZE}
  read -p "Enter Cores [$CORES]: " input_cores
  CORES=${input_cores:-$CORES}
  read -p "Enter RAM in MB [$RAM]: " input_ram
  RAM=${input_ram:-$RAM}
  read -p "Enter Storage Pool [$STORAGE]: " input_storage
  STORAGE=${input_storage:-$STORAGE}
fi

msg_info "Creating Lumina Outline LXC Container (ID: $CTID)..."

# Check if storage pools exist
if ! pvesm status -storage $STORAGE &>/dev/null; then
  msg_error "Storage pool '$STORAGE' not found. Please check your settings."
  exit 1
fi

if ! pvesm status -storage $TEMPLATE_STORAGE &>/dev/null; then
  msg_error "Template storage pool '$TEMPLATE_STORAGE' not found. Please check your settings."
  exit 1
fi

# Update Proxmox template list
msg_info "Updating Proxmox template list..."
pveam update

# Find the latest Debian 12 template
msg_info "Searching for available Debian 12 templates..."
# Try to find debian-12-standard first, then any debian-12
LATEST_TEMPLATE=$(pveam available | grep "debian-12-standard" | sort -V | tail -n 1 | awk '{print $2}')
if [ -z "$LATEST_TEMPLATE" ]; then
  LATEST_TEMPLATE=$(pveam available | grep "debian-12" | sort -V | tail -n 1 | awk '{print $2}')
fi

if [ -z "$LATEST_TEMPLATE" ]; then
  msg_error "Could not find any Debian 12 template in the Proxmox repository."
  echo "Available system templates:"
  pveam available -section system | grep "debian"
  exit 1
fi

TEMPLATE_FILENAME=$(basename "$LATEST_TEMPLATE")
msg_info "Found template: $LATEST_TEMPLATE"

# Download template if not exists
if ! pveam list "$TEMPLATE_STORAGE" | grep -q "$TEMPLATE_FILENAME"; then
  msg_info "Downloading $LATEST_TEMPLATE to $TEMPLATE_STORAGE..."
  pveam download "$TEMPLATE_STORAGE" "$LATEST_TEMPLATE"
fi

# Create the container
msg_info "Provisioning LXC..."
# Ensure we use the full path for the template
pct create "$CTID" "$TEMPLATE_STORAGE:vztmpl/$LATEST_TEMPLATE" \
  --hostname "$HOSTNAME" \
  --cores "$CORES" \
  --memory "$RAM" \
  --net0 name=eth0,bridge="$BRIDGE",ip="$IP${GATEWAY:+,gw=$GATEWAY}" \
  --rootfs "$STORAGE:$DISK_SIZE" \
  --onboot 1 \
  --unprivileged 1 \
  --features nesting=1

# Start the container
msg_info "Starting LXC..."
pct start $CTID

msg_info "Waiting for network..."
sleep 5

# Run the build script inside the container
msg_info "Running installation inside container..."

# We'll use a heredoc to create the build script inside the container
# This is a self-contained version of build.sh
pct exec $CTID -- bash -c "cat <<'EOF' > /tmp/build.sh
#!/usr/bin/env bash
set -e

function msg_info() {
  echo -e \"\e[34m[INFO]\e[0m \$1\"
}

msg_info \"Updating system...\"
apt-get update &>/dev/null
apt-get -y upgrade &>/dev/null

msg_info \"Installing dependencies...\"
apt-get install -y curl git build-essential sudo &>/dev/null

msg_info \"Installing Node.js 20...\"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - &>/dev/null
apt-get install -y nodejs &>/dev/null

msg_info \"Setting up application...\"
mkdir -p /opt/lumina-outline
cd /opt/lumina-outline
git clone https://github.com/sam642/lumina-outline.git . &>/dev/null
npm install &>/dev/null
npm run build &>/dev/null

msg_info \"Configuring service...\"
cat <<EOT > /etc/systemd/system/lumina-outline.service
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
EOT

systemctl daemon-reload
systemctl enable --now lumina-outline &>/dev/null
EOF"

pct exec $CTID -- bash /tmp/build.sh

msg_ok "Lumina Outline is now running at http://$(pct exec $CTID -- hostname -I | awk '{print $1}'):3000"
trap - EXIT
echo -e "\n\e[32mInstallation Successful!\e[0m\n"
