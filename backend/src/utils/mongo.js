const { Types } = require('mongoose');
const HttpError = require('./httpError');

function parseObjectId(value) {
  if (!Types.ObjectId.isValid(value)) {
    throw new HttpError(400, 'Invalid id.');
  }
  return new Types.ObjectId(value);
}

function objectIdEquals(left, right) {
  return left && right && left.toString() === right.toString();
}

function plain(doc) {
  if (!doc) return null;
  return typeof doc.toJSON === 'function' ? doc.toJSON() : doc;
}

function plainMany(docs = []) {
  return docs.map(plain);
}

module.exports = {
  objectIdEquals,
  parseObjectId,
  plain,
  plainMany
};
