const multer = require('multer');
const { ZodError } = require('zod');

function notFound(req, res, next) {
  res.status(404).json({ message: 'Route not found.' });
}

function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: 'Validation failed.',
      errors: error.errors.map((item) => ({
        field: item.path.join('.'),
        message: item.message
      }))
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large.'
        : error.code === 'LIMIT_FILE_COUNT'
          ? 'Too many files uploaded.'
          : error.message;
    res.status(400).json({ message });
    return;
  }

  if (error.message && error.message.startsWith('Invalid file type.')) {
    res.status(400).json({ message: error.message });
    return;
  }

  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Something went wrong.' : error.message;
  if (statusCode === 500) {
    console.error(error);
  }
  res.status(statusCode).json({ message });
}

module.exports = {
  errorHandler,
  notFound
};
