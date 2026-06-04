#!/usr/bin/env python3
"""
Generate Knowledge Cloud app icons at multiple resolutions.
"""

import os
import math
import struct
from PIL import Image, ImageDraw

OUTPUT_DIR = "public"
os.makedirs(OUTPUT_DIR, exist_ok=True)

COLORS = {
    "primary_dark": (67, 56, 202),
    "primary": (99, 102, 241),
    "accent": (139, 92, 246),
    "accent_light": (167, 139, 250),
    "highlight": (196, 181, 253),
    "bg_dark": (30, 27, 75),
    "white": (255, 255, 255),
}


def interpolate_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def create_gradient(size, c1, c2, c3=None, angle=135):
    img = Image.new('RGB', size, c1)
    draw = ImageDraw.Draw(img)
    w, h = size
    diagonal = int(math.sqrt(w*w + h*h))
    for i in range(diagonal):
        t = i / diagonal
        if c3 and t > 0.5:
            color = interpolate_color(c2, c3, (t - 0.5) * 2)
        else:
            color = interpolate_color(c1, c2, t * 2 if c3 else t)
        rad = math.radians(angle)
        x0 = int(w/2 + (i - diagonal/2) * math.cos(rad + math.pi/2))
        y0 = int(h/2 + (i - diagonal/2) * math.sin(rad + math.pi/2))
        x1 = int(x0 + w * math.cos(rad))
        y1 = int(y0 + h * math.sin(rad))
        draw.line([(x0, y0), (x1, y1)], fill=color, width=2)
    return img


def draw_circle(draw, center, radius, fill=None, outline=None, width=1):
    x, y = center
    bbox = [x - radius, y - radius, x + radius, y + radius]
    draw.ellipse(bbox, fill=fill, outline=outline, width=width)


def create_minimal_icon(size):
    """Bold icon for tiny sizes — fills entire canvas, zero padding."""
    img = Image.new('RGBA', (size, size), COLORS["primary"] + (255,))
    draw = ImageDraw.Draw(img)
    
    # Rounded corners (subtle at tiny sizes)
    # Actually for 16x16, no rounded corners = more visible area
    if size >= 32:
        corner = max(2, size // 6)
        # Redraw with rounded rect on solid bg
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.rounded_rectangle([0, 0, size-1, size-1], radius=corner, fill=COLORS["primary"] + (255,))
    
    cx, cy = size // 2, size // 2
    
    # Play triangle — as large as possible
    tri_h = size * 7 // 16
    tri_w = size * 6 // 16
    
    tri_points = [
        (cx - tri_w//2, cy - tri_h//2),
        (cx - tri_w//2, cy + tri_h//2),
        (cx + tri_w//2 + max(1, size//20), cy),
    ]
    draw.polygon(tri_points, fill=COLORS["white"] + (255,))
    
    return img


def create_icon(size, detail_level="medium"):
    if detail_level == "minimal":
        return create_minimal_icon(size)
    
    padding = size // 8
    canvas_size = size
    img = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = canvas_size // 2, canvas_size // 2
    scale = (canvas_size - 2 * padding) / 512
    
    def s(v):
        return int(v * scale)
    
    if detail_level == "medium":
        glow = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        glow_r = s(220)
        for i in range(glow_r, 0, -2):
            alpha = int(30 * (1 - i / glow_r))
            glow_color = COLORS["accent_light"] + (alpha,)
            draw_circle(glow_draw, (cx, cy), i, glow_color)
        img = Image.alpha_composite(img, glow)
        draw = ImageDraw.Draw(img)
        
        r = s(130)
        offset = s(75)
        for center, color_base in [
            ((cx - offset, cy + offset//3), COLORS["primary"]),
            ((cx + offset, cy + offset//3), COLORS["accent"]),
            ((cx, cy - offset//2), COLORS["primary_dark"]),
        ]:
            circle_img = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
            c_draw = ImageDraw.Draw(circle_img)
            for i in range(r, 0, -1):
                t = i / r
                alpha = int(220 * (0.7 + 0.3 * (1 - t)))
                c = interpolate_color(color_base, COLORS["bg_dark"], t * 0.3)
                draw_circle(c_draw, center, i, c + (alpha,))
            img = Image.alpha_composite(img, circle_img)
        
        draw = ImageDraw.Draw(img)
        
        node_r = s(12)
        node_color = COLORS["highlight"] + (200,)
        draw_circle(draw, (cx - offset//2, cy + offset//6), node_r, node_color)
        draw_circle(draw, (cx + offset//2, cy + offset//6), node_r, node_color)
        
        tri_size = s(55)
        for i in range(3, 0, -1):
            glow_offset = i * s(4)
            alpha = int(40 / i)
            glow_pts = [
                (cx - tri_size//2 - glow_offset, cy - tri_size//2 + s(5)),
                (cx - tri_size//2 - glow_offset, cy + tri_size//2 + s(5)),
                (cx + tri_size//2 + glow_offset, cy + s(5)),
            ]
            draw.polygon(glow_pts, fill=COLORS["highlight"] + (alpha,))
        
        tri_points = [
            (cx - tri_size//2, cy - tri_size//2 + s(5)),
            (cx - tri_size//2, cy + tri_size//2 + s(5)),
            (cx + tri_size//2 + s(8), cy + s(5)),
        ]
        draw.polygon(tri_points, fill=COLORS["white"] + (240,))
        
        ring_r = s(90)
        draw_circle(draw, (cx, cy), ring_r, outline=COLORS["highlight"] + (60,), width=s(2))
        
    else:  # high
        bg = create_gradient(
            (canvas_size, canvas_size),
            COLORS["bg_dark"],
            (49, 46, 129),
            COLORS["primary_dark"],
            angle=135
        )
        bg = bg.convert('RGBA')
        img = Image.alpha_composite(img, bg)
        draw = ImageDraw.Draw(img)
        
        for glow_c, glow_r_base, alpha_base in [
            (COLORS["accent_light"], s(250), 25),
            (COLORS["accent"], s(200), 20),
            (COLORS["primary"], s(180), 15),
        ]:
            glow = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
            g_draw = ImageDraw.Draw(glow)
            for i in range(glow_r_base, 0, -3):
                t = i / glow_r_base
                alpha = int(alpha_base * (1 - t * t))
                draw_circle(g_draw, (cx, cy), i, glow_c + (alpha,))
            img = Image.alpha_composite(img, glow)
        
        draw = ImageDraw.Draw(img)
        
        r = s(120)
        offset = s(70)
        circle_data = [
            ((cx - offset, cy + offset//3), COLORS["primary"], COLORS["primary_dark"]),
            ((cx + offset, cy + offset//3), COLORS["accent"], COLORS["primary"]),
            ((cx, cy - offset//2), COLORS["accent_light"], COLORS["accent"]),
        ]
        
        for center, c_inner, c_outer in circle_data:
            circle_img = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
            c_draw = ImageDraw.Draw(circle_img)
            for i in range(r, 0, -1):
                t = i / r
                t_smooth = t * t
                color = interpolate_color(c_inner, c_outer, t_smooth * 0.5)
                alpha = int(200 * (0.85 + 0.15 * math.sin(t * math.pi)))
                draw_circle(c_draw, center, i, color + (alpha,))
            
            hl_r = s(25)
            hl_offset = s(30)
            hl_cx, hl_cy = center[0] - hl_offset, center[1] - hl_offset
            for i in range(hl_r, 0, -1):
                t = i / hl_r
                alpha = int(80 * (1 - t))
                draw_circle(c_draw, (hl_cx, hl_cy), i, COLORS["white"] + (alpha,))
            img = Image.alpha_composite(img, circle_img)
        
        draw = ImageDraw.Draw(img)
        
        line_color = COLORS["highlight"] + (100,)
        line_width = max(1, s(2))
        conn_points = [
            ((cx - offset//2, cy + offset//6), (cx + offset//2, cy + offset//6)),
            ((cx - offset//2, cy + offset//6), (cx, cy - offset//4)),
            ((cx + offset//2, cy + offset//6), (cx, cy - offset//4)),
        ]
        
        for p1, p2 in conn_points:
            draw.line([p1, p2], fill=line_color, width=line_width)
            for pt in [p1, p2]:
                draw_circle(draw, pt, s(8), COLORS["highlight"] + (180,))
                draw_circle(draw, pt, s(4), COLORS["white"] + (200,))
        
        for ring_r, ring_alpha, ring_width in [
            (s(160), 40, s(2)),
            (s(190), 25, s(1)),
        ]:
            segments = 60
            for i in range(segments):
                if i % 3 == 0:
                    angle1 = 2 * math.pi * i / segments
                    angle2 = 2 * math.pi * (i + 0.7) / segments
                    x1 = cx + ring_r * math.cos(angle1)
                    y1 = cy + ring_r * math.sin(angle1)
                    x2 = cx + ring_r * math.cos(angle2)
                    y2 = cy + ring_r * math.sin(angle2)
                    draw.line([(x1, y1), (x2, y2)], fill=COLORS["highlight"] + (ring_alpha,), width=ring_width)
        
        tri_size = s(50)
        for layer in range(4, 0, -1):
            glow_s = tri_size + layer * s(8)
            alpha = int(30 / layer)
            glow_pts = [
                (cx - glow_s//2, cy - glow_s//2 + s(3)),
                (cx - glow_s//2, cy + glow_s//2 + s(3)),
                (cx + glow_s//2 + s(6), cy + s(3)),
            ]
            draw.polygon(glow_pts, fill=COLORS["accent_light"] + (alpha,))
        
        tri_points = [
            (cx - tri_size//2, cy - tri_size//2 + s(3)),
            (cx - tri_size//2, cy + tri_size//2 + s(3)),
            (cx + tri_size//2 + s(6), cy + s(3)),
        ]
        draw.polygon(tri_points, fill=COLORS["white"] + (255,))
        
        hl_tri = [
            (cx - tri_size//4, cy - tri_size//4 + s(3)),
            (cx - tri_size//4, cy + s(3)),
            (cx + s(5), cy - tri_size//6 + s(3)),
        ]
        draw.polygon(hl_tri, fill=COLORS["highlight"] + (120,))
    
    return img


def create_ico_file():
    """Create a proper multi-resolution ICO file."""
    sizes = [16, 32, 48]
    images = []
    
    for size in sizes:
        detail = "minimal" if size <= 32 else "medium"
        img = create_icon(size, detail)
        rgb = Image.new('RGB', (size, size), COLORS["primary"])
        rgb.paste(img, (0, 0), img)
        images.append(rgb)
    
    ico_path = os.path.join(OUTPUT_DIR, "favicon.ico")
    header = struct.pack('<HHH', 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries = []
    image_data = []
    
    for img in images:
        size = img.width
        import io
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        data = buf.getvalue()
        
        w = 0 if size >= 256 else size
        h = 0 if size >= 256 else size
        entry = struct.pack('<BBBBHHII', w, h, 0, 0, 1, 32, len(data), offset)
        entries.append(entry)
        image_data.append(data)
        offset += len(data)
    
    with open(ico_path, 'wb') as f:
        f.write(header)
        for entry in entries:
            f.write(entry)
        for data in image_data:
            f.write(data)
    
    print(f"  Created favicon.ico ({', '.join(f'{s}x{s}' for s in sizes)})")


def create_svg_icon():
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="50%" stop-color="#312e81"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
    <radialGradient id="glow1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#c4b5fd" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#c4b5fd" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="circle1" cx="30%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </radialGradient>
    <radialGradient id="circle2" cx="30%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#6366f1"/>
    </radialGradient>
    <radialGradient id="circle3" cx="30%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </radialGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <rect width="512" height="512" rx="128" fill="url(#bgGrad)"/>
  
  <circle cx="256" cy="256" r="220" fill="url(#glow1)">
    <animate attributeName="r" values="220;240;220" dur="4s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.8;1;0.8" dur="4s" repeatCount="indefinite"/>
  </circle>
  
  <circle cx="256" cy="256" r="160" fill="none" stroke="#c4b5fd" stroke-width="2" stroke-dasharray="12 6" opacity="0.4">
    <animateTransform attributeName="transform" type="rotate" from="0 256 256" to="360 256 256" dur="20s" repeatCount="indefinite"/>
  </circle>
  <circle cx="256" cy="256" r="190" fill="none" stroke="#c4b5fd" stroke-width="1" stroke-dasharray="8 12" opacity="0.25">
    <animateTransform attributeName="transform" type="rotate" from="360 256 256" to="0 256 256" dur="30s" repeatCount="indefinite"/>
  </circle>
  
  <circle cx="176" cy="280" r="130" fill="url(#circle1)" opacity="0.9"/>
  <circle cx="336" cy="280" r="130" fill="url(#circle2)" opacity="0.9"/>
  <circle cx="256" cy="190" r="140" fill="url(#circle3)" opacity="0.9"/>
  
  <circle cx="216" cy="245" r="12" fill="#c4b5fd" opacity="0.8">
    <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite"/>
  </circle>
  <circle cx="296" cy="245" r="12" fill="#c4b5fd" opacity="0.8">
    <animate attributeName="opacity" values="1;0.8;1" dur="2s" repeatCount="indefinite"/>
  </circle>
  <circle cx="256" cy="215" r="12" fill="#c4b5fd" opacity="0.8">
    <animate attributeName="opacity" values="0.9;1;0.9" dur="2.5s" repeatCount="indefinite"/>
  </circle>
  
  <line x1="216" y1="245" x2="296" y2="245" stroke="#c4b5fd" stroke-width="2" opacity="0.5"/>
  <line x1="216" y1="245" x2="256" y2="215" stroke="#c4b5fd" stroke-width="2" opacity="0.5"/>
  <line x1="296" y1="245" x2="256" y2="215" stroke="#c4b5fd" stroke-width="2" opacity="0.5"/>
  
  <polygon points="226,235 226,285 286,260" fill="#c4b5fd" opacity="0.3">
    <animate attributeName="opacity" values="0.3;0.5;0.3" dur="3s" repeatCount="indefinite"/>
  </polygon>
  
  <polygon points="231,238 231,282 281,260" fill="white" filter="url(#glow)"/>
</svg>'''


def main():
    print("Generating Knowledge Cloud icons...")
    print()
    
    print("1. favicon.ico (browser tab, bookmarks)")
    create_ico_file()
    
    print("2. apple-touch-icon.png (180x180)")
    icon_180 = create_icon(180, "medium")
    icon_180.save(os.path.join(OUTPUT_DIR, "apple-touch-icon.png"), "PNG")
    
    print("3. icon-192.png (PWA, Android)")
    icon_192 = create_icon(192, "medium")
    icon_192.save(os.path.join(OUTPUT_DIR, "icon-192.png"), "PNG")
    
    print("4. icon-512.png (PWA splash, high-res)")
    icon_512 = create_icon(512, "high")
    icon_512.save(os.path.join(OUTPUT_DIR, "icon-512.png"), "PNG")
    
    print("5. icon.svg (modern browsers, animated)")
    svg = create_svg_icon()
    with open(os.path.join(OUTPUT_DIR, "icon.svg"), "w") as f:
        f.write(svg)
    
    print("6. maskable-icon.png (Android adaptive icon)")
    maskable_size = 512
    padding = maskable_size // 6
    maskable = Image.new('RGBA', (maskable_size, maskable_size), (0, 0, 0, 0))
    icon_inner = create_icon(maskable_size - 2 * padding, "high")
    maskable.paste(icon_inner, (padding, padding), icon_inner)
    maskable.save(os.path.join(OUTPUT_DIR, "maskable-icon.png"), "PNG")
    
    print("7. favicon-16x16.png / favicon-32x32.png")
    icon_16 = create_icon(16, "minimal")
    icon_16.save(os.path.join(OUTPUT_DIR, "favicon-16x16.png"), "PNG")
    icon_32 = create_icon(32, "minimal")
    icon_32.save(os.path.join(OUTPUT_DIR, "favicon-32x32.png"), "PNG")
    
    print("8. og-image.png (Open Graph / social sharing, 1200x630)")
    og_width, og_height = 1200, 630
    og_img = Image.new('RGBA', (og_width, og_height), (0, 0, 0, 0))
    
    bg = create_gradient((og_width, og_height), COLORS["bg_dark"], (49, 46, 129), COLORS["primary_dark"], angle=135)
    bg = bg.convert('RGBA')
    og_img = Image.alpha_composite(og_img, bg)
    
    icon_for_og = create_icon(400, "high")
    og_img.paste(icon_for_og, (80, (og_height - 400) // 2), icon_for_og)
    
    from PIL import ImageFont
    draw_og = ImageDraw.Draw(og_img)
    
    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 80)
        subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 32)
    except:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
    
    draw_og.text((520, 180), "Knowledge", fill=COLORS["white"] + (255,), font=title_font)
    draw_og.text((520, 280), "Cloud", fill=COLORS["accent_light"] + (255,), font=title_font)
    draw_og.text((520, 390), "YouTube Subscription Tracker", fill=(180, 180, 210, 255), font=subtitle_font)
    
    og_img.save(os.path.join(OUTPUT_DIR, "og-image.png"), "PNG")
    
    print()
    print("All icons generated successfully!")
    print()
    print("Files created in public/:")
    for f in sorted(os.listdir(OUTPUT_DIR)):
        if f.endswith(('.png', '.ico', '.svg')):
            path = os.path.join(OUTPUT_DIR, f)
            size = os.path.getsize(path)
            print(f"  {f:25s} {size:>8,} bytes")


if __name__ == "__main__":
    main()
