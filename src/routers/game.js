const router = require('express').Router();
const moment = require('moment');
const { pool } = require('../config/postgres');
const { query } = require('express-validator');
const { handleValidationErrors } = require('../middlewares/validator');
const checkLogin = require('../middlewares/checkLogin');
const { generateNotification } = require('../modules/generateNotification');

//게임생성요청
router.post('/request', checkLogin, async (req, res, next) => {
    const { title } = req.body;
    const { userIdx } = req.decoded;
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
    let { page } = req.query;
    const result = {
        data: {},
    };
    //20개씩 불러오기
    const skip = (page - 1) * 20;

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
            20
        OFFSET
            $1`;
        const values = [skip];
        const gameSelectSQLResult = await pool.query(sql, values);

        const gameList = gameSelectSQLResult.rows;
        result.data.page = page;
        result.data.skip = skip;
        result.data.count = gameList.length;
        result.data.gameList = gameList;

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
router.get('/popular', async (req, res, next) => {
    const { page } = req.query || 1;

    let skip;
    let count;
    if (page == 1) {
        //1페이지는 19개 불러오기
        count = 19;
        skip = 0;
    } else {
        //2페이지부터는 16개씩불러오기
        count = 16;
        skip = (page - 1) * 16 + 3;
    }

    const result = {
        data: {},
    };

    try {
        const sql = `
                SELECT
                    g.idx, g.title, count(*) AS post_count ,t.img_path  
                FROM 
                    game g 
                JOIN 
                    post p 
                ON 
                    g.idx = p.game_idx 
                JOIN 
                    game_img_thumnail t 
                ON 
                    g.idx = t.game_idx 
                WHERE 
                    t.deleted_at IS NULL 
                GROUP BY 
                    g.title, t.img_path , g.idx
                ORDER BY 
                    post_count DESC
                LIMIT
                    $1
                OFFSET
                    $2`;

        const values = [count, skip];
        const popularSelectSQLResult = await pool.query(sql, values);
        const popularGameList = popularSelectSQLResult.rows;

        result.data.page = page;
        result.data.skip = skip;
        result.data.count = popularGameList.length;
        result.data.gameList = popularGameList;

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

        let idx;
        let createdAt;
        let nickname;
        let timeStamp;
        let historyTitle;
        let history;
        let historyList = [];

        beforeHistoryList.forEach((element) => {
            history = {};
            idx = element.idx;
            timeStamp = element.created_at;
            nickname = element.nickname;
            createdAt = moment(timeStamp).format('YYYY-MM-DD HH:mm:ss');

            historyTitle = createdAt + ' ' + nickname;

            history.idx = idx;
            history.title = historyTitle;

            historyList.push(history);
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
    const { userIdx } = req.decoded;
    const { content } = req.body;
    let poolClient = null;
    try {
        poolClient = await pool.connect();
        await pool.query(`BEGIN`);

        //가장 최신히스토리 삭제
        await poolClient.query(
            `UPDATE
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
                            1)`,
            [gameIdx]
        );

        //기존 게임수정자들 알림
        const historyUserSQLResult = await poolClient.query(
            `SELECT 
                user_idx
            FROM
                history
            WHERE 
                game_idx = $1
            GROUP BY
                game_idx, user_idx`,
            [gameIdx]
        );
        let historyUserList = historyUserSQLResult.rows;
        console.log('historyUserList: ', historyUserList);

        for (let index = 0; index < historyUserList.length; index++) {
            await generateNotification(poolClient, 2, historyUserList[index].user_idx, gameIdx);
        }

        // 새로운 히스토리 등록
        await poolClient.query(
            `INSERT INTO 
                history(game_idx, user_idx, content)
            VALUES 
                ($1, $2, $3)`,
            [gameIdx, userIdx, content]
        );

        await poolClient.query(`COMMIT`);

        res.status(200).send();
    } catch (e) {
        console.log('에러발생');
        await poolClient.query(`ROLLBACK`);
        next(e);
    } finally {
        poolClient.release();
    }
});

module.exports = router;
