const router = require('express').Router();
const { pool } = require('../config/postgres.js'); // './db'는 db.js 파일의 경로를

// 로그인
router.post('/auth', async (req, res, next) => {
    const { id, pw } = req.body;
    try {
        await pool.query(`SELECT * FROM user WHERE id = $1 AND password = $2`, [id, pw]);
        res.status(200).send();
    } catch (e) {
        next(e);
    }
});

// 회원가입
router.post('/', async (req, res, next) => {
    const { id, pw, pw_same, nickname, email, isadmin } = req.body;

    try {
        const insertUserSql =
            'INSERT INTO "user" (nickname, email, is_admin) VALUES ($1, $2, $3) RETURNING idx';
        const userResult = await pool.query(insertUserSql, [nickname, email, isadmin]);
        const userIdx = userResult.rows[0].idx;

        const insertAccountSql = 'INSERT INTO account_local (user_idx, id, pw) VALUES ($1, $2, $3)';
        await pool.query(insertAccountSql, [userIdx, id, pw]);
        return res.status(200).send('회원가입 성공');
    } catch (e) {
        next(e);
    }
});

module.exports = router;
