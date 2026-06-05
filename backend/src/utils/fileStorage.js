const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const allowedExtensions = new Set(['.pdf', '.doc', '.docx', '.txt', '.zip']);

function ensureUploadDirectories() {
  for (const dir of [
    env.uploadRoot,
    path.join(env.uploadRoot, 'temp'),
    path.join(env.uploadRoot, 'orders'),
    path.join(env.uploadRoot, 'reports')
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function sanitizeFileName(fileName) {
  const parsed = path.parse(fileName);
  const base = parsed.name
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'file';
  return `${base}${parsed.ext.toLowerCase()}`;
}

function isAllowedFile(fileName) {
  return allowedExtensions.has(path.extname(fileName).toLowerCase());
}

async function moveFile(sourcePath, targetPath) {
  try {
    await fs.promises.rename(sourcePath, targetPath);
  } catch (error) {
    if (error.code !== 'EXDEV') {
      throw error;
    }
    await fs.promises.copyFile(sourcePath, targetPath);
    await fs.promises.unlink(sourcePath);
  }
}

async function removeTempFiles(files = []) {
  await Promise.all(
    files.map(async (file) => {
      try {
        if (file.path) {
          await fs.promises.unlink(file.path);
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`Could not remove temp file ${file.path}: ${error.message}`);
        }
      }
    })
  );
}

async function removeStoredFile(relativePath) {
  if (!relativePath) return;
  const absolutePath = resolveStoredFile(relativePath);
  try {
    await fs.promises.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function storeUploadedFiles(orderNumber, files, category) {
  const folderName = category === 'reports' ? 'reports' : 'orders';
  const targetDir = path.join(env.uploadRoot, folderName, orderNumber);
  await fs.promises.mkdir(targetDir, { recursive: true });

  const stored = [];
  for (const file of files) {
    const safeName = sanitizeFileName(file.originalname);
    const storedFileName = `${orderNumber}-${Date.now()}-${crypto
      .randomBytes(6)
      .toString('hex')}-${safeName}`;
    const targetPath = path.join(targetDir, storedFileName);
    await moveFile(file.path, targetPath);
    stored.push({
      original_file_name: file.originalname,
      stored_file_name: storedFileName,
      file_path: path.relative(env.uploadRoot, targetPath).replace(/\\/g, '/'),
      file_type: file.mimetype || path.extname(file.originalname).slice(1),
      file_size: file.size
    });
  }

  return stored;
}

function resolveStoredFile(relativePath) {
  const absolutePath = path.resolve(env.uploadRoot, relativePath);
  const relative = path.relative(env.uploadRoot, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid file path');
  }
  return absolutePath;
}

module.exports = {
  allowedExtensions,
  ensureUploadDirectories,
  isAllowedFile,
  removeTempFiles,
  removeStoredFile,
  resolveStoredFile,
  storeUploadedFiles
};
