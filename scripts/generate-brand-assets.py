"""Render native assets for the existing H monogram design. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def monogram(size):
    im=Image.new('RGB',(1024,1024),'#0b1220');d=ImageDraw.Draw(im)
    d.rounded_rectangle((172,172,852,852),radius=176,fill='#3267ff')
    d.text((512,512),'H',font=ImageFont.truetype(FONT,440),anchor='mm',fill='white')
    return im.resize((size,size),Image.Resampling.LANCZOS)
monogram(512).save(ROOT/'mobile/assets/store-icon-512.png')
monogram(1024).save(ROOT/'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
for density,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    for name,factor in [('ic_launcher.png',1),('ic_launcher_round.png',1),('ic_launcher_foreground.png',2.25)]:
        monogram(round(size*factor)).save(ROOT/f'android/app/src/main/res/mipmap-{density}/{name}')
for p in list((ROOT/'android/app/src/main/res').glob('drawable*/splash.png'))+list((ROOT/'ios/App/App/Assets.xcassets/Splash.imageset').glob('*.png')):
    with Image.open(p) as old: w,h=old.size
    im=Image.new('RGB',(w,h),'#0b1220');size=round(min(w,h)*.25)
    im.paste(monogram(size),((w-size)//2,(h-size)//2));im.save(p)
