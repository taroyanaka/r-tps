from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


SKIP_DIRS = {".git", "__pycache__", ".agents", ".codex", "node_modules"}
TEXT_EXTENSIONS = {".css", ".html", ".js", ".json", ".md", ".py", ".txt"}

# Common mojibake fragments from UTF-8 text that was mis-decoded as CP932/Shift-JIS.
MOJIBAKE_MARKERS = (
    "郢ｧ", "邵ｺ", "隴ｫ", "陟・, "隰ｫ", "髫・, "闕ｳ", "陝・, "陷ｷ", "鬮ｫ",
    "鬮｢", "陟｢", "陞・, "髴・, "髴・, "髫ｱ", "陞・, "陷ｿ", "陷・, "陋ｻ",
)

# If a line is already mostly ASCII, don't spend time trying to "repair" it.
JP_CHAR_RE = re.compile(r"[\u3040-\u30ff\u4e00-\u9fff]")


@dataclass
class LineFix:
    lineno: int
    original: str
    repaired: str


@dataclass
class FileReport:
    path: Path
    utf8_ok: bool
    fixes: list[LineFix]


def iter_files(root: Path) -> Iterable[Path]:
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        yield path


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def marker_count(text: str) -> int:
    return sum(text.count(marker) for marker in MOJIBAKE_MARKERS)


def repair_candidate(text: str) -> str | None:
    try:
        return text.encode("cp932").decode("utf-8")
    except UnicodeError:
        return None


def is_good_repair(original: str, repaired: str) -> bool:
    if original == repaired:
        return False
    if marker_count(repaired) >= marker_count(original):
        return False
    if not JP_CHAR_RE.search(repaired):
        return False
    # Avoid replacing very short ASCII-ish lines with nonsense.
    if len(repaired) < 4:
        return False
    return True


def scan_file(path: Path) -> FileReport:
    try:
        text = read_text(path)
        utf8_ok = True
    except UnicodeError:
        return FileReport(path=path, utf8_ok=False, fixes=[])

    fixes: list[LineFix] = []
    for lineno, line in enumerate(text.splitlines(), 1):
        if not any(marker in line for marker in MOJIBAKE_MARKERS):
            continue
        repaired = repair_candidate(line)
        if repaired and is_good_repair(line, repaired):
            fixes.append(LineFix(lineno, line, repaired))

    return FileReport(path=path, utf8_ok=utf8_ok, fixes=fixes)


def apply_fixes(path: Path, fixes: list[LineFix]) -> bool:
    if not fixes:
        return False

    text = read_text(path)
    lines = text.splitlines(keepends=True)
    changed = False
    by_line = {fix.lineno: fix.repaired for fix in fixes}

    for lineno, repaired in by_line.items():
        idx = lineno - 1
        if not (0 <= idx < len(lines)):
            continue
        line = lines[idx]
        newline = ""
        if line.endswith("\r\n"):
            newline = "\r\n"
        elif line.endswith("\n"):
            newline = "\n"
        elif line.endswith("\r"):
            newline = "\r"
        lines[idx] = repaired + newline
        changed = True

    if changed:
        path.write_text("".join(lines), encoding="utf-8", newline="")
    return changed


def configure_stdio() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")


def main() -> int:
    configure_stdio()

    parser = argparse.ArgumentParser(
        description="Scan text files for UTF-8 issues and suspicious mojibake."
    )
    parser.add_argument("root", nargs="?", default=".", help="Root directory to scan.")
    parser.add_argument("--fix", action="store_true", help="Write repaired lines back.")
    parser.add_argument(
        "--report-only",
        action="store_true",
        help="Only report issues; do not write changes.",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    reports = [scan_file(path) for path in iter_files(root)]
    utf8_failures = [r for r in reports if not r.utf8_ok]
    suspicious = [r for r in reports if r.fixes]

    print(f"Scanned: {len(reports)} files")
    print(f"UTF-8 decode failures: {len(utf8_failures)}")
    print(f"Suspicious mojibake files: {len(suspicious)}")

    for report in utf8_failures:
        print(f"[UTF8-FAIL] {report.path}")

    for report in suspicious:
        print(f"[MOJIBAKE] {report.path}")
        for fix in report.fixes[:10]:
            print(f"  L{fix.lineno}: {fix.original!r}")
            print(f"       -> {fix.repaired!r}")

    if args.fix and not args.report_only:
        changed_files = 0
        for report in suspicious:
            if apply_fixes(report.path, report.fixes):
                changed_files += 1
        print(f"Repaired files: {changed_files}")

    return 0 if not utf8_failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
