function databaseNameFromUri(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?[^/?]+(?:\/([^?]*))?/.exec(uri || '');
  if (!match) throw new Error('MONGODB_URI is not a mongodb:// or mongodb+srv:// URI');
  return match[1] ? decodeURIComponent(match[1]) : null;
}

module.exports = { databaseNameFromUri };
