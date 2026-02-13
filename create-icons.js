const fs = require('fs');

// Simple base64 PNG images for different sizes
// These are minimal valid 1x1 cyan PNG files encoded in base64
// For production, you'd want to use actual icon files

const iconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

// Create icon files by decoding and writing
const sizes = [192, 512, 180];
sizes.forEach(size => {
  const buffer = Buffer.from(iconBase64, 'base64');
  fs.writeFileSync(`icon-${size}x${size}.png`, buffer);
  console.log(`Created icon-${size}x${size}.png`);
});
