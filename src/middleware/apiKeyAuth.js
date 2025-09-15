const createApiKeyAuth = (options = {}) => {
  const {
    skipPaths = ['/', '/health', '/docs'],
    skipPatterns = [/^\/docs/],
    envOnly = 'production'
  } = options;

  return (req, res, next) => {
        if (skipPaths.includes(req.path)) {
      return next();
    }

        if (skipPatterns.some(pattern => pattern.test(req.path))) {
      return next();
    }

        if (envOnly && process.env.NODE_ENV !== envOnly) {
      return next();
    }

        const isInternalRequest = req.headers['x-internal-request'] === 'true' || 
                             req.headers['x-discord-bot'] === 'true' || 
                             req.headers['user-agent']?.includes('SnaploveDiscordBot') ||
                             req.ip === '127.0.0.1' ||
                             req.ip === '::1' ||
                             req.connection.remoteAddress === '127.0.0.1';
    
    if (isInternalRequest) {
      console.log('🔓 Exempting internal/Discord bot request from API key check');
      return next();
    }

    const apiKey = req.headers['x-api-key'] || req.headers['api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required. Include x-api-key header.',
        hint: 'Contact API administrator for access credentials'
      });
    }

    const allowedApiKeys = process.env.API_KEYS 
      ? process.env.API_KEYS.split(',').map(key => key.trim())
      : [];

    if (allowedApiKeys.length === 0) {
      console.error('⚠️ Warning: No API keys configured in production');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    if (!allowedApiKeys.includes(apiKey)) {
      console.warn(`❌ Invalid API key attempt: ${apiKey.substring(0, 8)}...`);
      return res.status(403).json({
        success: false,
        message: 'Invalid API key'
      });
    }
    
    console.log('✅ API key validation passed');
    next();
  };
};

module.exports = createApiKeyAuth;