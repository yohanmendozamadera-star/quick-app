/**
 * Celda de una sola línea, sin ajuste de texto (comportamiento tipo Excel):
 * el contenido nunca aumenta el alto de la fila. Si no cabe, se corta con
 * puntos suspensivos; el usuario puede arrastrar la esquina para ensanchar
 * la columna, o pasar el mouse encima para ver el texto completo.
 */
export function ResizableCell({
  value,
  defaultWidth = 160,
  minWidth = 60,
  maxWidth = 480,
}: {
  value: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}) {
  return (
    <div
      className="resize-x overflow-hidden truncate"
      style={{ width: defaultWidth, minWidth, maxWidth }}
      title={value}
    >
      {value}
    </div>
  );
}
