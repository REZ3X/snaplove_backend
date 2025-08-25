const docsAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Snaplove API Documentation"');
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  try {
    const credentials = Buffer.from(auth.slice(6), 'base64').toString();
    const [username, password] = credentials.split(':');

    const expectedUsername = process.env.DOCS_USERNAME || 'admin';
    const expectedPassword = process.env.DOCS_PASSWORD || 'admin';

    if (username === expectedUsername && password === expectedPassword) {
      return next();
    } else {
      res.setHeader('WWW-Authenticate', 'Basic realm="Snaplove API Documentation"');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
  } catch (error) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Snaplove API Documentation"');
    return res.status(401).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

module.exports = docsAuth;