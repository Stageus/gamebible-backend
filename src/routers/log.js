// Import
const router = require('express').Router();
const { pool } = require('../config/postgres');
const checkAdmin = require('../middlewares/checkAdmin');

router.get('/test', async (req, res, next) => {
    console.log('실행');
});
// 로그목록 보기
router.get(
    ('/',
    checkAdmin,
    async (req, res, next) => {
        console.log('실행');
        try {
            const result = await pool.query(
                `
                SELECT 
                    * 
                FROM 
                    log`
            );
            res.status(200).send(result.rows);
        } catch (err) {
            next(err);
        }
    })
);

module.exports = router;
