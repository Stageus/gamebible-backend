//Import
const router = require('express').Router();

//Apis
//게시판 보기 (게시글 목록보기)
router.get('/', async (req, res, next) => {
    const result = { data: null };
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
    } catch {}
});
