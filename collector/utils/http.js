function reqBody(request = {}) {
  return request.body || {};
}

module.exports = {
  reqBody,
}; 