const { UAParser } = require('ua-parser-js');

function parseUserAgent(uaString) {
  const parser = new UAParser(uaString || '');
  const result = parser.getResult();

  const browser = [result.browser.name, result.browser.version]
    .filter(Boolean)
    .join(' ') || 'unknown';
  const os = [result.os.name, result.os.version].filter(Boolean).join(' ') || 'unknown';

  let deviceType = 'desktop';
  const type = (result.device.type || '').toLowerCase();
  if (type === 'mobile') deviceType = 'phone';
  else if (type === 'tablet') deviceType = 'tablet';
  else if (/mobile|android|iphone|ipod/i.test(uaString || '')) deviceType = 'phone';
  else if (/ipad|tablet/i.test(uaString || '')) deviceType = 'tablet';

  return { browser, os, deviceType };
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || null;
}

module.exports = { parseUserAgent, getClientIp };
