const router = require('express').Router();
const { pool } = require('../config/postgres.js');
const jwt = require('jsonwebtoken');

const checkLogin = require('../modules/checkLogin');

//로그인
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

//아이디 중복 확인
router.post('/id/check', async (req, res, next) => {
    try {
        const { id } = req.body;

        const checkIdSql = 'SELECT * FROM account_local WHERE id = $1';
        const idResults = await pool.query(checkIdSql, [id]);
        if (idResults.rows.length > 0) return res.status(409).send('아이디가 이미 존재합니다.');

        return res.status(200).send('사용 가능한 아이디입니다.');
    } catch (e) {
        next(e);
    }
});

//이메일 중복 확인
router.post('/email/check', async (req, res, next) => {
    try {
        const { email } = req.body;

        const checkEmailSql = 'SELECT * FROM "user" WHERE email = $1';
        const emailResults = await pool.query(checkEmailSql, [email]);
        if (emailResults.rows.length > 0) return res.status(409).send('이메일이 이미 존재합니다.');

        return res.status(200).send('사용 가능한 이메일입니다.');
    } catch (e) {
        next(e);
    }
});

module.exports = router;
