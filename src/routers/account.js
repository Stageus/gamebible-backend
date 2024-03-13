const router = require('express').Router();
const { pool } = require('../config/postgres.js'); // './db'는 db.js 파일의 경로를

// 로그인
router.post('/login', async (req, res, next) => {
    const { id, pw } = req.body;
    try {
        await pool.query(`SELECT * FROM user WHERE id = $1 AND password = $2`, [id, pw]);
        res.status(200).send();
    } catch (e) {
        next(e);
    }
});

// 회원가입
router.post('/signup', async (req, res) => {
    const { id, pw, nickname, email, isadmin } = req.body;

    try {
        // 회원가입 처리
        const insertUserSql =
            'INSERT INTO user (id, password, nickname, email, isadmin) VALUES ($1, $2, $3, $4, $5)';
        await queryDatabase(insertUserSql, [id, pw, nickname, email, isadmin]);
        return res.status(200).send();
    } catch (e) {
        next(e);
    }
});

module.exports = router;
