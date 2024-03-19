//Import
const router = require('express').Router();
const { pool } = require('../config/postgres');
const checkLogin = require('../middlewares/checkLogin');

//Apis
//사용자 토큰 받아주는 미들웨어 추가하기

//게시글 쓰기
//이 api는 프론트와 상의 후 수정하기로..
router.post('/', async (req, res, next) => {
    const { title, content } = req.body;
    const gameIdx = req.query.gameidx;
    try {
        const userIdx = 3;
        const sql = `
        INSERT INTO 
            post(
                user_idx,
                game_idx,
                title,
                content
                )
            VALUES
                ($1, $2, $3, $4)
            RETURNING
                idx`;
        const values = [userIdx, gameIdx, title, content];
        const result = await pool.query(sql, values);
        res.status(201).send();
    } catch (err) {
        next(err);
    }
});

//게시판 보기 (게시글 목록보기)
router.get('/', async (req, res, next) => {
    const gameIdx = req.query.gameidx;
    try {
        const sql = `
        SELECT 
            post.idx,
            post.title, 
            post.created_at, 
            post.user_idx,
            "user".nickname,
            COUNT(view.user_idx) AS view_count
        FROM 
            post
        LEFT JOIN
            view ON post.idx = view.post_idx
        JOIN
            "user" ON post.user_idx = "user".idx
        WHERE
            post.game_idx = $1
        GROUP BY
            post.idx, "user".nickname
        ORDER BY
            post.idx DESC`;
        const values = [gameIdx];
        const data = await pool.query(sql, values);
        const result = data.rows;
        res.status(200).send({
            data: result,
        });
    } catch (err) {
        console.log(err);
    }
});

//게시글 검색하기
router.get('/search', async (req, res, next) => {
    const search = req.query.search;
    console.log('실행');
    console.log(search);
    try {
        const sql = `
        SELECT 
            post.title, 
            post.created_at, 
            "user".nickname,
            COUNT(view.user_idx) AS view_count
        FROM 
            post 
        LEFT JOIN
            view ON post.idx = view.post_idx
        JOIN 
            "user" ON post.user_idx = "user".idx
        WHERE
            post.title LIKE '%${search}%'
        GROUP BY
                post.idx, "user".nickname
        ORDER BY
            post.idx DESC`;
        console.log(req.query.search);
        const data = await pool.query(sql);
        res.status(200).send({
            data: data.rows,
        });
    } catch (err) {
        return next(err);
    }
});

//게시글 상세보기
router.get('/:postidx', async (req, res, next) => {
    const postIdx = req.params.postidx;
    try {
        const sql = `
        SELECT 
            post.idx,
            post.user_idx,
            post.*,
            "user".nickname,
            COUNT(view.user_idx) AS view_count
        FROM 
            post
        LEFT JOIN
            view ON post.idx = view.post_idx
        JOIN
            "user" ON post.user_idx = "user".idx
        WHERE
            post.idx = $1
        GROUP BY
            post.idx, "user".nickname`;
        const values = [postIdx];
        const data = await pool.query(sql, values);
        const result = data.rows;
        res.status(200).send({
            data: result,
        });
    } catch (err) {
        next(err);
    }
});

//게시글 삭제하기
router.delete('/:postidx', checkLogin, async (req, res, next) => {
    const postIdx = req.params.postidx;
    const userIdx = req.decoded.userIdx;
    console.log(postIdx, userIdx);
    try {
        const sql = `
        UPDATE post
        SET
            deleted_at = now()
        WHERE
            idx = $1
        AND 
            user_idx = $2`;
        const values = [postIdx, userIdx];
        await pool.query(sql, values);
        res.status(200).send();
    } catch (err) {
        next(err);
    }
});

module.exports = router;
