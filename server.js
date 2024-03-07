const express = require('express');
require('dotenv').config();

const app = express();

app.use('/', () => {
    res.send('Hello World');
});

const accountApi = require('./src/routers/account');
const gameApi = require('./src/routers/game');
const postApi = require('./src/routers/post');
const commentApi = require('./src/routers/comment');
const adminApi = require('./src/routers/adminApi');

app.use('/', accountApi);
app.use('/game', gameApi);
app.use('/post', postApi);
app.use('/comment', commentApi);
app.use('/admin', adminApi);


app.listen(process.env.HTTP_PORT);
