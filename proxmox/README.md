# Proxmox LXC Deployment for nxliner

This directory contains scripts to deploy the nxliner application as a Proxmox LXC container, following the style of [community-scripts.org](https://community-scripts.org).

## Host-Side Script (`nxliner.sh`)

This is the main script designed to be run on your Proxmox host. It provides a guided installation experience with ASCII art, color-coded messages, and prompts for configuration.

### Usage

1.  Copy `nxliner.sh` to your Proxmox host.
2.  Edit the `REPO_URL` variable in the script to point to your repository.
3.  Make the script executable: `chmod +x nxliner.sh`.
4.  Run the script: `./nxliner.sh`.

## Container-Side Script (`build.sh`)

This script is used internally by `lumina-outline.sh` to handle the installation inside the LXC container. It can also be run manually inside a Debian-based LXC.

1.  Copy `build.sh` into your container.
2.  Edit the `REPO_URL` variable in the script.
3.  Make the script executable: `chmod +x build.sh`.
4.  Run the script: `./build.sh`.

## Production Server

The application uses a simple Express server (`server.js`) to serve the static files in production. The `npm start` command is used to run this server.

By default, the application will be available on port `3000`.
