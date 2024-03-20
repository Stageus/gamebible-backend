//Import
const router = require('express').Router();
const { pool } = require('../config/postgres');
const checkLogin = require('../middlewares/checkLogin');

//Apis

//댓글 쓰기
router.post('/', checkLogin, async (req, res, next) => {
    const content = req.body.content;
    const postIdx = req.query.postidx;
    try {
        const userIdx = req.decoded.userIdx;
        const sql = `
            INSERT INTO
                comment(
                    user_idx,
                    post_idx,
                    content
                )
            VALUES
                ($1, $2, $3)`;
        const values = [userIdx, postIdx, content];
        await pool.query(sql, values);
        res.status(201).send();
    } catch (err) {
        next(err);
    }
});

module.exports = router;
