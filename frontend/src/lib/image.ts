/**
 * Client-side обрезка изображения в квадрат 128×128 (кроп по центру) и
 * экспорт в data-URL — для аватарок пользователей и логотипов компаний.
 * Круглая маска рисуется в UI: файл остаётся квадратным.
 */
export async function cropToSquareDataUrl(
  file: File,
  size = 128,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });

  // SVG-логотипы не растеризуем — они и так лёгкие и масштабируемые.
  if (file.type === 'image/svg+xml') return dataUrl;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Не удалось открыть изображение'));
    el.src = dataUrl;
  });

  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен');
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/png');
}
