const fs = require('node:fs');
const path = require('node:path');

module.exports = fs.readFileSync(path.join(__dirname, 'schema.graphql'), 'utf8');
