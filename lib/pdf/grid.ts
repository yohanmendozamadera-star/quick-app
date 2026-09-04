export type GridCell = { text: string; width: number; bold?: boolean; fontSize?: number };

const BLACK = "#000000";

/** Dibuja una fila de celdas con borde completo (estilo tabla de Word), altura fija. */
export function drawGridRow(doc: PDFKit.PDFDocument, x: number, y: number, cells: GridCell[], rowHeight: number) {
  let cellX = x;
  for (const cell of cells) {
    doc.lineWidth(0.75).rect(cellX, y, cell.width, rowHeight).stroke(BLACK);
    doc
      .font(cell.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(cell.fontSize ?? 9)
      .fillColor(BLACK)
      .text(cell.text, cellX + 4, y + rowHeight / 2 - 4.5, { width: cell.width - 8 });
    cellX += cell.width;
  }
}
