const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadRoot = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const extensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const isSupportedImage = (filePath) => {
  const descriptor = fs.openSync(filePath, 'r');
  const header = Buffer.alloc(12);
  fs.readSync(descriptor, header, 0, header.length, 0);
  fs.closeSync(descriptor);

  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPng = header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP';
  return isJpeg || isPng || isWebp;
};

const removeUploadedFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

const createImageUpload = ({ directory, prefix, maxSizeMb = 5 }) => multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      const destination = path.join(uploadRoot, directory);
      fs.mkdirSync(destination, { recursive: true });
      callback(null, destination);
    },
    filename: (req, file, callback) => {
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      callback(null, `${typeof prefix === 'function' ? prefix(req) : prefix}-${suffix}${extensions[file.mimetype]}`);
    }
  }),
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
  handleSingleImage,
  isSupportedImage,
  removeUploadedFile,
  uploadRoot
};
