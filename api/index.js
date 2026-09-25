let app = null;
let loadError = null;

try {
  app = require('../server');
} catch (err) {
  console.error('Failed to load server.js:', err);
  loadError = err;
}

module.exports = (req, res) => {
  if (loadError) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'error',
      type: 'ModuleLoadError',
      message: loadError.message,
      stack: loadError.stack
    }, null, 2));
    return;
  }

  try {
    return app(req, res);
  } catch (runErr) {
    console.error('Runtime error in Express handler:', runErr);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'error',
      type: 'RuntimeError',
      message: runErr.message,
      stack: runErr.stack
    }, null, 2));
  }
};
