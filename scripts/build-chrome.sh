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

# Validate source and platform directories
if [ ! -d "$SRC_DIR" ]; then
  echo "ERROR: Source directory not found: $SRC_DIR" >&2
  exit 1
fi
if [ ! -d "$PLATFORM_DIR" ]; then
  echo "ERROR: Platform directory not found: $PLATFORM_DIR" >&2
  exit 1
fi

# Validate critical files exist
for file in manifest.json background.js popup.js popup.html content.js options.js options.html; do
  if [ ! -f "$SRC_DIR/$file" ]; then
    echo "ERROR: Required file missing: $SRC_DIR/$file" >&2
    exit 1
  fi
done

# Validate icons exist
for size in 16 32 48 128; do
  if [ ! -f "$SRC_DIR/icons/icon${size}.png" ]; then
    echo "WARNING: Icon missing: $SRC_DIR/icons/icon${size}.png" >&2
  fi
done

# Validate manifest JSON syntax
if ! command -v python3 &>/dev/null; then
  echo "WARNING: python3 not found, skipping manifest JSON validation" >&2
elif ! python3 -c "import json; json.load(open('$PLATFORM_DIR/manifest.json'))" 2>/dev/null; then
  echo "ERROR: Invalid JSON in $PLATFORM_DIR/manifest.json" >&2
  exit 1
fi

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
