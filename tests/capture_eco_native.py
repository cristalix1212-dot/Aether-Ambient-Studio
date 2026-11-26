import ctypes,time
from ctypes import wintypes
from PIL import ImageGrab
from pathlib import Path
try: ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception: pass
u=ctypes.windll.user32; P=ctypes.WINFUNCTYPE(ctypes.c_bool,wintypes.HWND,wintypes.LPARAM); hwnd=None
def cb(h,l):
    global hwnd
    n=u.GetWindowTextLengthW(h)
    if n:
        b=ctypes.create_unicode_buffer(n+1); u.GetWindowTextW(h,b,n+1)
        if b.value=='AETHER — Ambient Studio': hwnd=h; return False
    return True
u.EnumWindows(P(cb),0); print('hwnd',hwnd)
if hwnd:
    u.ShowWindow(hwnd,9); u.SetWindowPos(hwnd,-1,25,5,1870,1020,0x0040); u.SetForegroundWindow(hwnd); time.sleep(2)
    u.SetCursorPos(1200,60); time.sleep(0.3)
    r=wintypes.RECT(); u.GetWindowRect(hwnd,ctypes.byref(r)); ImageGrab.grab(bbox=(r.left,r.top,r.right,r.bottom),all_screens=True).save(Path(r'C:\Users\Я\Documents\AmbientForge\tests\screens\native_eco.png'))
    print('saved')
