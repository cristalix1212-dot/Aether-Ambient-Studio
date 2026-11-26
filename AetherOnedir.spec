# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs
project = Path(SPECPATH)
datas = collect_data_files('webview')
datas += [(str(project / 'ui'), 'ui'), (str(project / 'assets'), 'assets')]
binaries = collect_dynamic_libs('webview') + collect_dynamic_libs('pythonnet') + collect_dynamic_libs('clr_loader')
a = Analysis(['app.py'], pathex=[str(project)], binaries=binaries, datas=datas,
    hiddenimports=['webview.platforms.edgechromium','webview.platforms.winforms','webview.platforms.win32','clr_loader','clr_loader.ffi','pythonnet'],
    hookspath=[], hooksconfig={}, runtime_hooks=[], excludes=['tkinter','matplotlib','numpy','torch','transformers'], noarchive=False, optimize=0)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='AetherAmbientStudio', debug=False, strip=False, upx=False,
    console=False, disable_windowed_traceback=False, argv_emulation=False, target_arch=None,
    codesign_identity=None, entitlements_file=None, icon=str(project / 'assets' / 'aether.ico'))
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, upx_exclude=[], name='AetherAmbientStudio')
