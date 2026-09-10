const crypto = require('crypto');

const createSecurityToken = () => crypto.randomBytes(32).toString('hex');
const hashSecurityToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

module.exports = { createSecurityToken, hashSecurityToken };
