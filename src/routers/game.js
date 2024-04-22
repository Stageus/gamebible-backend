const router = require('express').Router();
const { pool } = require('../config/postgres');
const { query, body } = require('express-validator');
const { handleValidationErrors } = require('../middlewares/validator');
const checkLogin = require('../middlewares/checkLogin');
const { generateNotifications } = require('../modules/generateNotification');
const { uploadS3 } = require('../middlewares/upload');

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
            const selectGameSQLResult = await pool.query(
                `
                SELECT
                    *
                FROM
                    game
                WHERE
                    title = $1
                AND
                    deleted_at IS NULL`,
                [title]
            );
            const existingGame = selectGameSQLResult.rows[0];
            if (existingGame) return res.status(409).send({ message: '이미존재하는 게임' });

            const sql = `
                INSERT INTO 
                    request(user_idx, title) 
                VALUES 
                    ( $1 ,$2 )`;
            const values = [userIdx, title];
            await pool.query(sql, values);

            res.status(200).send();
        } catch (e) {
            next(e);
        }
    }
);

//게임목록불러오기
router.get('/all', async (req, res, next) => {
    let { page } = req.query || 1;
    //20개씩 불러오기
    const skip = (page - 1) * 20;

    try {
        const gameSelectSQLResult = await pool.query(
            `SELECT 
                idx, user_idx AS "userIdx", title, created_at AS "createdAt"
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

        if (!gameList.length) return res.status(204).send();

        const totalGamesNumberSQLResult = await pool.query(`
            SELECT
                count(*)
            FROM
                game
            WHERE
                deleted_at IS NULL`);

        const totalGamesNumber = totalGamesNumberSQLResult.rows[0].count;
        const maxPage = Math.ceil(totalGamesNumber / 20);

        res.status(200).send({
            data: {
                maxPage: maxPage,
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
                    game_img_thumbnail t 
                ON 
                    g.idx = t.game_idx
                WHERE
                    title
                LIKE 
                    $1 
                AND
                    t.deleted_at IS NULL`,
                [`%${title}%`]
            );
            const selectedGameList = searchSQLResult.rows;

            if (!selectedGameList.length) return res.status(204).send();

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
        const totalGamesQueryResult = await pool.query(`
            SELECT
                count(*)
            FROM
                game g
            WHERE
                deleted_at IS NULL    
        `);
        const totalGamesNumber = totalGamesQueryResult.rows[0].count;
        const maxPage = Math.ceil((totalGamesNumber - 19) / 16) + 1;

        const popularSelectSQLResult = await pool.query(
            //게시글 수가 많은 게임 순서대로 게임 idx, 제목, 이미지경로 추출
            `
                SELECT
                    g.idx, g.title, count(*) AS "postCount" ,t.img_path  AS "imgPath"
                FROM 
                    game g 
                JOIN 
                    post p 
                ON 
                    g.idx = p.game_idx 
                JOIN 
                    game_img_thumbnail t 
                ON 
                    g.idx = t.game_idx 
                WHERE 
                    t.deleted_at IS NULL 
                GROUP BY 
                    g.title, t.img_path , g.idx
                ORDER BY 
                    "postCount" DESC
                LIMIT
                    $1
                OFFSET
                    $2`,
            [count, skip]
        );
        const popularGameList = popularSelectSQLResult.rows;

        if (!popularGameList.length) return res.status(204).send();

        res.status(200).send({
            data: {
                maxPage: maxPage,
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
router.get('/:gameidx/history/all', async (req, res, next) => {
    const gameIdx = req.params.gameidx;
    try {
        //특정게임 히스토리목록 최신순으로 출력
        const selectHistorySQLResult = await pool.query(
            // history idx, 히스토리 제목(YYYY-MM-DD HH24:MI:SS 사용자닉네임) 출력
            `
            SELECT 
                h.idx, 
                TO_CHAR(h.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') AS "createdAt",
                nickname
            FROM 
                history h 
            JOIN 
                "user" u
            ON 
                h.user_idx = u.idx
            WHERE 
                game_idx = $1
            AND
                h.created_at IS NOT NULL
            ORDER BY
                h.created_at DESC`,
            [gameIdx]
        );

        const selectGameSQLResult = await pool.query(
            `
            SELECT
                idx, title
            FROM
                game
            WHERE
                idx = $1
            `,
            [gameIdx]
        );
        const game = selectGameSQLResult.rows[0];

        const historyList = selectHistorySQLResult.rows;

        res.status(200).send({
            data: {
                idx: game.idx,
                title: game.title,
                historyList: historyList,
            },
        });
    } catch (e) {
        next(e);
    }
});

//히스토리 자세히보기
router.get('/:gameidx/history/:historyidx?', async (req, res, next) => {
    let historyIdx = req.params.historyidx;
    const gameIdx = req.params.gameidx;
    try {
        if (!historyIdx) {
            //가장 최신 히스토리idx 출력
            const getLatestHistoryIdxSQLResult = await pool.query(
                `
                SELECT
                    MAX(idx)
                FROM
                    history
                WHERE
                    game_idx = $1
                AND
                    created_at IS NOT NULL
            `,
                [gameIdx]
            );
            historyIdx = getLatestHistoryIdxSQLResult.rows[0].max;
        }

        const getHistorySQLResult = await pool.query(
            //히스토리 idx, gameidx, useridx, 내용, 시간, 닉네임 출력
            `
            SELECT    
                h.idx AS "historyIdx", h.game_idx AS "gameIdx", h.user_idx AS "userIdx", title ,content, h.created_at AS "createdAt", u.nickname 
            FROM 
                history h
            JOIN
                "user" u
            ON
                h.user_idx = u.idx
            JOIN
                game g
            ON 
                g.idx = h.game_idx
            WHERE 
                h.idx = $1
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
        console.log('content: ', content);

        console.log('게임수정완료API 실행되었습니다');

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

            await generateNotifications({
                conn: poolClient,
                type: 'MODIFY_GAME',
                gameIdx: gameIdx,
                toUserIdx: historyUserList.map((elem) => elem.user_idx),
            });

            // 새로운 히스토리 등록
            await poolClient.query(
                `INSERT INTO  
                    history(game_idx, user_idx, content)
                VALUES
                    ($1, $2, $3)`,
                [gameIdx, userIdx, content]
            );

            await poolClient.query(`COMMIT`);

            res.status(201).send();
        } catch (e) {
            await poolClient.query(`ROLLBACK`);
            next(e);
        } finally {
            if (poolClient) poolClient.release();
        }
    }
);

// 임시위키생성
router.post('/:gameidx/wiki', checkLogin, async (req, res, next) => {
    const gameIdx = req.params.gameidx;
    const { userIdx } = req.decoded;
    try {
        const makeTemporaryHistorySQLResult = await pool.query(
            `INSERT INTO 
                history(game_idx, user_idx, created_at)
            VALUES
                ( $1, $2, null)
            RETURNING
                idx`,
            [gameIdx, userIdx]
        );

        const temporaryHistory = makeTemporaryHistorySQLResult.rows[0];
        const temporaryHistoryIdx = temporaryHistory.idx;
        //기존 게임내용 불러오기
        const getLatestHistorySQLResult = await pool.query(
            `SELECT 
                g.title, h.content
            FROM 
                history h 
            JOIN 
                game g 
            ON 
                h.game_idx = g.idx 
            WHERE 
                h.game_idx = $1
            AND
                h.created_at IS NOT NULL 
            ORDER BY 
                h.created_at DESC 
            limit 
                1;`,
            [gameIdx]
        );
        const latestHistory = getLatestHistorySQLResult.rows[0];

        res.status(201).send({
            historyIdx: temporaryHistoryIdx,
            title: latestHistory.title,
            content: latestHistory.content,
        });
    } catch (e) {
        next(e);
    }
});

// 위키 이미지 업로드
router.post(
    '/:gameidx/wiki/image',
    checkLogin,
    uploadS3.array('images', 1),
    async (req, res, next) => {
        const historyIdx = req.params.historyidx;
        const images = req.files;

        try {
            if (!images) return res.status(400).send({ message: '이미지가 없습니다' });

            await pool.query(
                `INSERT INTO
                    game_img( history_idx, img_path )
                VALUES ( $1, $2 ) `,
                [historyIdx, location]
            );

            res.status(201).send({ data: location });
        } catch (e) {
            next(e);
        }
    }
);

module.exports = router;
