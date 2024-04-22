const express = require('express');
const cors = require('cors');
const { logger } = require('./src/middlewares/logger');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: false }));

const logApi = require('./src/routers/log');
const accountApi = require('./src/routers/account');
const gameApi = require('./src/routers/game');
const postApi = require('./src/routers/post');
const commentApi = require('./src/routers/comment');
const adminApi = require('./src/routers/admin');

app.use(logger);
app.use('/log', logApi);
app.use('/account', accountApi);
app.use('/game', gameApi);
app.use('/post', postApi);
app.use('/comment', commentApi);
app.use('/admin', adminApi);

app.use((req, res, next) => {
    next({ status: 404, message: 'API 없음' });
});

app.use((err, req, res, next) => {
    console.log(err);
    res.status(err.status || 500).send({
        message: err.status ? err.message : '예상하지 못한 에러가 발생했습니다.',
    });
});

app.listen(process.env.HTTP_PORT, () => {
    console.log(`${process.env.HTTP_PORT}번 포트번호 서버실행`);
});
