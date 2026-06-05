function transformDocument(doc, ret) {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
}

const jsonOptions = {
  virtuals: true,
  transform: transformDocument
};

function schemaOptions(timestamps = true) {
  return {
    timestamps,
    toJSON: jsonOptions,
    toObject: jsonOptions
  };
}

module.exports = {
  schemaOptions
};
