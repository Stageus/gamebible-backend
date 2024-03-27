//Import
const router = require('express').Router();
const { pool } = require('../config/postgres');
const checkLogin = require('../middlewares/checkLogin');
const { generateNotification } = require('../modules/generateNotification');

//Apis

//댓글 쓰기
router.post(
    '/',
    checkLogin,
    body('content')
        .trim()
        .isLength({ min: 1, max: 1000 })
        .withMessage('내용은 1~1000자로 입력해주세요'),
    async (req, res, next) => {
        const content = req.body.content;
        const gameIdx = req.query.gameidx;
        const postIdx = req.query.postidx;
        let poolClient;
        try {
            const userIdx = req.decoded.userIdx;
            poolClient = await pool.connect();
            await poolClient.query('BEGIN');

            await poolClient.query(
                `
            INSERT INTO
                comment(
                    user_idx,
                    post_idx,
                    content
                )
            VALUES
                ($1, $2, $3)`,
                [userIdx, postIdx, content]
            );

            const data = await poolClient.query(
                `
            SELECT
                user_idx
            FROM
                post
            WHERE
                idx = $1
            `,
                [postIdx]
            );
            console.log(data.rows[0].user_idx);
            await generateNotification({
                conn: poolClient,
                type: 'MAKE_COMMENT',
                gameIdx: gameIdx,
                postIdx: postIdx,
                toUserIdx: data.rows[0].user_idx,
            });
            res.status(201).send();
        } catch (err) {
            console.log('에러발생');
            await poolClient.query(`ROLLBACK`);
            next(err);
        } finally {
            poolClient.release();
        }
    }
);

//댓글 보기
//무한스크롤
router.get('/', checkLogin, async (req, res, next) => {
    const postIdx = req.query.postidx;
    try {
        const data = await pool.query(
            `
            SELECT
                comment.user_idx,
                comment.idx,
                comment.content,
                comment.created_at,
                "user".nickname,
                "user".deleted_at
            FROM 
                comment
            JOIN
                "user" ON comment.user_idx = "user".idx
            WHERE
                post_idx = $1
            AND 
                comment.deleted_at IS NULL
            ORDER BY
                comment.idx DESC`,
            [postIdx]
        );
        res.status(201).send({
            data: data.rows,
        });
    } catch (err) {
        next(err);
    }
});

//댓글 삭제
router.delete('/:commentidx', checkLogin, async (req, res, next) => {
    const commentIdx = req.params.commentidx;
    try {
        const userIdx = req.decoded.userIdx;
        await pool.query(
            `
            UPDATE comment
            SET
                deleted_at = now()
            WHERE
                idx = $1
            AND 
                user_idx = $2`,
            [commentIdx, userIdx]
        );
        res.status(200).send();
    } catch (err) {
        next(err);
    }
});

module.exports = router;
