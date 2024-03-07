const express = require('express');
require('dotenv').config();

const app = express();

app.use('/', () => {
    res.send('Hello World');
});

const accountApi = require("./src/routers/account");

app.use('/', accountApi);








app.listen(process.env.HTTP_PORT);
