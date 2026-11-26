from PIL import Image, ImageDraw, ImageFilter
import math

S = 1024
img = Image.new('RGBA', (S, S), (0,0,0,0))
d = ImageDraw.Draw(img)
# rounded body
d.rounded_rectangle((56,56,S-56,S-56), radius=210, fill=(14,11,8,255))
# inner edge
d.rounded_rectangle((70,70,S-70,S-70), radius=198, outline=(91,74,51,190), width=4)
# glow blobs
glow = Image.new('RGBA', (S,S), (0,0,0,0))
gd = ImageDraw.Draw(glow)
gd.ellipse((150,120,760,730), fill=(116,88,53,95))
gd.ellipse((510,430,860,820), fill=(74,91,64,65))
glow = glow.filter(ImageFilter.GaussianBlur(110))
img.alpha_composite(glow)
# orbit arcs
arc = Image.new('RGBA', (S,S), (0,0,0,0))
ad = ImageDraw.Draw(arc)
ad.arc((160,170,864,854), 200, 340, fill=(208,168,120,80), width=3)
ad.arc((250,240,790,790), 20, 140, fill=(156,175,138,60), width=2)
img.alpha_composite(arc)
# waveform bars
bars = [(465,170,57,330,46),(548,120,57,470,44),(631,90,57,560,42)]
# custom heights
specs = [(430,320),(497,440),(564,560),(631,470),(698,350)]
for i,(x,h) in enumerate(specs):
    top = S//2 - h//2
    color = (208,168,120,255) if i in (1,2,3) else (208,168,120,200)
    d.rounded_rectangle((x,top,x+62,top+h), radius=31, fill=color)
# center bright bar highlight
d.rounded_rectangle((564,232,626,792), radius=31, fill=(238,216,178,255))
# small top glints
for x,y,r in [(190,250,7),(812,300,5),(800,740,4),(240,780,5)]:
    d.ellipse((x-r,y-r,x+r,y+r), fill=(196,158,108,230))
# crop-ish border glow
border = Image.new('RGBA',(S,S),(0,0,0,0))
bd = ImageDraw.Draw(border)
bd.rounded_rectangle((56,56,S-56,S-56), radius=210, outline=(208,168,120,125), width=3)
border = border.filter(ImageFilter.GaussianBlur(9))
img.alpha_composite(border)
img = img.resize((512,512), Image.LANCZOS)
img.save('assets/aether.png')
img.save('assets/aether.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('icon written')
