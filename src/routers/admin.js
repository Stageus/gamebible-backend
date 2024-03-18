const router = require('express').Router();
const { pool } = require('../config/postgres');
const checkLogin = require('../middlewares/checkLogin');
const checkAdmin = require('../middlewares/checkAdmin');

// 위키(게임) 생성
// admin체크 미들웨어 추가
router.post('/game', checkLogin, checkAdmin, async (req, res, next) => {
    const { title } = req.body;
    const { userIdx, isAdmin } = req.decoded;
    console.log(userIdx);
    console.log(isAdmin);
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
