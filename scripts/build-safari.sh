#!/bin/bash
# Build Safari extension from shared source
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_DIR/src"
PLATFORM_DIR="$PROJECT_DIR/platforms/safari"
DIST_DIR="$PROJECT_DIR/dist/safari"

echo "Building Safari extension..."

# Clean and create dist directory
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Copy shared source files
cp -R "$SRC_DIR/"* "$DIST_DIR/"

# Overwrite with Safari-specific manifest and rules
cp "$PLATFORM_DIR/manifest.json" "$DIST_DIR/manifest.json"
cp "$PLATFORM_DIR/rules.json" "$DIST_DIR/rules.json"

# Clean up non-extension files
rm -f "$DIST_DIR/icons/create-icons.html"

echo "Safari build complete: $DIST_DIR"

# Sync to Xcode project if it exists
XCODE_RESOURCES="$PROJECT_DIR/safari-app/YouTube to Fabric/YouTube to Fabric Extension/Resources"
if [ -d "$XCODE_RESOURCES" ]; then
  echo "Syncing to Xcode project..."
  rsync -a --delete "$DIST_DIR/" "$XCODE_RESOURCES/"
  echo "Xcode sync complete."
fi
