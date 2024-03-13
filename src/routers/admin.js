const router = require('express').Router();
const { pool } = require('../config/posgres');

// 위키(게임) 생성
// admin체크 미들웨어 추가
router.post('/game', async (req, res, next) => {
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
