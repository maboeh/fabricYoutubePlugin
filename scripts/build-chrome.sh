#!/bin/bash
# Build Chrome extension from shared source
# Note: For development, Chrome can load directly from src/
# This script is for creating a clean distributable build
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_DIR/src"
PLATFORM_DIR="$PROJECT_DIR/platforms/chrome"
DIST_DIR="$PROJECT_DIR/dist/chrome"

echo "Building Chrome extension..."

# Clean and create dist directory
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Copy shared source files
cp -R "$SRC_DIR/"* "$DIST_DIR/"

# Overwrite with Chrome-specific manifest and rules
cp "$PLATFORM_DIR/manifest.json" "$DIST_DIR/manifest.json"
cp "$PLATFORM_DIR/rules.json" "$DIST_DIR/rules.json"

# Clean up non-extension files
rm -f "$DIST_DIR/icons/create-icons.html"

echo "Chrome build complete: $DIST_DIR"
