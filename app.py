"""AETHER — Ambient Studio.

A small native Windows shell around a self-contained Web Audio studio.
The UI is served from localhost, audio is synthesized in WebView2 and rendered
WAV files are written through a tiny native bridge.
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import re
import sys
import threading
import time
import traceback
import urllib.parse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

APP_TITLE = "AETHER — Ambient Studio"
APP_VERSION = "1.0.0"


def bundle_root() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parent


ROOT = bundle_root()
UI_DIR = ROOT / "ui"
ICON_PATH = ROOT / "assets" / "aether.ico"
LOCAL_APP = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "AetherAmbientStudio"
LOG_DIR = LOCAL_APP / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "app.log"
ACTIVE_LOG_FILE = LOG_FILE


def configure_logging() -> None:
    """Configure file logging without letting a locked log abort startup.

    A second instance (or the dev server) may already hold app.log open.
    Windows then rejects another FileHandler, so fall back to a per-PID file
    and finally to stderr. Logging must never prevent the UI from starting.
    """
    global ACTIVE_LOG_FILE
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    candidates = [
        LOG_FILE,
        LOG_DIR / f"app-{os.getpid()}.log",
        Path(os.environ.get("TEMP", str(LOCAL_APP))) / f"AetherAmbientStudio-{os.getpid()}.log",
    ]
    for candidate in candidates:
        try:
            handler = logging.FileHandler(candidate, mode="a", encoding="utf-8")
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            ACTIVE_LOG_FILE = candidate
            break
        except OSError:
            continue
    else:
        handler = logging.StreamHandler()
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logging.info("Starting %s %s (frozen=%s, root=%s)", APP_TITLE, APP_VERSION, getattr(sys, "frozen", False), ROOT)


class LocalHandler(SimpleHTTPRequestHandler):
    """Static file handler with sane MIME types and no caching while iterating."""

    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".png": "image/png",
    }

    def end_headers(self) -> None:  # noqa: D401
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        logging.debug("http: " + fmt, *args)


def start_server(port: int = 0) -> tuple[ThreadingHTTPServer, int]:
    if not (UI_DIR / "index.html").is_file():
        raise FileNotFoundError(f"UI assets are missing: {UI_DIR}")
    handler = partial(LocalHandler, directory=str(UI_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", int(port)), handler)
    server.daemon_threads = True
    thread = threading.Thread(target=server.serve_forever, name="aether-http", daemon=True)
    thread.start()
    actual_port = int(server.server_address[1])
    logging.info("HTTP server listening on 127.0.0.1:%s", actual_port)
    return server, actual_port


class Api:
    """Native bridge exposed to the page as window.pywebview.api."""

    def __init__(self) -> None:
        self.started_at = time.time()

    def save_wav(self, b64_data: str, suggested_name: str) -> str:
        import webview  # imported lazily so --serve mode stays headless

        if not b64_data or not isinstance(b64_data, str):
            raise ValueError("Empty WAV payload")
        if len(b64_data) > 120_000_000:
            raise ValueError("WAV payload is too large")
        raw = base64.b64decode(b64_data, validate=True)
        if raw[:4] != b"RIFF" or raw[8:12] != b"WAVE":
            raise ValueError("Not a RIFF/WAVE payload")

        name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", str(suggested_name or "AETHER Ambient.wav")).strip()
        if not name.lower().endswith(".wav"):
            name += ".wav"
        name = name[:120]

        default_dir = Path.home() / "Music"
        if not default_dir.is_dir():
            default_dir = Path.home() / "Documents"
        if not default_dir.is_dir():
            default_dir = Path.home()

        target: Path | None = None
        dialog_failed = False
        try:
            if not webview.windows:
                raise RuntimeError("No window is available")
            result = webview.windows[0].create_file_dialog(
                webview.SAVE_DIALOG,
                directory=str(default_dir),
                save_filename=name,
                file_types=("WAV audio (*.wav)", "All files (*.*)"),
            )
            if not result:
                # pywebview returns None/() when the dialog is cancelled.
                logging.info("WAV save dialog cancelled")
                return ""
            value = result[0] if isinstance(result, (tuple, list)) else result
            target = Path(str(value))
            logging.info("WAV save dialog selected: %s", target)
        except Exception as exc:  # dialog can be unavailable on some Windows shells
            logging.exception("Save dialog failed: %s", exc)
            dialog_failed = True

        if target is None:
            # A technical dialog failure should still produce the file.  A
            # deliberate cancel was handled above and never reaches this line.
            target = default_dir / name
            logging.info("Auto-saving WAV to %s (dialog_failed=%s)", target, dialog_failed)

        if target.suffix.lower() != ".wav":
            target = target.with_suffix(".wav")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
        logging.info("Wrote %s bytes to %s", len(raw), target)
        return str(target)

    def load_settings(self) -> str:
        """Return persisted UI settings (themes and preferences) as JSON text."""
        path = LOCAL_APP / "settings.json"
        try:
            if path.is_file():
                return path.read_text(encoding="utf-8")
        except OSError:
            logging.exception("Could not read settings")
        return ""

    def save_settings(self, payload: str) -> bool:
        """Atomically persist UI settings. Payload is validated JSON."""
        if not isinstance(payload, str) or len(payload) > 300_000:
            raise ValueError("Invalid settings payload")
        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError as exc:
            raise ValueError("Settings must be valid JSON") from exc
        if not isinstance(parsed, dict):
            raise ValueError("Settings root must be an object")
        path = LOCAL_APP / "settings.json"
        temporary = path.with_suffix(".json.tmp")
        try:
            temporary.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
            os.replace(temporary, path)
        except OSError:
            logging.exception("Could not write settings")
            raise
        return True

    def log_error(self, message: str) -> None:
        logging.error("JS: %s", str(message)[:4000])
        return None

    def get_version(self) -> str:
        return APP_VERSION

    def quit(self) -> None:
        import webview

        logging.info("Quit requested from UI")
        for window in list(webview.windows):
            try:
                window.destroy()
            except Exception:
                logging.exception("Failed to destroy window")


def get_work_area() -> tuple[int, int, int, int]:
    """Return the usable desktop rect in the same logical units as pywebview."""
    if sys.platform == "win32":
        try:
            import ctypes
            from ctypes import wintypes

            rect = wintypes.RECT()
            if ctypes.windll.user32.SystemParametersInfoW(48, 0, ctypes.byref(rect), 0):
                width = max(1, int(rect.right - rect.left))
                height = max(1, int(rect.bottom - rect.top))
                return int(rect.left), int(rect.top), width, height
            width = int(ctypes.windll.user32.GetSystemMetrics(0))
            height = int(ctypes.windll.user32.GetSystemMetrics(1))
            return 0, 0, max(1, width), max(1, height)
        except Exception:
            logging.debug("Work area detection failed", exc_info=True)
    return 0, 0, 1920, 1080


def preferred_window_size() -> tuple[int, int, int, int]:
    left, top, work_w, work_h = get_work_area()
    width = max(1160, min(1560, work_w - 40))
    height = max(760, min(960, work_h - 8))
    x = left + max(0, (work_w - width) // 2)
    y = top + max(0, (work_h - height) // 2)
    return width, height, x, y


def set_dark_title_bar(title: str) -> None:
    """Best-effort dark native title bar on Windows 10/11."""
    if sys.platform != "win32":
        return
    try:
        import ctypes

        hwnds: list[int] = []

        @ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
        def enum_proc(hwnd, _lparam):
            length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
            if length:
                buffer = ctypes.create_unicode_buffer(length + 1)
                ctypes.windll.user32.GetWindowTextW(hwnd, buffer, length + 1)
                if buffer.value == title:
                    hwnds.append(int(hwnd))
            return True

        ctypes.windll.user32.EnumWindows(enum_proc, 0)
        for hwnd in hwnds:
            value = ctypes.c_int(1)
            for attribute in (20, 19):
                ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, attribute, ctypes.byref(value), ctypes.sizeof(value))
    except Exception:
        logging.debug("Dark title bar unavailable", exc_info=True)


def main() -> int:
    configure_logging()
    parser = argparse.ArgumentParser(description=APP_TITLE)
    parser.add_argument("--serve", action="store_true", help="run only the local HTTP server (tests)")
    parser.add_argument("--port", type=int, default=0, help="HTTP port; 0 chooses a free port")
    parser.add_argument("--debug", action="store_true", help="open WebView devtools")
    args = parser.parse_args()

    if args.serve:
        server, port = start_server(args.port)
        print(f"AETHER_PORT={port}", flush=True)
        print(f"AETHER_URL=http://127.0.0.1:{port}/", flush=True)
        try:
            while True:
                time.sleep(1.0)
        except KeyboardInterrupt:
            server.shutdown()
        return 0

    import webview  # noqa: F401

    server, port = start_server(args.port)
    url = f"http://127.0.0.1:{port}/index.html"
    api = Api()
    logging.info("Opening %s", url)

    win_w, win_h, win_x, win_y = preferred_window_size()
    logging.info("Window geometry: %sx%s at %s,%s", win_w, win_h, win_x, win_y)
    window = webview.create_window(
        APP_TITLE,
        url=url,
        js_api=api,
        width=win_w,
        height=win_h,
        x=win_x,
        y=win_y,
        min_size=(1160, 740),
        resizable=True,
        background_color="#050a0d",
        text_select=False,
        confirm_close=False,
        zoomable=False,
    )
    if window is None:
        raise RuntimeError("Could not create the application window")

    def on_started() -> None:
        time.sleep(1.2)
        set_dark_title_bar(APP_TITLE)

    try:
        webview.start(
            func=on_started,
            gui="edgechromium",
            debug=bool(args.debug or os.environ.get("AETHER_DEBUG") == "1"),
            private_mode=False,
            storage_path=str(LOCAL_APP / "webview"),
            icon=str(ICON_PATH) if ICON_PATH.is_file() else None,
        )
    finally:
        server.shutdown()
        logging.info("Application closed")
    return 0


def selftest() -> int:
    configure_logging()
    required = [
        UI_DIR / "index.html",
        UI_DIR / "css" / "app.css",
        UI_DIR / "js" / "app.js",
        UI_DIR / "js" / "instruments.js",
        UI_DIR / "js" / "composer.js",
        UI_DIR / "js" / "audio.js",
    ]
    payload = {
        "version": APP_VERSION,
        "root": str(ROOT),
        "ui": str(UI_DIR),
        "assets": {str(path.relative_to(ROOT)): path.is_file() for path in required},
        "icon": ICON_PATH.is_file(),
        "python": sys.version,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if all(payload["assets"].values()) else 1


if __name__ == "__main__":
    try:
        if "--selftest" in sys.argv:
            raise SystemExit(selftest())
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception:
        logging.exception("Fatal startup error")
        try:
            import ctypes

            ctypes.windll.user32.MessageBoxW(
                0,
                "AETHER не смог запуститься.\n\n"
                f"Подробности: {ACTIVE_LOG_FILE}\n\n"
                + traceback.format_exc(limit=4),
                APP_TITLE,
                0x10,
            )
        except Exception:
            print(traceback.format_exc(), file=sys.stderr)
        raise
