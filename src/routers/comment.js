//Import
const router = require('express').Router();
const { pool } = require('../config/postgres');
const checkLogin = require('../middlewares/checkLogin');
const { generateNotification } = require('../modules/generateNotification');
const { body } = require('express-validator');

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
        const gameIdx = parseInt(req.query.gameidx);
        const postIdx = parseInt(req.query.postidx);
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
            res.status(201).end();
            await poolClient.query('COMMIT');
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
router.get('/all', checkLogin, async (req, res, next) => {
    const lastIdx = parseInt(req.query.lastidx) || 0;
    const postIdx = parseInt(req.query.postidx);
    try {
        // totalcomments를 가져오는 별도의 쿼리
        const totalCommentsResult = await pool.query(
            `SELECT
                COUNT(*)::int AS "totalComments"
            FROM
                comment
            WHERE
                post_idx = $1
            AND 
                deleted_at IS NULL`,
            [postIdx]
        );
        const userIdx = req.decoded.userIdx;
        //20개씩 불러오기
        const result = await pool.query(
            `
            SELECT
                comment.idx,
                comment.content,
                comment.created_at AS "createdAt",
                "user".idx AS "userIdx",
                "user".nickname
            FROM 
                comment
            JOIN
                "user" ON comment.user_idx = "user".idx
            WHERE
                post_idx = $1
            AND 
                comment.deleted_at IS NULL
            AND
                comment.idx > $2
            ORDER BY
                comment.idx ASC
            LIMIT
                20`,
            [postIdx, lastIdx]
        );

        if (!result.rows || result.rows.length === 0) {
            res.status(200).end();
        } else {
            res.status(200).send({
                data: result.rows,
                lastIdx: result.rows[result.rows.length - 1].idx,
                totalComments: totalCommentsResult.rows[0].totalComments,
            });
        }
    } catch (err) {
        next(err);
    }
});

//댓글 삭제
router.delete('/:commentidx', checkLogin, async (req, res, next) => {
    const commentIdx = parseInt(req.params.commentidx);
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
