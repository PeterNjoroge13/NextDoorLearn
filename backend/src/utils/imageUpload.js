const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadRoot = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const extensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const readImage = (source) => {
  if (Buffer.isBuffer(source)) return source;
  return fs.readFileSync(source);
};

const detectImageMime = (source) => {
  const image = readImage(source);
  const header = Buffer.alloc(12);
  image.copy(header, 0, 0, Math.min(image.length, header.length));

  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPng = header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP';
  if (isJpeg) return 'image/jpeg';
  if (isPng) return 'image/png';
  if (isWebp) return 'image/webp';
  return null;
};

const isSupportedImage = (source) => Boolean(detectImageMime(source));

const removeUploadedFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

const createImageUpload = ({ maxSizeMb = 5 }) => multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSizeMb * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (extensions[file.mimetype]) return callback(null, true);
    callback(new Error('Upload a JPG, PNG, or WebP image'));
  }
});

const handleSingleImage = (upload, fieldName) => (req, res, next) => {
  upload.single(fieldName)(req, res, (error) => {
    if (error) return res.status(400).json({ error: error.message || 'Image upload failed' });
    next();
  });
};

module.exports = {
  createImageUpload,
  detectImageMime,
  handleSingleImage,
  isSupportedImage,
  removeUploadedFile,
  uploadRoot
};
