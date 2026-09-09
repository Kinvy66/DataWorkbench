"""Write a large CSV for P1 virtual-table smoke tests.

Usage (from repo root):

  python/.venv/Scripts/python.exe scripts/gen_large_csv.py
  python/.venv/Scripts/python.exe scripts/gen_large_csv.py --rows 500000 --out large_500k.csv
"""

from __future__ import annotations

import argparse
from pathlib import Path


def write_csv(path: Path, rows: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        handle.write("id,value\n")
        for i in range(rows):
            handle.write(f"{i},{i * 0.1}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a large CSV for DataWorkbench P1 tests")
    parser.add_argument("--rows", type=int, default=500_000)
    parser.add_argument("--out", type=Path, default=Path("large_500k.csv"))
    args = parser.parse_args()
    write_csv(args.out, args.rows)
    print(f"wrote {args.rows} rows to {args.out.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
