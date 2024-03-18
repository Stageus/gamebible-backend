const router = require('express').Router();
const moment = require('moment');
const { pool } = require('../config/postgres');
const { query } = require('express-validator');
const { handleValidationErrors } = require('../middlewares/validator');
const checkLogin = require('../modules/checkLogin');
//게임생성요청
router.post('/request', checkLogin, async (req, res, next) => {
    const { title } = req.body;
    const userIdx = req.decoded.idx;
    try {
        const sql = `
        INSERT INTO 
            request(user_idx, title) 
        VALUES 
            ( $1 ,$2 ) `;
        const values = [userIdx, title];
        await pool.query(sql, values);

        res.status(200).send();
    } catch (e) {
        next(e);
    }
});

//게임목록불러오기
router.get('/', async (req, res, next) => {
    const lastIdx = req.query.lastidx;
    const result = {
        data: {},
    };

    try {
        const sql = `
        SELECT 
            *
        FROM 
            game
        WHERE 
            deleted_at IS NULL 
        ORDER BY 
            title ASC
        LIMIT 
            10
        OFFSET
            $1`;
        const values = [lastIdx];
        const gameSelectSQLResult = await pool.query(sql, values);

        const gameList = gameSelectSQLResult.rows;
        result.data = gameList;

        res.status(200).send(result);
    } catch (e) {
        next(e);
    }
});

//게임검색하기
router.get(
    '/search',
    query('title').trim().isLength({ min: 2 }).withMessage('2글자 이상입력해주세요'),
    handleValidationErrors,
    async (req, res, next) => {
        const { title } = req.query;
        const result = {
            data: {},
        };
        try {
            const sql = `
            SELECT 
                *
            FROM 
                stageus.game
            WHERE 
                title 
            LIKE 
                '%' ||$1|| '%'`;

            const values = [title];
            const searchSQLResult = await pool.query(sql, values);
            const selectedGameList = searchSQLResult.rows;
            result.data = selectedGameList;

            res.status(200).send(result);
        } catch (e) {
            next(e);
        }
    }
);

//인기게임목록불러오기(게시글순)
// 10개 단위로 불러오기
router.get('/popular', async (req, res, next) => {
    const lastIdx = req.query.lastidx;
    const result = {
        data: {},
    };
    try {
        const sql = `
        SELECT 
            g.title, count(g.title)
        FROM
            game g
        RIGHT JOIN 
            post p
        ON 
            g.idx = p.game_idx
        group by 
            g.title 
        order by 
            count DESC
        limit 
            10
        OFFSET 
            $1`;

        const values = [lastIdx];
        const popularSelectSQLResult = await pool.query(sql, values);
        const popularGameList = popularSelectSQLResult.rows;
        console.log('popularGameList: ', popularGameList);
        result.data = popularGameList;

        res.status(200).send(result);
    } catch (e) {
        next(e);
    }
});

//히스토리 목록보기
router.get('/:gameidx/history', async (req, res, next) => {
    const gameIdx = req.params.gameidx;
    const result = {
        data: {},
    };
    try {
        const sql = `
        SELECT 
            h.idx, h.created_at, u.nickname
        FROM 
            history h 
        JOIN 
            "user" u
        ON 
            h.user_idx = u.idx
        WHERE 
            game_idx = $1
        ORDER BY
            h.created_at`;
        const values = [gameIdx];
        const selectHistorySQLResult = await pool.query(sql, values);
        const beforeHistoryList = selectHistorySQLResult.rows;

        let createdAt;
        let nickname;
        let timeStamp;
        let historyTitle;
        let historyList = [];

        beforeHistoryList.forEach((element) => {
            timeStamp = element.created_at;
            nickname = element.nickname;
            createdAt = moment(timeStamp).format('YYYY-MM-DD HH:mm:ss');

            historyTitle = createdAt + ' ' + nickname;
            historyList.push(historyTitle);
        });
        result.data = historyList;

        res.status(200).send(result);
    } catch (e) {
        next(e);
    }
});

//히스토리 자세히보기
router.get('/:gameidx/history/:historyidx', async (req, res, next) => {
    const historyIdx = req.params.historyidx;
    const gameIdx = req.params.gameidx;
    const result = {
        data: {},
    };
    try {
        const sql = `
        SELECT    
              * 
        FROM 
            history
        WHERE 
            idx = $1
        AND 
            game_idx = $2`;

        const values = [historyIdx, gameIdx];
        const getHistorySQLResult = await pool.query(sql, values);
        const history = getHistorySQLResult.rows;

        result.data = history;

        res.status(200).send(result);
    } catch (e) {
        next(e);
    }
});

//게임 자세히보기
router.get('/:gameidx/wiki', async (req, res, next) => {
    const gameIdx = req.params.gameidx;
    const result = {
        data: {},
    };
    try {
        const sql = `
        SELECT 
            content, created_at 
        FROM 
            history
        WHERE 
            game_idx = $1
        ORDER BY
            created_at DESC
        limit 
            1`;
        const values = [gameIdx];

        const getHistorySQLResult = await pool.query(sql, values);
        const history = getHistorySQLResult.rows;

        result.data = history;

        res.status(200).send(result);
    } catch (e) {
        next(e);
    }
});

//게임 수정하기
router.put('/:gameidx/wiki', checkLogin, async (req, res, next) => {
    const gameIdx = req.params.gameidx;
    const userIdx = req.decoded.idx;
    const { content } = req.body;

    try {
        const updateCurrentSQL = `
                                UPDATE
                                    history
                                SET 
                                    deleted_at = now()                                    
                                WHERE
                                    game_idx = $1
                                AND
                                    idx = (SELECT
                                                idx
                                            FROM 
                                                history
                                            WHERE
                                                game_idx = $1
                                            ORDER BY
                                                created_at DESC
                                            LIMIT
                                                1)`;
        const updateCurrentSQLValues = [gameIdx];
        const updateCurrentSQLResult = pool.query(updateCurrentSQL, updateCurrentSQLValues);

        const sql = `
        INSERT INTO 
            history(game_idx, user_idx, content)
        VALUES 
            ($1, $2, $3)`;
        const values = [gameIdx, userIdx, content];
        await pool.query(sql, values);

        res.status(200).send();
    } catch (e) {
        next(e);
    }
});

module.exports = router;
