//Import
const router = require('express').Router();
const { pool } = require('../config/postgres');
const checkLogin = require('../middlewares/checkLogin');
const { body, query } = require('express-validator');
const { handleValidationErrors } = require('../middlewares/validator');

//Apis
//게시글 임시작성
router.post('/', checkLogin, async (req, res, next) => {
    const gameIdx = req.query.gameidx;
    const userIdx = req.decoded.userIdx;
    try {
        const result = await pool.query(
            `INSERT INTO
                post(
                    user_idx,
                    game_idx,
                    created_at
                )
            VALUES
                ($1, $2, null)
            RETURNING
                idx`,
            [userIdx, gameIdx]
        );
        res.status(201).send({ data: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

//게시글 업로드
//이 api는 프론트와 상의 후 수정하기로..
router.post(
    '/:postidx',
    checkLogin,
    body('title').trim().isLength({ min: 2, max: 40 }).withMessage('제목은 2~40자로 입력해주세요'),
    body('content')
        .trim()
        .isLength({ min: 2, max: 10000 })
        .withMessage('본문은 2~10000자로 입력해주세요'),
    handleValidationErrors,
    async (req, res, next) => {
        const { title, content } = req.body;
        const postIdx = req.params.postidx;
        try {
            const result = await pool.query(
                `
                UPDATE
                    post
                SET
                    title = $1, content = $2, created_at = now()
                WHERE
                    idx = $3
                RETURNING
                    game_idx`,
                [title, content, postIdx]
            );
            res.status(200).send({ data: result.rows[0] });
        } catch (err) {
            next(err);
        }
    }
);

//게시판 보기 (게시글 목록보기)
//페이지네이션
//deleted_at 값이 null이 아닌 경우에는 탈퇴한 사용자
router.get('/', async (req, res, next) => {
    const page = req.query.page;
    const gameIdx = req.query.gameidx;
    try {
        //20개씩 불러오기
        const offset = (page - 1) * 20;
        const result = await pool.query(
            `
            SELECT 
                post.idx,
                post.title,
                post.created_at,
                "user".idx AS useridx,
                "user".nickname,
                -- 조회수
                (
                    SELECT
                        COUNT(*)::int
                    FROM
                        view
                    WHERE
                        post_idx = post.idx
                ) AS view,
                -- 총게시글수
                (
                    SELECT
                        COUNT(*)::int
                    FROM
                        post
                    WHERE
                        game_idx = $1
                    AND 
                        deleted_at IS NULL
                ) AS totalposts
            FROM
                post
            JOIN
                "user" ON post.user_idx = "user".idx
            WHERE
                post.game_idx = $1
            AND 
                post.deleted_at IS NULL
            ORDER BY
                post.idx DESC
            LIMIT
                20
            OFFSET
                $2`,
            [gameIdx, offset]
        );
        const length = result.rows.length;
        res.status(200).send({
            data: result.rows,
            page,
            totalPosts: result.rows[0].totalposts,
            length,
        });
    } catch (err) {
        next(err);
    }
});

//게시글 검색하기
//페이지네이션
router.get(
    '/search',
    query('title').trim().isLength({ min: 2 }).withMessage('2글자 이상입력해주세요'),
    async (req, res, next) => {
        const { page, title } = req.query;
        try {
            //7개씩 불러오기
            const offset = (page - 1) * 7;
            const result = await pool.query(
                `
            SELECT 
                post.idx,
                post.title, 
                post.created_at,
                "user".idx AS useridx,
                "user".nickname,
                -- 조회수
                (
                    SELECT
                        COUNT(*)::int
                    FROM
                        view
                    WHERE
                        post_idx = post.idx 
                ) AS view
            FROM 
                post 
            LEFT JOIN
                view ON post.idx = view.post_idx
            JOIN 
                "user" ON post.user_idx = "user".idx
            WHERE
                post.title LIKE '%${title}%'
            AND 
                post.deleted_at IS NULL
            ORDER BY
                post.idx DESC
            LIMIT
                7
            OFFSET
                $1`,
                [offset]
            );
            res.status(200).send({
                data: result.rows,
                page,
                offset,
                length: result.rows.length,
            });
        } catch (err) {
            return next(err);
        }
    }
);

//게시글 상세보기
router.get('/:postidx', checkLogin, async (req, res, next) => {
    const postIdx = req.params.postidx;
    let poolClient;
    try {
        const userIdx = req.decoded.userIdx;
        poolClient = await pool.connect();
        await poolClient.query('BEGIN');

        await poolClient.query(
            `
            -- 조회수 반영하기
            INSERT INTO
                view(
                    post_idx,
                    user_idx
                )
            VALUES
                ($1, $2)`,
            [postIdx, userIdx]
        );

        const result = await poolClient.query(
            `
            SELECT 
                post.title, 
                post.content,
                post.created_at,
                post.game_idx,
                "user".idx AS useridx,
                "user".nickname,
                -- 조회수 불러오기
                (
                    SELECT
                        COUNT(*)::int
                    FROM
                        view
                    WHERE
                        post_idx = post.idx 
                ) AS view
            FROM 
                post
            JOIN
                "user" ON post.user_idx = "user".idx
            WHERE
                post.idx = $1
            AND 
                post.deleted_at IS NULL`,
            [postIdx]
        );
        res.status(200).send({
            data: result.rows[0],
        });
        await poolClient.query('COMMIT');
    } catch (err) {
        await poolClient.query('ROLLBACK');
        next(err);
    } finally {
        poolClient.release();
    }
});

//게시글 삭제하기
router.delete('/:postidx', checkLogin, async (req, res, next) => {
    const postIdx = req.params.postidx;
    const userIdx = req.decoded.userIdx;
    try {
        await pool.query(
            `
            UPDATE post
            SET
                deleted_at = now()
            WHERE
                idx = $1
            AND 
                user_idx = $2`,
            [postIdx, userIdx]
        );
        res.status(200).send();
    } catch (err) {
        next(err);
    }
});

module.exports = router;
