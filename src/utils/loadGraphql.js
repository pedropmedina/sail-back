const path = require('path');
const fs = require('fs');

module.exports = file => {
  const filePath = path.join(__dirname, '..', 'api', file);
  return fs.readFileSync(filePath, 'utf-8');
};
