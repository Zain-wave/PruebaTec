"""Compatibilidad: el generador real ahora es scripts/build_workflows.js (Node).

Se mantiene este wrapper para que `python scripts/build_workflows.py` siga
funcionando en máquinas que tengan Python, sin duplicar la lógica.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
cmd = ["node", str(ROOT / "build_workflows.js"), *sys.argv[1:]]
raise SystemExit(subprocess.call(cmd))
