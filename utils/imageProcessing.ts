import { Rect } from '../types';

/**
 * Loads an image from a source (URL or base64)
 */
export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
};

/**
 * Crops an image based on coordinates.
 * Returns two versions:
 * 1. blobUrl: Transparent PNG for user UI/Download.
 * 2. base64Data: White background JPEG optimized for AI OCR.
 * 
 * @param sourceImage The original full-size image object
 * @param cropRect The rectangle to crop (relative to the actual image dimensions)
 */
export const processSignatureCrop = (
  sourceImage: HTMLImageElement,
  cropRect: Rect
): { blobUrl: string; base64Data: string } => {
  // 1. Create Transparent Canvas for User
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  canvas.width = cropRect.width;
  canvas.height = cropRect.height;

  // Draw crop
  ctx.drawImage(
    sourceImage,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    cropRect.width,
    cropRect.height
  );

  // --- Image Processing for Transparency (User Version) ---
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const threshold = 200; // Background whiteness threshold

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Simple background removal
    if (r > threshold && g > threshold && b > threshold) {
      data[i + 3] = 0; // Transparent
    } else {
      // Enhance stroke contrast
      const avg = (r + g + b) / 3;
      if (avg < 180) {
        data[i] = Math.max(0, r - 60);
        data[i + 1] = Math.max(0, g - 60);
        data[i + 2] = Math.max(0, b - 60);
        data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
  
  const blobUrl = canvas.toDataURL('image/png');


  // 2. Create White Background Canvas for AI (Better Accuracy)
  const aiCanvas = document.createElement('canvas');
  aiCanvas.width = cropRect.width;
  aiCanvas.height = cropRect.height;
  const aiCtx = aiCanvas.getContext('2d');
  
  if (aiCtx) {
    // Fill white background first (Critical for AI recognition)
    aiCtx.fillStyle = '#FFFFFF';
    aiCtx.fillRect(0, 0, aiCanvas.width, aiCanvas.height);
    
    // Draw original image on top
    aiCtx.drawImage(
      sourceImage,
      cropRect.x,
      cropRect.y,
      cropRect.width,
      cropRect.height,
      0,
      0,
      cropRect.width,
      cropRect.height
    );

    // Optional: Enhance contrast for AI too (Convert to grayscale/high contrast)
    const aiImageData = aiCtx.getImageData(0, 0, aiCanvas.width, aiCanvas.height);
    const aiData = aiImageData.data;
    for (let i = 0; i < aiData.length; i += 4) {
       const r = aiData[i];
       const g = aiData[i + 1];
       const b = aiData[i + 2];
       // High contrast thresholding
       const avg = (r + g + b) / 3;
       if (avg > 200) {
         // Make background pure white
         aiData[i] = 255; aiData[i+1] = 255; aiData[i+2] = 255;
       } else {
         // Make text darker
         aiData[i] = Math.max(0, r - 50);
         aiData[i+1] = Math.max(0, g - 50);
         aiData[i+2] = Math.max(0, b - 50);
       }
    }
    aiCtx.putImageData(aiImageData, 0, 0);
  }

  // Use JPEG for AI (smaller size, no alpha channel issues)
  const aiDataURL = aiCanvas.toDataURL('image/jpeg', 0.9);
  const base64Data = aiDataURL.replace(/^data:image\/jpeg;base64,/, '');

  return {
    blobUrl: blobUrl,
    base64Data: base64Data
  };
};