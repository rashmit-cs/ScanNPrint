"""
ScanNPrint PC Agent - Final
==========================
- Auto-discovers all printers on this PC
- Polls server every 5s for PAID jobs
- Supports: color/BW printer assignment, copies, double-sided, page range
- Handles back-to-back queue (multiple files from one customer session)
- Marks jobs done/failed, deletes temp files

Install: pip install requests schedule pywin32 pymupdf pillow pypdf
         (or: pip install -r requirements.txt)
Run:     python agent.py
Build exe: pyinstaller --onefile --noconsole agent.py
"""

import os, sys, time, requests, schedule, tempfile, subprocess, platform, logging, shutil
from pathlib import Path
from PIL import Image

# ── CONFIG (edit config.env OR set as environment variables) ──────────────
def load_config():
    config_path = Path(__file__).parent / 'config.env'
    if config_path.exists():
        for line in config_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

load_config()

SERVER_URL   = os.environ.get('PRINTDROP_SERVER', 'http://localhost:4000')
SHOP_ID      = os.environ.get('PRINTDROP_SHOP_ID', 'YOUR_SHOP_ID')
AGENT_SECRET = os.environ.get('PRINTDROP_SECRET', 'YOUR_SECRET')

# Path to LibreOffice's soffice executable, used to convert DOC/DOCX to PDF
# before printing. Leave blank to auto-detect (PATH, then default Windows
# install locations). Only needed if LibreOffice was installed somewhere
# non-standard.
LIBREOFFICE_PATH = os.environ.get('LIBREOFFICE_PATH', '')

POLL_INTERVAL   = 5    # seconds between job polls
PRINTER_SYNC    = 60   # seconds between printer re-scan

DOWNLOAD_DIR = Path(tempfile.gettempdir()) / 'ScanNPrint_jobs'
DOWNLOAD_DIR.mkdir(exist_ok=True)

# ── LOGGING ───────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('ScanNPrint_agent.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger('ScanNPrint')

HEADERS = {'Authorization': f'Bearer {AGENT_SECRET}:{SHOP_ID}'}

# ── PRINTER DISCOVERY ─────────────────────────────────────────────────────
# Windows always installs a handful of virtual "printers" that accept jobs
# perfectly fine but never produce physical paper (Print to PDF, XPS Writer,
# Fax, OneNote). If one of these ever gets registered/selected, every job
# routed to it would report success with nothing actually printed — so they
# never even make it into the discovered list.
VIRTUAL_PRINTER_DENYLIST = [
    'microsoft print to pdf',
    'microsoft xps document writer',
    'fax',
    'onenote',
    'adobe pdf',
    'cutepdf',
    'dopdf',
    'novapdf',
    'pdf24',
    'bullzip',
    'send to onenote',
]

def _is_virtual_printer(name: str) -> bool:
    n = name.lower()
    return any(bad in n for bad in VIRTUAL_PRINTER_DENYLIST)

def discover_printers():
    names = []
    if platform.system() == 'Windows':
        try:
            import win32print
            for p in win32print.EnumPrinters(
                win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
            ):
                name = p[2]
                if _is_virtual_printer(name):
                    log.info(f'Ignoring virtual printer: {name}')
                    continue
                names.append(name)
        except Exception as e:
            log.error(f'Printer discovery error: {e}')
    else:
        try:
            out = subprocess.run(['lpstat', '-p'], capture_output=True, text=True)
            for line in out.stdout.splitlines():
                if line.startswith('printer'):
                    name = line.split()[1]
                    if _is_virtual_printer(name):
                        log.info(f'Ignoring virtual printer: {name}')
                        continue
                    names.append(name)
        except Exception as e:
            log.error(f'lpstat error: {e}')
    return names

def sync_printers():
    printers = discover_printers()
    if not printers:
        log.warning('No printers found on this PC')
        return
    log.info(f'Printers found: {printers}')
    try:
        r = requests.post(
            f'{SERVER_URL}/api/agent/register-printers',
            json={'printers': printers},
            headers=HEADERS, timeout=10
        )
        if r.status_code == 200:
            log.info('Printer list synced with server ✓')
        else:
            log.warning(f'Sync failed: {r.text}')
    except Exception as e:
        log.error(f'Printer sync error: {e}')

# ── FILE DOWNLOAD ─────────────────────────────────────────────────────────
def download_file(file_url, filename):
    url = f'{SERVER_URL}{file_url}'
    local_path = DOWNLOAD_DIR / filename
    log.info(f'Downloading {filename}...')
    r = requests.get(url, timeout=(10,120))
    r.raise_for_status()
    local_path.write_bytes(r.content)
    log.info(f'Saved to {local_path}')
    return local_path

from pypdf import PdfReader

# ── PAGE COUNT ────────────────────────────────────────────────────────────
def count_pages(file_path: Path) -> int:
    try:
        if file_path.suffix.lower() == '.pdf':
            return len(PdfReader(str(file_path)).pages)
    except Exception as e:
        log.warning(f'Page count failed: {e}')
    return 1

# ── DOC/DOCX → PDF CONVERSION ───────────────────────────────────────────────
# Word files can't be rasterized by the Windows GDI print path below, so we
# convert them to PDF first via headless LibreOffice, then print/count them
# exactly like a native PDF upload. Requires LibreOffice installed on this PC
# (free, https://www.libreoffice.org/download/download/) — it does not need
# to be the default app, it's only used here in headless/background mode.
def _find_soffice() -> 'str | None':
    # Absolute path from config.env, if set and it actually exists
    if LIBREOFFICE_PATH and os.path.isfile(LIBREOFFICE_PATH):
        return LIBREOFFICE_PATH

    # On PATH? shutil.which checks existence directly — no subprocess spawn,
    # so it can't hang or misbehave the way `soffice --version` sometimes
    # does for a GUI-app binary on Windows.
    on_path = shutil.which('soffice')
    if on_path:
        return on_path

    # Standard Windows install locations
    if platform.system() == 'Windows':
        for c in (
            r'C:\Program Files\LibreOffice\program\soffice.exe',
            r'C:\Program Files (x86)\LibreOffice\program\soffice.exe',
        ):
            if os.path.isfile(c):
                return c

    return None

def convert_doc_to_pdf(file_path: Path) -> 'Path | None':
    """Converts a .doc/.docx file to PDF using headless LibreOffice.
    Returns the path to the converted PDF, or None on failure."""
    soffice = _find_soffice()
    if not soffice:
        log.error('LibreOffice (soffice) not found — cannot convert DOC/DOCX. '
                   'Install LibreOffice or set LIBREOFFICE_PATH in config.env.')
        return None

    out_dir = file_path.parent
    try:
        result = subprocess.run(
            [soffice, '--headless', '--norestore', '--convert-to', 'pdf',
             '--outdir', str(out_dir), str(file_path)],
            capture_output=True, text=True, timeout=90
        )
        expected = out_dir / (file_path.stem + '.pdf')
        if result.returncode != 0 or not expected.exists():
            log.error(f'LibreOffice conversion failed: {result.stderr or result.stdout}')
            return None
        log.info(f'Converted {file_path.name} -> {expected.name} via LibreOffice')
        return expected
    except subprocess.TimeoutExpired:
        log.error(f'LibreOffice conversion timed out for {file_path.name}')
        return None
    except Exception as e:
        log.error(f'LibreOffice conversion error: {e}')
        return None

# ── PRINT ─────────────────────────────────────────────────────────────────
def _parse_page_range(page_range: str, total_pages: int) -> list[int]:
    """Convert 'all', '1-3', '2,4,6' etc. to 0-based page indices."""
    if not page_range or page_range.lower() == 'all':
        return list(range(total_pages))
    indices = []
    for part in page_range.split(','):
        part = part.strip()
        if '-' in part:
            start, end = part.split('-', 1)
            s = max(0, int(start.strip()) - 1)
            e = min(total_pages - 1, int(end.strip()) - 1)
            indices.extend(range(s, e + 1))
        else:
            idx = int(part) - 1
            if 0 <= idx < total_pages:
                indices.append(idx)
    return indices


# DEVMODE field bits + values (winspool.h / wingdi.h). Hardcoded rather than
# pulled from win32con, since not all of these are reliably exposed there
# across pywin32 versions.
_DM_ORIENTATION     = 0x0001
_DM_SCALE           = 0x0010
_DM_DUPLEX          = 0x1000
_DM_COLOR           = 0x0800
_DMORIENT_PORTRAIT  = 1
_DMORIENT_LANDSCAPE = 2
_DMDUP_SIMPLEX      = 1
_DMDUP_VERTICAL     = 2  # long-edge / "book" duplex — the common default
_DMCOLOR_MONOCHROME = 1
_DMCOLOR_COLOR      = 2


def _create_printer_dc(printer_name: str, duplex: bool, landscape: bool = False, color_mode: bool = True):
    """
    Creates a printer DC with a corrected per-job DEVMODE:

      - Scale forced to 100%. This is the fix for jobs printing tiny and
        centered: the DEVMODE returned by GetPrinter() carries whatever
        "reduce/enlarge %" was last saved for this printer (e.g. left over
        from someone using the driver's own print dialog manually).
        Previously that raw structure was passed straight into CreateDC
        without ever checking/resetting Scale — so even though our bitmap
        was drawn at the full, correct size, the driver then re-scaled the
        entire DC's output down by that stale percentage. Adobe Reader
        doesn't hit this because it manages its own per-job scale state
        rather than reusing the printer's persisted DEVMODE as-is.
      - Orientation matched to the actual content (portrait/landscape)
        instead of whatever the printer last had set, so a landscape page
        doesn't get squeezed into a narrower portrait printable area.
      - Duplex applied as before.
      - Color/BW forced via the DEVMODE dmColor field, matching the
        job's requested mode. Driver stacks decide color vs. monochrome
        output based on this field, not on whether the bitmap handed to
        GDI happens to be RGB or grayscale — so without this, a printer
        left on monochrome (the common default, or leftover from a
        prior manual BW job) silently prints every job in BW regardless
        of what the customer selected.

    Deliberately does NOT use win32print.SetPrinter — that mutates the
    printer's PERSISTENT global settings and causes Access Denied on many
    Epson/Canon drivers without elevated rights. This only affects this
    one job's DC via CreateDC's per-job DEVMODE override, not the
    printer's saved settings, so it doesn't hit that failure mode.

    Falls back to a plain, override-free CreatePrinterDC() if anything here
    fails, so a DEVMODE problem never turns into a total print failure —
    worst case, scale/orientation/duplex/color correction is skipped for
    that job.

    IMPORTANT: after setting the fields above, the DEVMODE is round-tripped
    through DocumentProperties(DM_IN_BUFFER | DM_OUT_BUFFER). Several driver
    stacks (notably Epson/Canon consumer drivers) keep a private/extended
    portion of DEVMODE that isn't reconciled just by flipping the public
    dmFields/dmColor bits directly — writing to those fields without this
    validation step is accepted by the win32 API calls (no error raised)
    but silently ignored by the driver at render time. DocumentProperties
    forces the driver's own code to validate and merge the change, which is
    what actually makes color/BW (and the other overrides) take effect.
    """
    import win32con
    import win32gui
    import win32print
    import win32ui
    devmode = None
    try:
        hprinter = win32print.OpenPrinter(printer_name)
        try:
            props = win32print.GetPrinter(hprinter, 2)
            devmode = props.get('pDevMode')
            if devmode is not None:
                devmode.Fields |= _DM_SCALE
                devmode.Scale = 100

                devmode.Fields |= _DM_ORIENTATION
                devmode.Orientation = _DMORIENT_LANDSCAPE if landscape else _DMORIENT_PORTRAIT

                devmode.Fields |= _DM_DUPLEX
                devmode.Duplex = _DMDUP_VERTICAL if duplex else _DMDUP_SIMPLEX

                devmode.Fields |= _DM_COLOR
                devmode.Color = _DMCOLOR_COLOR if color_mode else _DMCOLOR_MONOCHROME

                # Let the driver validate/merge our edits into its full DEVMODE
                # (including any private extended data) rather than trusting
                # our raw struct writes to actually be honored at print time.
                try:
                    devmode = win32print.DocumentProperties(
                        0, hprinter, printer_name, devmode, devmode,
                        win32con.DM_IN_BUFFER | win32con.DM_OUT_BUFFER
                    )
                except Exception as e:
                    log.warning(f'DocumentProperties merge failed for "{printer_name}" '
                                f'(falling back to unmerged DEVMODE): {e}')
        finally:
            win32print.ClosePrinter(hprinter)
    except Exception as e:
        log.warning(f'Could not prepare per-job DEVMODE for "{printer_name}" (will use printer defaults): {e}')
        devmode = None

    if devmode is not None:
        try:
            hDC = win32gui.CreateDC('WINSPOOL', printer_name, devmode)
            return win32ui.CreateDCFromHandle(hDC)
        except Exception as e:
            log.warning(f'CreateDC with per-job DEVMODE failed, falling back to printer defaults: {e}')

    # Fallback: no scale/orientation/duplex overrides, but printing still
    # works using whatever the printer already had set.
    hdc = win32ui.CreateDC()
    hdc.CreatePrinterDC(printer_name)
    return hdc


def _fit_to_page(img, page_w_px: int, page_h_px: int):
    """
    Scales `img` to fit fully within (page_w_px, page_h_px) while preserving
    aspect ratio, then centers it on a white canvas of exactly that size —
    the same behavior as Adobe Reader / Edge's "Fit to Printable Area".

    Uses resize() rather than thumbnail() — thumbnail() only ever shrinks,
    so a source image smaller than the printer's pixel dimensions would be
    left small and centered instead of scaled up to fill the page.
    """
    scale = min(page_w_px / img.width, page_h_px / img.height)
    new_w, new_h = max(1, int(img.width * scale)), max(1, int(img.height * scale))
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new(img.mode, (page_w_px, page_h_px), 'white')
    canvas.paste(resized, ((page_w_px - new_w) // 2, (page_h_px - new_h) // 2))
    return canvas


def _render_and_print_windows(file_path: Path, printer_name: str,
                               print_type: str, copies: int,
                               double_sided: bool, page_range: str) -> bool:
    """
    Render a PDF (or a direct image) and send it to the Windows print
    spooler via win32print / GDI, scaled to fill the printer's printable
    area — matching how Adobe Reader / Edge print the same file, instead of
    the previous behavior of printing tiny and centered on the page.
    """
    import win32print, win32ui, win32con
    from PIL import Image
    from printer_utils import check_printer_ready

    # ── file type check ───────────────────────────────────────────────────
    ext = file_path.suffix.lower()
    if ext not in ('.pdf', '.jpg', '.jpeg', '.png'):
        log.error(f'Unsupported file type: {ext}')
        return False

    try:
        import fitz  # PyMuPDF
        USE_FITZ = True
    except ImportError:
        USE_FITZ = False

    color_mode = print_type.upper() != 'BW'
    target = printer_name if printer_name and printer_name != 'default' \
             else win32print.GetDefaultPrinter()

    log.info(f'Rendering {ext} → printer="{target}" color={color_mode} '
             f'copies={copies} duplex={double_sided} range={page_range}')

    # ── pre-flight printer status check ─────────────────────────────────────
    # Catches the printer already being offline/paused/out-of-paper/in-error
    # BEFORE we spool a job to it — otherwise the spooler accepts the job
    # fine and we'd falsely report success. Does not catch failures that
    # occur mid-job, after this check has already passed.
    ready, reason = check_printer_ready(target)
    if not ready:
        log.error(f'Printer "{target}" not ready: {reason}')
        return False

    # ── determine content + orientation BEFORE creating the DC, so the DC's
    #    DEVMODE (scale/orientation/duplex — see _create_printer_dc) can be
    #    built correctly from the start rather than patched after the fact ─
    landscape  = False
    img_direct = None   # populated for jpg/png path
    doc        = None   # populated for PDF+PyMuPDF path
    reader     = None   # populated for raw-PDF-fallback path (no PyMuPDF)
    page_indices = []

    if ext in ('.jpg', '.jpeg', '.png'):
        img_direct = Image.open(str(file_path)).convert('RGB' if color_mode else 'L')
        landscape = img_direct.width > img_direct.height
        log.info(f'Image mode after convert = {img_direct.mode}')
    elif USE_FITZ:
        doc = fitz.open(str(file_path))
        total_pages = len(doc)
        page_indices = _parse_page_range(page_range, total_pages)
        if page_indices:
            first_rect = doc[page_indices[0]].rect
            landscape = first_rect.width > first_rect.height
    else:
        # Fallback: pypdf → no rasterisation, send raw PDF stream per page.
        # This works only on PostScript/PDF-capable printers. Orientation
        # and scale are entirely up to the printer's own PS interpreter
        # here, not something this function controls — separate known
        # limitation, out of scope for this fix.
        log.warning('PyMuPDF not installed — sending raw PDF bytes (PS printers only)')
        reader = PdfReader(str(file_path))
        total_pages = len(reader.pages)
        page_indices = _parse_page_range(page_range, total_pages)

    # ── color/BW ───────────────────────────────────────────────────────────
    # Enforced two ways: the DEVMODE dmColor field (set in _create_printer_dc,
    # below) tells the driver itself to run in color or monochrome mode, and
    # the image is additionally converted to RGB/L to match. Relying on the
    # image conversion alone isn't enough — driver stacks decide color vs.
    # mono output from dmColor, not from the bitmap's own color mode, so a
    # printer left on monochrome would silently print every job in BW.

    # ── create DC for the printer (scale/orientation/duplex/color corrected) ─
    try:
        hdc = _create_printer_dc(target, double_sided, landscape, color_mode)
    except Exception as e:
        log.error(f'Unable to create printer DC for "{target}": {e}')
        return False

    page_w_px = hdc.GetDeviceCaps(win32con.HORZRES)
    page_h_px = hdc.GetDeviceCaps(win32con.VERTRES)
    dpi_x     = hdc.GetDeviceCaps(win32con.LOGPIXELSX)
    dpi_y     = hdc.GetDeviceCaps(win32con.LOGPIXELSY)
    log.info(f'Printer DC: {page_w_px}×{page_h_px}px @ {dpi_x}×{dpi_y}dpi (landscape={landscape})')

    # ── image (jpg/png) — direct print ──────────────────────────────────────
    if img_direct is not None:
        from PIL import ImageWin
        img = _fit_to_page(img_direct, page_w_px, page_h_px)

        hdc.StartDoc(file_path.name)
        try:
            for copy in range(copies):
                hdc.StartPage()
                dib = ImageWin.Dib(img)
                dib.draw(hdc.GetHandleOutput(), (0, 0, page_w_px, page_h_px))
                hdc.EndPage()
                log.info(f'  Sent image (copy {copy + 1}/{copies})')
        finally:
            hdc.EndDoc()
            hdc.DeleteDC()
        log.info('Image print job complete ✓')
        return True

    # ── raw-PDF fallback (no PyMuPDF installed) — unchanged; separate known
    #    issue, out of scope for this fix ────────────────────────────────
    if reader is not None:
        hdc.DeleteDC()
        hprinter2 = win32print.OpenPrinter(target)
        try:
            win32print.StartDocPrinter(hprinter2, 1, (file_path.name, None, 'RAW'))
            for copy in range(copies):
                for idx in page_indices:
                    win32print.StartPagePrinter(hprinter2)
                    win32print.WritePrinter(hprinter2, file_path.read_bytes())
                    win32print.EndPagePrinter(hprinter2)
            win32print.EndDocPrinter(hprinter2)
        finally:
            win32print.ClosePrinter(hprinter2)
        log.info('Raw PDF job sent ✓')
        return True

    # ── PDF via PyMuPDF — render each page, fit to page, send to spooler ───
    from PIL import ImageWin

    def render_page(idx: int) -> Image.Image:
        page = doc[idx]
        mat  = fitz.Matrix(300 / 72, 300 / 72)  # fixed 300 DPI — avoids bad driver DPI values
        pix  = page.get_pixmap(matrix=mat, alpha=False,
                               colorspace=fitz.csRGB if color_mode else fitz.csGRAY)
        return Image.frombytes('RGB' if color_mode else 'L', [pix.width, pix.height], pix.samples)

    hdc.StartDoc(file_path.name)
    try:
        for copy in range(copies):
            for idx in page_indices:
                img = _fit_to_page(render_page(idx), page_w_px, page_h_px)
                hdc.StartPage()
                dib = ImageWin.Dib(img)
                dib.draw(hdc.GetHandleOutput(), (0, 0, page_w_px, page_h_px))
                hdc.EndPage()
                log.info(f'  Sent page {idx + 1} (copy {copy + 1}/{copies})')
    finally:
        hdc.EndDoc()
        hdc.DeleteDC()
        doc.close()

    log.info('Print job complete ✓')
    return True


def _print_image_grid(local_files: list, printer_name: str, print_type: str,
                       copies: int, images_per_page: int) -> bool:
    """
    Lays several photos out on shared printed pages instead of one photo per page.
    E.g. images_per_page=4 puts 4 photos in a 2x2 grid on each sheet.
    Returns True/False like _render_and_print_windows.
    """
    import win32print, win32ui, win32con
    from PIL import Image, ImageWin
    import math
    from printer_utils import check_printer_ready

    color_mode = print_type.upper() != 'BW'
    target = printer_name if printer_name and printer_name != 'default' else win32print.GetDefaultPrinter()

    log.info(f'Grid print {len(local_files)} images, {images_per_page}/page → "{target}" color={color_mode}')

    # ── pre-flight printer status check ─────────────────────────────────────
    ready, reason = check_printer_ready(target)
    if not ready:
        log.error(f'Printer "{target}" not ready: {reason}')
        return False

    # Color/BW enforced via the DEVMODE dmColor field in _create_printer_dc,
    # same as _render_and_print_windows — the per-image RGB/L conversion
    # below matches it but isn't sufficient by itself (see that function's
    # comment for why).
    try:
        hdc = _create_printer_dc(target, duplex=False, color_mode=color_mode)
    except Exception as e:
        log.error(f'Unable to create printer DC for "{target}": {e}')
        return False

    page_w_px = hdc.GetDeviceCaps(win32con.HORZRES)
    page_h_px = hdc.GetDeviceCaps(win32con.VERTRES)

    # Grid layout: near-square for 4/6, single row for 2, single cell for 1
    cols = {1: 1, 2: 2, 4: 2, 6: 3}.get(images_per_page, math.ceil(math.sqrt(images_per_page)))
    rows = math.ceil(images_per_page / cols)
    cell_w, cell_h = page_w_px // cols, page_h_px // rows
    margin = max(4, cell_w // 40)

    pages = [local_files[i:i + images_per_page] for i in range(0, len(local_files), images_per_page)]

    hdc.StartDoc('ScanNPrint photo sheet')
    try:
        for copy in range(copies):
            for page_files in pages:
                mode = 'RGB' if color_mode else 'L'
                canvas = Image.new(mode, (page_w_px, page_h_px), 'white')
                for idx, fpath in enumerate(page_files):
                    r, c = divmod(idx, cols)
                    img = Image.open(str(fpath)).convert(mode)
                    img.thumbnail((cell_w - 2 * margin, cell_h - 2 * margin), Image.LANCZOS)
                    x = c * cell_w + (cell_w - img.width) // 2
                    y = r * cell_h + (cell_h - img.height) // 2
                    canvas.paste(img, (x, y))

                hdc.StartPage()
                dib = ImageWin.Dib(canvas)
                dib.draw(hdc.GetHandleOutput(), (0, 0, page_w_px, page_h_px))
                hdc.EndPage()
                log.info(f'  Sent photo sheet page (copy {copy + 1}/{copies})')
    finally:
        hdc.EndDoc()
        hdc.DeleteDC()

    log.info('Photo grid print job complete ✓')
    return True


def print_file(file_path: Path,
               printer_name: str,
               print_type: str,
               copies: int,
               double_sided: bool,
               page_range: str) -> bool:
    log.info(f'Printing → printer="{printer_name}" type={print_type} '
             f'copies={copies} double_sided={double_sided} page_range={page_range}')

    if platform.system() == 'Windows':
        try:
            return _render_and_print_windows(
                file_path, printer_name, print_type,
                copies, double_sided, page_range
            )
        except Exception:
            log.exception('Windows print error')
            return False
    else:
        # Linux/Mac — lp fallback
        try:
            cmd = ['lp', str(file_path)]
            if printer_name and printer_name != 'default':
                cmd += ['-d', printer_name]
            if copies > 1:
                cmd += ['-n', str(copies)]
            if double_sided:
                cmd += ['-o', 'sides=two-sided-long-edge']
            if page_range and page_range.lower() != 'all':
                cmd += ['-P', page_range]
            subprocess.run(cmd, check=True)
            log.info('Print job sent via lp ✓')
            return True
        except Exception as e:
            log.error(f'lp error: {e}')
            return False


# ── MARK DONE / FAILED ────────────────────────────────────────────────────
def mark_done(order_id, pages):
    try:
        requests.post(
            f'{SERVER_URL}/api/agent/done/{order_id}',
            json={'pages': pages}, headers=HEADERS, timeout=10
        )
        log.info(f'Order {order_id} → PRINTED ✓')
    except Exception as e:
        log.error(f'mark_done failed: {e}')

def mark_failed(order_id):
    try:
        requests.post(
            f'{SERVER_URL}/api/agent/failed/{order_id}',
            headers=HEADERS, timeout=10
        )
        log.warning(f'Order {order_id} → FAILED')
    except Exception as e:
        log.error(f'mark_failed failed: {e}')

def delete_temp(file_path: Path):
    try:
        file_path.unlink(missing_ok=True)
    except:
        pass

# ── MAIN POLL ─────────────────────────────────────────────────────────────
def poll_jobs():
    try:
        r = requests.get(
            f'{SERVER_URL}/api/agent/jobs',
            headers=HEADERS, timeout=10
        )
        if r.status_code == 403:
            log.warning('Subscription inactive — agent paused')
            return
        if r.status_code != 200:
            log.warning(f'Poll error {r.status_code}: {r.text}')
            return

        jobs = r.json()
        if not jobs:
            return

        log.info(f'Got {len(jobs)} job(s)')

        # Group by queue session so back-to-back prints happen in order
        sessions = {}
        solo = []
        for job in jobs:
            sid = job.get('queueSessionId')
            if sid:
                sessions.setdefault(sid, []).append(job)
            else:
                solo.append(job)

        # Sort each session by queue position
        for sid in sessions:
            sessions[sid].sort(key=lambda j: j.get('queuePosition', 0))

        # Process solo jobs first, then queued sessions in order
        all_groups = [[j] for j in solo] + list(sessions.values())

        for group in all_groups:
            if len(group) > 1:
                log.info(f'Processing queue of {len(group)} files (session {group[0]["queueSessionId"]})')

            for job in group:
                order_id     = job['id']
                file_url     = job['fileUrl']
                filename     = job['fileName']
                printer      = job.get('printerName', 'default')
                print_type   = job.get('printType', 'BW')
                copies       = job.get('copies', 1)
                double_sided = job.get('doubleSided', False)
                page_range   = job.get('pageRange', 'all')
                images_per_page = job.get('imagesPerPage') or 1
                group_files_raw = job.get('imageGroupFiles')

                local_file = None
                converted_file = None
                local_group_files = []
                try:
                    if group_files_raw and images_per_page:
                        # Multiple photos combined onto shared pages — download each, then grid-print
                        import json as _json
                        entries = _json.loads(group_files_raw)
                        for e in entries:
                            lf = download_file(e['url'], f"{order_id}_{e['originalname']}")
                            local_group_files.append(lf)

                        pages = -(-len(local_group_files) // images_per_page)  # ceil div
                        log.info(f'Grid job: {len(local_group_files)} photos, {images_per_page}/page = {pages} sheet(s)')
                        time.sleep(0.5)

                        success = _print_image_grid(local_group_files, printer, print_type, copies, images_per_page) \
                                  if platform.system() == 'Windows' else False
                        if not success and platform.system() != 'Windows':
                            log.error('Photo grid printing is only implemented for Windows agents')

                        if success:
                            time.sleep(2)
                            mark_done(order_id, pages)
                        else:
                            mark_failed(order_id)
                    else:
                        local_file = download_file(file_url, f'{order_id}_{filename}')
                        print_target = local_file

                        if local_file.suffix.lower() in ('.doc', '.docx'):
                            converted_file = convert_doc_to_pdf(local_file)
                            if not converted_file:
                                log.error(f'Job {order_id}: DOC/DOCX conversion failed, cannot print')
                                mark_failed(order_id)
                                continue
                            print_target = converted_file

                        pages = count_pages(print_target)
                        log.info(f'Detected pages = {pages}')
                        time.sleep(0.5)

                        success = print_file(print_target, printer, print_type, copies, double_sided, page_range)

                        if success:
                            # Wait for spooler to accept before next job in queue
                            time.sleep(2)
                            mark_done(order_id, pages)
                        else:
                            mark_failed(order_id)

                except Exception as e:
                    log.error(f'Job {order_id} error: {e}')
                    mark_failed(order_id)
                finally:
                    if local_file:
                        delete_temp(local_file)
                    if converted_file:
                        delete_temp(converted_file)
                    for lf in local_group_files:
                        delete_temp(lf)

    except requests.exceptions.ConnectionError:
        log.warning('Cannot reach server. Will retry...')
    except Exception as e:
        log.error(f'Poll error: {e}')

# ── ENTRY POINT ───────────────────────────────────────────────────────────
if __name__ == '__main__':
    print('=' * 55)
    print('  ScanNPrint PC Agent — Final')
    print(f'  Server : {SERVER_URL}')
    print(f'  Shop ID: {SHOP_ID}')
    print(f'  Polling every {POLL_INTERVAL}s')
    print('=' * 55)

    if SHOP_ID == 'YOUR_SHOP_ID':
        print('\n⚠️  SHOP_ID not set! Edit config.env first.\n')
        sys.exit(1)

    # Sync printers immediately on start
    sync_printers()

    schedule.every(POLL_INTERVAL).seconds.do(poll_jobs)
    schedule.every(PRINTER_SYNC).seconds.do(sync_printers)

    while True:
        schedule.run_pending()
        time.sleep(1)