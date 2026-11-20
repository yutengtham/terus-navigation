/** Shrinks a photo in the browser so its longest side is at most `max` px (JPEG). Returns null if it can't be read. */
export async function resizePhoto(file: Blob, max = 1080): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k);
    const h = Math.round(bmp.height * k);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return await new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.85));
  } catch {
    return null;
  }
}
