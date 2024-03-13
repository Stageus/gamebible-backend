const router = require('express').Router();
const moment = require('moment');
const { pool } = require('../config/postgres');
const { timeStamp } = require('console');

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

//게임검색하기
router.get('/search', async (req, res, next) => {
    const { title } = req.query;
    const result = {
        data: {},
    };
    try {
        const sql = `SELECT *
                    FROM stageus.game
                    WHERE title LIKE '%' ||$1|| '%'`;

        const values = [title];
        const searchSQLResult = await pool.query(sql, values);
        const selectedGameList = searchSQLResult.rows;
        console.log('selectedGameList: ', selectedGameList);
        result.data = selectedGameList;

        res.status(200).send(result);
    } catch (e) {
        next(e);
    }
});

//인기게임목록불러오기(게시글순)
// 10개 단위로 불러오기
router.get('/popular', async (req, res, next) => {
    const { lastIdx } = req.query;
    const result = {
        data: {},
    };
    try {
        const sql = `SELECT g.title, count(g.title)
                    FROM game g
                    RIGHT JOIN post p
                    ON g.idx = p.game_idx
                    group by g.title 
                    order by count DESC
                    limit 10
                    OFFSET $1
                    `;

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

//히스토리목록 보기
router.get('/:gameidx/history', async (req, res, next) => {
    const gameIdx = req.params.gameidx;
    const result = {
        data: {},
    };
    try {
        // createdAt, user nickname
        const sql = `SELECT h.created_at, u.nickname 
                    FROM history h 
                    JOIN "user" u
                    ON h.user_idx = u.idx
                    WHERE game_idx = $1`;
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
        const sql = `SELECT * 
                     FROM history
                     WHERE idx = $1
                     AND game_idx = $2`;
        const values = [historyIdx, gameIdx];
        const getHistorySQLResult = await pool.query(sql, values);
        const history = getHistorySQLResult.rows;

        //히스토리 자세히보기에서 content만 있으면되는지? -> 게임제목, 시간, 작성자
        result.data = history;

        res.status(200).send(result);
    } catch (e) {
        next(e);
    }
});

module.exports = router;
