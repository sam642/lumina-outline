# Proxmox LXC Deployment for Lumina Outline

This directory contains scripts to deploy the Lumina Outline application as a Proxmox LXC container.

## Host-Side Script (`lxc_create.sh`)

This script is designed to be run on your Proxmox host. It will:
1.  Create a new Debian 12 LXC container.
2.  Install Node.js 20 and other dependencies inside the container.
3.  Clone the repository and build the application.
4.  Set up a `systemd` service to keep the application running.

### Usage

1.  Copy `lxc_create.sh` to your Proxmox host.
2.  Edit the `REPO_URL` variable in the script to point to your repository.
3.  Make the script executable: `chmod +x lxc_create.sh`.
4.  Run the script: `./lxc_create.sh`.

## Container-Side Script (`install.sh`)

If you already have a Debian-based LXC container and want to install the application manually:

1.  Copy `install.sh` into your container.
2.  Edit the `REPO_URL` variable in the script.
3.  Make the script executable: `chmod +x install.sh`.
4.  Run the script: `./install.sh`.

## Production Server

The application uses a simple Express server (`server.js`) to serve the static files in production. The `npm start` command is used to run this server.

By default, the application will be available on port `3000`.
