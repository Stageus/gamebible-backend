//Import
const router = require('express').Router();

//Apis

//게시글 쓰기
//이 api는 프론트와 상의 후 수정하기로..
router.post('/', async (req, res, next) => {
    const { title, content } = req.body;
    const gameIdx = req.query.game_idx;
    try {
        const userIdx = req.decoded.userIdx;
        const sql = `
        INSERT INTO 
            post(
                user_idx,
                game_idx,
                title,
                content
                )
            VALUE
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
    try {
        const sql = `
        SELECT 
            post.title, 
            post.created_at, 
            user.nickname,
            COUNT(view.user_idx)
        AS
            view_count
        FROM 
            post 
        JOIN 
            user
        ON 
            post.user_idx = user.idx
        ORDER BY
            post.idx DESC`;
        const data = await pool.query(sql);
        res.status(200).send({
            data: data.rows,
        });
        const result = { data: null };
    } catch (err) {
        return next(err);
    }
});
