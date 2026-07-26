#!/usr/bin/env python3
"""Merge platforms/base.manifest.json with a platform patch and inject version from package.json."""
import json
import sys
from pathlib import Path


def deep_merge(base, patch):
    """Shallow-to-deep merge: dicts recurse, other values overwrite."""
    if not isinstance(patch, dict):
        return patch
    result = dict(base)
    for key, value in patch.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def main():
    if len(sys.argv) != 4:
        print(
            "Usage: merge-manifest.py <base.json> <patch.json> <output.json>",
            file=sys.stderr,
        )
        sys.exit(1)

    base_path = Path(sys.argv[1])
    patch_path = Path(sys.argv[2])
    output_path = Path(sys.argv[3])
    project_dir = base_path.resolve().parent.parent
    package_path = project_dir / "package.json"

    with base_path.open() as f:
        base = json.load(f)
    with patch_path.open() as f:
        patch = json.load(f)
    with package_path.open() as f:
        package = json.load(f)

    merged = deep_merge(base, patch)
    merged["version"] = package.get("version", merged.get("version", "0.0.0"))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Wrote {output_path} (version {merged['version']})")


if __name__ == "__main__":
    main()
