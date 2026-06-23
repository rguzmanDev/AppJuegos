export type DrawPoint = { x: number; y: number; drawing: boolean };
export type DrawStroke = { points: DrawPoint[]; color: string };

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  stroke: DrawStroke,
) {
  if (stroke.points.length === 0) return;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  stroke.points.forEach((pt, i) => {
    const px = pt.x * canvas.width;
    const py = pt.y * canvas.height;
    if (!pt.drawing || i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

export function redrawCanvas(
  canvas: HTMLCanvasElement,
  strokes: DrawStroke[],
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) {
    drawStroke(ctx, canvas, stroke);
  }
}

export function clearCanvasElement(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}
