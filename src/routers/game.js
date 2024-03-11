const router = require('express').Router();
const { pool } = require('../config/postgres');


//위키생성요청
router.post('/request', async (req, res, next) => {
    const { title } = req.body;
    const { userIdx } = req.user;
    // 미들웨어에 authorization 반영
    try {
        await Pool.query(
            `INSERT INTO request(user_idx, title) 
                        VALUES ( $1 ,$2 ) `,
            [userIdx, title]
        );

        res.status(200).send();
    } catch (e) {
        next(e);
    }
});

//위키목록불러오기
router.get('/', async (req, res, next) => {
    const { lastTitle } = req.query;
    const result = {
        data: {},
    };

    try {
        const gameSelectSQLResult = pool.query(
            `SELECT *
            FROM game
            WHERE deleted_at IS NULL 
            AND title > $1
            ORDER BY title ASC
            LIMIT 10`,
            [lastTitle]
        );

        const gameList = gameSelectSQLResult.rows;
        result.data = gameList;
        console.log('result.data : ', result.data);
        res.status(200).send(result);
    } catch (e) {
        next(e);
    }
});

//게임(위키불러오기)(가나다)
router.get('/search', async (req, res, next) => {
    const { title } = req.query;
    const result = {
        data: {},
    };
    try {
        const sql = `SELECT *
                    FROM stageus.game
                    WHERE title LIKE '%$1%'`;
        const values = [title];
        const searchSQLResult = await pool.query(sql, values);
        const selectedGameList = searchSQLResult.rows;
        result.data = selectedGameList;
        console.log(result.data);

        res.status(200).send(result);
    } catch (e) {
        next(e);
    }
});

module.exports = router;
