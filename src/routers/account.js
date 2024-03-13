const router = require('express').Router();
const { pool } = require('../config/postgres.js');
const checkLogin = require('../modules/checkLogin');
const jwt = require('jsonwebtoken');

router.post('/auth', async (req, res, next) => {
    const { id, pw } = req.body;
    try {
        const loginsql = `SELECT * FROM account_local WHERE id = $1 AND pw = $2`;
        const { rows } = await pool.query(loginsql, [id, pw]);

        if (rows.length === 0) {
            return res.status(401).send({ message: '인증 실패' });
        }

        const login = rows[0];

        const token = jwt.sign(
            {
                idx: login.idx,
            },
            process.env.SECRET_KEY,
            {
                expiresIn: '5h',
            }
        );

        res.status(200).send({ message: '로그인 성공', token: token });
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
