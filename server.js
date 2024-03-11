const express = require('express');
require('dotenv').config();

const app = express();

// const accountApi = require('./src/routers/account');
// const gameApi = require('./src/routers/game');
// const postApi = require('./src/routers/post');
// const commentApi = require('./src/routers/comment');
// const adminApi = require('./src/routers/admin');

// app.use('/account', accountApi);
// app.use('/game', gameApi);
// app.use('/post', postApi);
// app.use('/comment', commentApi);
// app.use('/admin', adminApi);

app.listen(process.env.HTTP_PORT, () => {
    console.log(`${process.env.HTTP_PORT}번 포트번호 서버실행`);
});
