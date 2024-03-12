const express = require('express');
require('dotenv').config();

const app = express();

app.use(express.json());

const accountApi = require('./src/routers/account');
const gameApi = require('./src/routers/game');
const postApi = require('./src/routers/post');
const commentApi = require('./src/routers/comment');
const adminApi = require('./src/routers/admin');

app.use('/account', accountApi);
app.use('/game', gameApi);
app.use('/post', postApi);
app.use('/comment', commentApi);
app.use('/admin', adminApi);

app.use((req, res, next) => {
    next({ status: 404, message: 'API 없음' });
});

app.listen(process.env.HTTP_PORT);
app.use((err, req, res, next) => {
    if (err.status) err.status = 500;
    res.status(err.status).send(err.stack);
});

app.listen(process.env.HTTP_PORT, () => {
    console.log(`${process.env.HTTP_PORT}번 포트번호 서버실행`);
});
