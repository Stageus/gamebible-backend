const router = require('express').Router();
const moment = require('moment');
const { pool } = require('../config/postgres');
const { query, body } = require('express-validator');
const { handleValidationErrors } = require('../middlewares/validator');
const checkLogin = require('../middlewares/checkLogin');
const { generateNotification } = require('../modules/generateNotification');

//게임생성요청
router.post(
    '/request',
    checkLogin,
    body('title').trim().isLength({ min: 2 }).withMessage('2글자이상입력해주세요'),
    handleValidationErrors,
    async (req, res, next) => {
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
    }
);

//게임목록불러오기
router.get('/', async (req, res, next) => {
    let { page } = req.query;
    //20개씩 불러오기
    const skip = (page - 1) * 20;

    try {
        const gameSelectSQLResult = await pool.query(
            `SELECT 
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
                $1`,
            [skip]
        );

        const gameList = gameSelectSQLResult.rows;

        res.status(200).send({
            data: {
                page: page,
                skip: skip,
                count: gameList.length,
                gameList: gameList,
            },
        });
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
        try {
            const searchSQLResult = await pool.query(
                `SELECT
                    g.idx, g.title, t.img_path AS "imgPath"
                FROM
                    game g 
                JOIN
                    game_img_thumnail t 
                ON 
                    g.idx = t.game_idx
                WHERE
                    title
                LIKE 
                    '%' ||$1|| '%'
                AND
                    t.deleted_at IS NULL`,
                [title]
            );
            const selectedGameList = searchSQLResult.rows;

            res.status(200).send({
                data: selectedGameList,
            });
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

    try {
        console.log('요청받음');
        //
        const popularSelectSQLResult = await pool.query(
            //게시글 수가 많은 게임 순서대로 게임 idx, 제목, 이미지경로 추출
            `
                SELECT
                    g.idx, g.title, count(*) AS post_count ,t.img_path  AS "imgPath"
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
                    $2`,
            [count, skip]
        );
        const popularGameList = popularSelectSQLResult.rows;

        res.status(200).send({
            data: {
                page: page,
                skip: skip,
                count: popularGameList.length,
                gameList: popularGameList,
            },
        });
    } catch (e) {
        next(e);
    }
});
//배너이미지가져오기
router.get('/:gameidx/banner', async (req, res, next) => {
    const gameIdx = req.params.gameidx;
    try {
        //삭제되지않은 배너이미지경로 가져오기
        const bannerSQLResult = await pool.query(
            `
            SELECT
                img_path AS "imgPath"
            FROM 
                game_img_banner
            WHERE
                game_idx = $1
            AND
                deleted_at IS NULL`,
            [gameIdx]
        );
        const banner = bannerSQLResult.rows;
        res.status(200).send({
            data: banner,
        });
    } catch (e) {
        next(e);
    }
});

//히스토리 목록보기
router.get('/:gameidx/history', async (req, res, next) => {
    const gameIdx = req.params.gameidx;
    try {
        //특정게임 히스토리목록 최신순으로 출력
        const selectHistorySQLResult = await pool.query(
            `
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
                h.created_at DESC`,
            [gameIdx]
        );
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

        res.status(200).send({ data: historyList });
    } catch (e) {
        next(e);
    }
});

//히스토리 자세히보기
router.get('/:gameidx/history/:historyidx', async (req, res, next) => {
    const historyIdx = req.params.historyidx;
    const gameIdx = req.params.gameidx;
    try {
        const getHistorySQLResult = await pool.query(
            `
            SELECT    
                * 
            FROM 
                history
            WHERE 
                idx = $1
            AND 
                game_idx = $2`,
            [historyIdx, gameIdx]
        );
        const history = getHistorySQLResult.rows;

        res.status(200).send({ data: history });
    } catch (e) {
        next(e);
    }
});

//게임 자세히보기
router.get('/:gameidx/wiki', async (req, res, next) => {
    const gameIdx = req.params.gameidx;
    try {
        const getHistorySQLResult = await pool.query(
            `SELECT 
                content, created_at 
            FROM 
                history
            WHERE 
                game_idx = $1
            ORDER BY
                created_at DESC
            limit 
                1`,
            [gameIdx]
        );
        const history = getHistorySQLResult.rows;

        res.status(200).send({ data: history });
    } catch (e) {
        next(e);
    }
});

//게임 수정하기
router.put(
    '/:gameidx/wiki',
    checkLogin,
    body('content').trim().isLength({ min: 2 }).withMessage('2글자이상 입력해주세요'),
    handleValidationErrors,
    async (req, res, next) => {
        const gameIdx = req.params.gameidx;
        const { userIdx } = req.decoded;
        const { content } = req.body;

        let poolClient = null;
        try {
            poolClient = await pool.connect();
            await poolClient.query(`BEGIN`);

            //기존 게임수정자들 추출
            const historyUserSQLResult = await poolClient.query(
                `SELECT DISTINCT 
                    user_idx
                FROM
                    history
                WHERE 
                    game_idx = $1`,
                [gameIdx]
            );
            let historyUserList = historyUserSQLResult.rows;

            for (let i = 0; i < historyUserList.length; i++) {
                await generateNotification({
                    conn: poolClient,
                    type: 'MODIFY_GAME',
                    gameIdx: gameIdx,
                    toUserIdx: historyUserList[i].user_idx,
                });
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
            if (poolClient) poolClient.release();
        }
    }
);

module.exports = router;
