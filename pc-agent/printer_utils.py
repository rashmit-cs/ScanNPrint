import win32print

# Printer status bits that mean a job submitted right now will NOT actually
# produce paper, even though the spooler will happily accept it anyway.
# This is a pre-flight check only — it catches the printer already being in
# a known-bad state (off, paused, out of paper) BEFORE we spool a job to it.
# It cannot catch a jam/paper-out that occurs mid-job, after this check has
# already passed — that would need ongoing job-status polling, which is a
# larger change than this minimal pre-flight guard.
_BLOCKING_STATUS_FLAGS = {
    'PRINTER OFFLINE':            win32print.PRINTER_STATUS_OFFLINE,
    'PRINTER ERROR':              win32print.PRINTER_STATUS_ERROR,
    'OUT OF PAPER':                win32print.PRINTER_STATUS_PAPER_OUT,
    'PAPER JAM':                  win32print.PRINTER_STATUS_PAPER_JAM,
    'PAPER PROBLEM':              win32print.PRINTER_STATUS_PAPER_PROBLEM,
    'PRINTER PAUSED':             win32print.PRINTER_STATUS_PAUSED,
    'USER INTERVENTION REQUIRED': win32print.PRINTER_STATUS_USER_INTERVENTION,
    'DOOR OPEN':                  win32print.PRINTER_STATUS_DOOR_OPEN,
    'OUT OF TONER/INK':           win32print.PRINTER_STATUS_NO_TONER,
    'PRINTER NOT AVAILABLE':      win32print.PRINTER_STATUS_NOT_AVAILABLE,
}


def check_printer_ready(printer_name: str):
    """
    Returns (ready: bool, reason: str | None).
    Call this right before spooling a job — NOT a substitute for real job-status
    monitoring, just catches the common "printer is already off/paused/empty"
    case so we don't mark an order PRINTED when nothing could have come out.
    """
    try:
        hprinter = win32print.OpenPrinter(printer_name)
    except Exception as e:
        return False, f'Could not open printer: {e}'

    try:
        info = win32print.GetPrinter(hprinter, 2)
        status = info.get('Status', 0)
    except Exception as e:
        return False, f'Could not read printer status: {e}'
    finally:
        win32print.ClosePrinter(hprinter)

    for label, flag in _BLOCKING_STATUS_FLAGS.items():
        if status & flag:
            return False, label

    return True, None