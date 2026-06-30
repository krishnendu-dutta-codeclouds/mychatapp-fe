/**
 * Compresses an image file on the client side using HTML5 Canvas.
 * This offloads CPU compression work from the server, reduces upload bandwidth,
 * and speeds up image transfer times.
 * 
 * @param {File} file The original file uploaded by the user
 * @param {number} maxWidth Maximum width allowed for the image
 * @param {number} maxHeight Maximum height allowed for the image
 * @param {number} quality Compression quality between 0.0 and 1.0 (default 0.75)
 * @returns {Promise<File>} A promise that resolves to the compressed File object (or original if not an image)
 */
export function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.75) {
  return new Promise((resolve) => {
    // Only compress images, excluding GIFs which lose animation when drawn to canvas
    if (!file || !file.type.startsWith('image/') || file.type === 'image/gif') {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate target dimensions keeping aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Use JPEG for standard compression, PNG only if original was transparent PNG
        const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            const compressedFile = new File([blob], file.name, {
              type: outputMime,
              lastModified: Date.now()
            });

            // Return compressed file if it's smaller, otherwise keep original
            resolve(compressedFile.size < file.size ? compressedFile : file);
          },
          outputMime,
          quality
        );
      };
      img.src = event.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
