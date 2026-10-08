import sharp from 'sharp';

const sizes = [192, 512];

for (const size of sizes) {
  await sharp('public/logo.jpeg')
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(`public/icons/icon-${size}.png`);
  console.log(`Generated icon-${size}.png`);
}

console.log('Done!');
