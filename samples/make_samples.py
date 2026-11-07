"""Genera archivos de muestra para probar el flujo SIN datos reales.
Incluye a propósito: un duplicado, un valor vacío, una fecha en otro formato,
un estado con mayúsculas raras, un estado fuera de catálogo y un valor atípico.
Uso: pip install openpyxl reportlab && python samples/make_samples.py
"""
from datetime import date, timedelta
from pathlib import Path
from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

OUT = Path(__file__).parent
clientes = ["Cliente A", "Cliente B", "Cliente C", "Cliente D"]
categorias = ["Servicio A", "Servicio B", "Servicio C"]
estados = ["Completado", "Pendiente", "Cancelado"]

# ---------- Excel ----------
wb = Workbook()
ws = wb.active
ws.title = "Registros"
ws.append(["Fecha", "Cliente", "Categoría", "Cantidad", "Valor", "Estado"])
base = date(2026, 10, 1)
rows = []
for i in range(20):
    rows.append([base + timedelta(days=i), clientes[i % 4], categorias[i % 3],
                 (i % 5) + 1, 1500 * ((i % 4) + 1), estados[i % 3]])
rows[3][5] = "completado "                 # estado con minúscula y espacio -> se normaliza
rows[5][4] = None                          # valor vacío -> error
rows[7][0] = "15/10/2026"                  # fecha como texto dd/mm/yyyy -> se normaliza
rows[9][5] = "Raro"                        # estado fuera de catálogo -> warning
rows[11][4] = 9500000                      # valor atípico (lo debería marcar la IA)
rows.append(list(rows[0]))                 # duplicado exacto de la primera fila
for r in rows:
    ws.append(r)
wb.save(OUT / "sample_registros.xlsx")

# ---------- PDF (bloques "Etiqueta: valor") ----------
c = canvas.Canvas(str(OUT / "sample_reporte.pdf"), pagesize=A4)
y = 800
c.setFont("Helvetica-Bold", 14)
c.drawString(50, y, "Reporte operativo semanal")
y -= 30
c.setFont("Helvetica", 11)
registros = [
    ("2026-10-26", "Cliente A", "REF-0001", "Servicio A", "$1.500.000", "Completado"),
    ("2026-10-27", "Cliente B", "REF-0002", "Servicio B", "$2.750.000", "Pendiente"),
    ("27 de octubre de 2026", "Cliente C", "REF-0003", "Servicio A", "$980.000", "Completado"),
    ("2026-10-29", "Cliente D", "REF-0004", "Servicio C", "$3.200.000", "Cancelado"),
    ("2026-10-30", "Cliente A", "REF-0005", "Servicio B", "$1.100.500", "Completado"),
]
for fecha, cli, ref, cat, val, est in registros:
    for label, value in [("Fecha", fecha), ("Cliente", cli), ("Número de referencia", ref),
                         ("Categoría", cat), ("Valor", val), ("Estado", est)]:
        c.drawString(50, y, f"{label}: {value}")
        y -= 16
    y -= 12
c.save()
print("Muestras generadas en", OUT)
