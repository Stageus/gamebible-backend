const router = require('express').Router();
const { pool } = require('../config/postgres');
const checkLogin = require('../modules/checkLogin');
const checkAdmin = require('../middlewares/checkAdmin');

// 게임 생성
router.post('/game', checkLogin, checkAdmin, async (req, res, next) => {
    const { title } = req.body;
    const userIdx = req.body.useridx;
    try {
        const sql = `
        INSERT INTO 
            game(title, user_idx)
        VALUES
            ( $1, $2 )`;
        const values = [title, userIdx];
        await pool.query(sql, values);

        res.status(201).send();
    } catch (e) {
        next(e);
    }
});

module.exports = router;
