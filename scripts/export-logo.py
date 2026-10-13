import os
import resvg_py
from PIL import Image

SVG_CONTENT = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="1024" height="1024" fill="none">
  <defs>
    <linearGradient id="appleLogoGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2C2C2E" />
      <stop offset="1" stop-color="#1C1C1E" />
    </linearGradient>
    <linearGradient id="appleBeaconGrad" x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FF453A" />
      <stop offset="1" stop-color="#D70015" />
    </linearGradient>
  </defs>
  <!-- Precision titanium chassis squircle -->
  <rect width="64" height="64" rx="16" fill="url(#appleLogoGrad)" />
  <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
  <!-- Concentric radar beacon rings -->
  <circle cx="32" cy="32" r="20" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
  <circle cx="32" cy="32" r="14" stroke="rgba(255,69,58,0.35)" stroke-width="1.5" stroke-dasharray="3 3" />
  <!-- Glowing emergency core -->
  <circle cx="32" cy="32" r="8" fill="url(#appleBeaconGrad)" />
  <circle cx="32" cy="32" r="3" fill="#FFFFFF" opacity="0.95" />
</svg>"""

workspace_root = r"c:\Users\hp\Desktop\hack\KAVACH"
artifact_dir = r"C:\Users\hp\.gemini\antigravity\brain\e3677290-bc5b-4fae-9739-95c690430780"

# 1. 1024x1024 Transparent
png_1024 = resvg_py.svg_to_bytes(
    svg_string=SVG_CONTENT,
    width=1024,
    height=1024,
    shape_rendering="geometric_precision"
)

# 2. 512x512 Transparent
png_512 = resvg_py.svg_to_bytes(
    svg_string=SVG_CONTENT,
    width=512,
    height=512,
    shape_rendering="geometric_precision"
)

# 3. 192x192 Transparent
png_192 = resvg_py.svg_to_bytes(
    svg_string=SVG_CONTENT,
    width=192,
    height=192,
    shape_rendering="geometric_precision"
)

# 4. 1024x1024 Dark Background (#0F1012 / Onyx matching UI)
SVG_DARK = SVG_CONTENT.replace(
    '<!-- Precision titanium chassis',
    '<rect width="64" height="64" fill="#0E1116" />\n  <!-- Precision titanium chassis'
)
png_dark_1024 = resvg_py.svg_to_bytes(
    svg_string=SVG_DARK,
    width=1024,
    height=1024,
    shape_rendering="geometric_precision"
)

targets = [
    (os.path.join(workspace_root, "kavach-logo.png"), png_1024),
    (os.path.join(workspace_root, "kavach-logo-512.png"), png_512),
    (os.path.join(workspace_root, "kavach-logo-192.png"), png_192),
    (os.path.join(workspace_root, "kavach-logo-dark.png"), png_dark_1024),
    (os.path.join(workspace_root, "student", "public", "kavach-logo.png"), png_512),
    (os.path.join(workspace_root, "admin", "public", "kavach-logo.png"), png_512),
    (os.path.join(artifact_dir, "kavach-logo.png"), png_1024),
    (os.path.join(artifact_dir, "kavach-logo-dark.png"), png_dark_1024),
]

for path, data in targets:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    print(f"Generated: {path} ({len(data)} bytes)")

print("All logo PNG files exported successfully!")
