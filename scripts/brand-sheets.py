"""Comparison sheet and GitHub social preview from the committed vector renders."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / 'assets' / 'brand'
BG = (9, 10, 11)
WHITE = (255, 255, 255)
LIGHT = (232, 234, 237)
DARK = (41, 42, 45)
INK = (244, 246, 248)
MUTED = (176, 186, 198)
TEAL = (96, 227, 210)

def font(size, bold=False):
    path = '/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf'
    return ImageFont.truetype(path, size)

def raster(shapes, apertures, size=800):
    image = Image.new('RGB', (size, size), BG)
    draw = ImageDraw.Draw(image)
    for poly in shapes:
        draw.polygon(poly, fill=WHITE)
    for poly in apertures:
        draw.polygon(poly, fill=BG)
    return image

def mul4(poly):
    return [(x * 4, y * 4) for x, y in poly]

legacy_shapes = [mul4(poly) for poly in [
    [(20, 20), (62, 20), (62, 42), (42, 42), (42, 64), (20, 64)],
    [(138, 20), (180, 20), (180, 64), (158, 64), (158, 42), (138, 42)],
    [(20, 136), (42, 136), (42, 158), (62, 158), (62, 180), (20, 180)],
    [(158, 136), (180, 136), (180, 180), (138, 180), (138, 158), (158, 158)],
    [(62, 44), (110, 44), (158, 88), (158, 112), (110, 156), (62, 156), (62, 134), (40, 134), (40, 112), (62, 112), (62, 90), (40, 90), (40, 68), (62, 68)],
]]
legacy = raster(legacy_shapes, [mul4([(84, 68), (134, 100), (84, 132)])])
sources = [
    ('Legacy', legacy),
    ('Current v3', Image.open(BRAND / 'portal-logo-v3.png').convert('RGB')),
    ('Revised v4', Image.open(BRAND / 'portal-logo.png').convert('RGB')),
]

def icon_at(name, source, size):
    if name == 'Favicon' and (BRAND / f'favicon-{size}.png').exists():
        return Image.open(BRAND / f'favicon-{size}.png').convert('RGB')
    if name == 'Favicon':
        return Image.open(BRAND / 'favicon-64.png').convert('RGB').resize((size, size), Image.Resampling.BOX)
    return source.resize((size, size), Image.Resampling.LANCZOS)

def comparison():
    sizes = [16, 24, 32, 48, 64]
    columns = sources + [('Favicon', None)]
    margin = 28
    large = 240
    cell = 132
    width = margin * 2 + large * len(columns) + 20 * (len(columns) - 1)
    row_h = cell + 8
    height = 64 + large + 30 + (28 + row_h * len(sizes) + 18) * 2
    image = Image.new('RGB', (width, height), (245, 246, 248))
    draw = ImageDraw.Draw(image)
    draw.text((margin, 16), 'Legacy, current, revised and favicon', fill=(17, 24, 32), font=font(26, True))
    for index, (name, source) in enumerate(columns):
        x = margin + index * (large + 20)
        draw.text((x, 54), name, fill=(17, 24, 32), font=font(18, True))
        shown = Image.open(BRAND / 'favicon-64.png').convert('RGB').resize((large, large), Image.Resampling.NEAREST) if name == 'Favicon' else source.resize((large, large), Image.Resampling.LANCZOS)
        image.paste(shown, (x, 82))
    y = 82 + large + 24
    for background, title in ((LIGHT, 'Light browser tab — actual pixels, enlarged'), (DARK, 'Dark browser tab — actual pixels, enlarged')):
        ink = (17, 24, 32) if background[0] > 180 else (236, 238, 241)
        draw.text((margin, y), title, fill=(17, 24, 32), font=font(16, True))
        top = y + 26
        block_h = row_h * len(sizes)
        draw.rectangle((margin, top, width - margin, top + block_h), fill=background)
        for row, size in enumerate(sizes):
            zoom = max(1, cell // size)
            yy = top + row * row_h + 6
            draw.text((margin + 8, yy + 8), f'{size}', fill=ink, font=font(14, True))
            for index, (name, source) in enumerate(columns):
                small = icon_at(name, source, size)
                enlarged = small.resize((size * zoom, size * zoom), Image.Resampling.NEAREST)
                x = margin + 48 + index * (large + 20)
                image.paste(small, (x, yy))
                image.paste(enlarged, (x + size + 8, yy))
        y = top + block_h + 18
    image.save(BRAND / 'logo-readability.png')

def social():
    image = Image.new('RGB', (1280, 640), BG)
    draw = ImageDraw.Draw(image)
    logo = Image.open(BRAND / 'portal-logo.png').convert('RGB').resize((460, 460), Image.Resampling.LANCZOS)
    image.paste(logo, (86, 90))
    draw.text((620, 168), 'DIGIPOLY', fill=TEAL, font=font(22, True))
    draw.text((620, 204), 'DigiPoly', fill=WHITE, font=font(78, True))
    draw.text((622, 304), 'One physical marker.', fill=INK, font=font(32))
    draw.text((622, 348), 'Many digital stories.', fill=INK, font=font(32))
    draw.rectangle((622, 418, 690, 422), fill=TEAL)
    draw.text((622, 444), 'Print DP-001 and DP-002. Keep older prints working.', fill=MUTED, font=font(22))
    image.save(BRAND / 'github-social.png', optimize=True)
    print('social bytes', (BRAND / 'github-social.png').stat().st_size)

comparison()
social()
print('wrote comparison and social preview')
