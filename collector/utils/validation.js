function validURL(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  validURL,
}; 