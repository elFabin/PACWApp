'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const routes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(routes);

app.listen(PORT, () => {
  console.log(`PACWApp listening on http://localhost:${PORT}`);
});
