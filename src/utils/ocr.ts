import { createWorker, Worker } from 'tesseract.js';

let worker: Worker | null = null;
let isInitializing = false;

export async function initOCR() {
  if (worker || isInitializing) return;
  isInitializing = true;
  try {
    worker = await createWorker('eng', 1, {
      logger: m => console.log(m)
    });
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789',
    });
    console.log("OCR initialized");
  } catch (e) {
    console.error("OCR init failed", e);
  } finally {
    isInitializing = false;
  }
}

export async function recognizeDigit(canvas: HTMLCanvasElement): Promise<string> {
  if (!worker) {
    await initOCR();
  }
  if (!worker) return '';

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // 1. Find bounding box of the drawing
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        // Check if pixel is not fully transparent
        if (data[i + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          hasPixels = true;
        }
      }
    }

    if (!hasPixels) return '';

    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;

    // 2. Scale Normalization (resize to a standard size, e.g., 300x300 for Tesseract)
    const normSize = 300;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = normSize;
    tempCanvas.height = normSize;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return '';

    // Fill with black background first
    tempCtx.fillStyle = 'black';
    tempCtx.fillRect(0, 0, normSize, normSize);

    // Calculate scale to fit inside normSize with a margin
    const margin = 40;
    const scale = Math.min((normSize - margin * 2) / Math.max(1, cropWidth), (normSize - margin * 2) / Math.max(1, cropHeight));
    
    const scaledWidth = cropWidth * scale;
    const scaledHeight = cropHeight * scale;
    
    // Center the drawing
    const dx = (normSize - scaledWidth) / 2;
    const dy = (normSize - scaledHeight) / 2;

    // Draw cropped original canvas onto tempCanvas
    tempCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, dx, dy, scaledWidth, scaledHeight);

    // 3. Threshold and Invert colors (Black background becomes white, white strokes become black)
    // Tesseract works best with crisp black text on white background.
    // We use a lower threshold to make the strokes slightly thinner, which helps keep the loops of '8' and '6' open.
    const tempImageData = tempCtx.getImageData(0, 0, normSize, normSize);
    const tempData = tempImageData.data;
    for (let i = 0; i < tempData.length; i += 4) {
      // Original: background is black (0), stroke is white (255)
      const brightness = (tempData[i] + tempData[i+1] + tempData[i+2]) / 3;
      // If brightness > 100, we consider it part of the stroke.
      // Making it black (0) for Tesseract, and background white (255).
      const isStroke = brightness > 100;
      const val = isStroke ? 0 : 255;
      
      tempData[i] = val;       // red
      tempData[i + 1] = val;   // green
      tempData[i + 2] = val;   // blue
      tempData[i + 3] = 255;   // alpha
    }
    tempCtx.putImageData(tempImageData, 0, 0);

    // Optional: Add a small padding to the canvas to give Tesseract more context
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = normSize + 40;
    finalCanvas.height = normSize + 40;
    const finalCtx = finalCanvas.getContext('2d');
    if (finalCtx) {
      finalCtx.fillStyle = 'white';
      finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
      finalCtx.drawImage(tempCanvas, 20, 20);
    }

    const { data: { text } } = await worker.recognize(finalCanvas || tempCanvas);
    console.log("OCR recognized:", text);
    // Sometimes 8 is recognized as 'B' or '&' or 'S'. We can add some basic substitutions if we only expect digits.
    let cleanedText = text.trim();
    cleanedText = cleanedText.replace(/[B&]/g, '8');
    cleanedText = cleanedText.replace(/[S]/g, '5');
    cleanedText = cleanedText.replace(/[Z]/g, '2');
    cleanedText = cleanedText.replace(/[O]/g, '0');
    cleanedText = cleanedText.replace(/[lI]/g, '1');
    cleanedText = cleanedText.replace(/[^0-9]/g, '');
    
    return cleanedText;
  } catch (e) {
    console.error("OCR recognition failed", e);
    return '';
  }
}
