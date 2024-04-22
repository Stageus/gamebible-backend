const router = require('express').Router();
const { pool } = require('../config/postgres');
const checkLogin = require('../middlewares/checkLogin');
const checkAdmin = require('../middlewares/checkAdmin');
const { uploadS3 } = require('../middlewares/upload');
const { generateNotification } = require('../modules/generateNotification');

// 게임 생성 요청 승인
router.post(
    '/game',
    checkLogin,
    checkAdmin,
    uploadS3.fields([
        { name: 'thumbnail', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
    ]),
    async (req, res, next) => {
        const { userIdx } = req.decoded;
        const { requestIdx } = req.body;
        const { thumbnail, banner } = req.files;
        let poolClient;

        try {
            if (!thumbnail || !banner) return res.status(400).send({ message: '이미지 없음' });

            poolClient = await pool.connect();

            //요청삭제, 제목,유저idx반환
            const deleteRequestSQLResult = await poolClient.query(
                `
            UPDATE
                request
            SET 
                deleted_at = now(), is_confirmed = true
            WHERE 
                idx = $1
            RETURNING
                user_idx AS "userIdx" , title`,
                [requestIdx]
            );
            const request = deleteRequestSQLResult.rows[0];

            //트랜잭션 시작
            await poolClient.query('BEGIN');

            //기존 게임중복확인
            const selectEixsistingGameSQLResult = await poolClient.query(
                `
                SELECT
                    *
                FROM
                    game
                WHERE
                    title = $1
                AND
                    deleted_at IS NULL`,
                [request.title]
            );

            const existingGame = selectEixsistingGameSQLResult.rows[0];
            if (existingGame) {
                await poolClient.query('ROLLBACK');
                return res.status(409).send({ message: '이미존재하는 게임입니다' });
            }

            //새로운게임추가
            const insertGameSQLResult = await poolClient.query(
                `
                INSERT INTO
                    game(title, user_idx)
                VALUES
                    ( $1, $2 )
                RETURNING
                    idx AS "gameIdx"`,
                [request.title, request.userIdx]
            );
            const gameIdx = insertGameSQLResult.rows[0].gameIdx;

            const newPostTitle = `새로운 게임 "${request.title}"이 생성되었습니다`;
            const newPostContent = `많은 이용부탁드립니다~`;

            await poolClient.query(
                `
                INSERT INTO
                    post(title, content, user_idx, game_idx)
                VALUES
                    ( $1, $2, $3, $4 )`,
                [newPostTitle, newPostContent, userIdx, gameIdx]
            );

            //게임 썸네일, 배너이미지 등록
            await poolClient.query(
                `
                INSERT INTO
                    game_img_thumbnail(game_idx, img_path)
                VALUES ( $1, $2 )`,
                [gameIdx, thumbnail[0].location]
            );

            await poolClient.query(
                `
                INSERT INTO
                    game_img_banner(game_idx, img_path)
                VALUES ( $1, $2 )`,
                [gameIdx, banner[0].location]
            );

            await poolClient.query('COMMIT');

            res.status(201).send();
        } catch (e) {
            await poolClient.query('ROLLBACK');
            next(e);
        } finally {
            if (poolClient) poolClient.release();
        }
    }
);

//승인요청온 게임목록보기
router.get('/game/request/all', checkLogin, checkAdmin, async (req, res, next) => {
    const lastIdx = req.query.lastidx || 99999999;
    try {
        let selectRequestSQLResult;

        if (!lastIdx) {
            // 최신 관리자알람 20개 출력
            selectRequestSQLResult = await pool.query(`
                SELECT
                    idx, user_idx AS "userIdx", title, is_confirmed AS "isConfirmed", created_at AS "createdAt"
                FROM
                    request
                WHERE 
                    deleted_at IS NULL
                ORDER BY
                    idx DESC
                LIMIT
                    20`);
        } else {
            // lastIdx보다 작은 관리자알람 20개 출력
            selectRequestSQLResult = await pool.query(
                `
                SELECT
                    idx, user_idx AS "userIdx", title, is_confirmed AS "isConfirmed", created_at AS "createdAt"
                FROM
                    request
                WHERE 
                    deleted_at IS NULL
                AND
                    idx < $1
                ORDER BY
                    idx DESC
                LIMIT
                    20`,
                [lastIdx]
            );
        }
        const requestList = selectRequestSQLResult.rows;
        //요청없는 경우
        if (!requestList.length) return res.status(204).send();

        res.status(200).send({
            data: {
                lastIdx: requestList[requestList.length - 1].idx,
                requestList: requestList,
            },
        });
    } catch (e) {
        next(e);
    }
});

//승인요청 거부
router.delete('/game/request/:requestidx', checkLogin, checkAdmin, async (req, res, next) => {
    const requestIdx = req.params.requestidx;
    let poolClient;
    try {
        poolClient = await pool.connect();
        await poolClient.query(`BEGIN`);
        // 요청삭제
        await poolClient.query(
            `UPDATE
                request
            SET 
                deleted_at = now(), is_confirmed = false
            WHERE 
                idx = $1`,
            [requestIdx]
        );
        // 요청의 user_idx, 게임제목 추출
        const selectRequestSQLResult = await poolClient.query(
            `SELECT
                user_idx, title
            FROM 
                request
            WHERE 
                idx = $1`,
            [requestIdx]
        );
        const selectedRequest = selectRequestSQLResult.rows[0];
        // 추출한 user_idx, 게임제목으로 새로운 게임 생성, 삭제 -> 그래야 거절 알림보낼 수 있음
        await poolClient.query(
            `INSERT INTO
                game(user_idx, title, deleted_at)
            VALUES
                ( $1, $2, now())`,
            [selectedRequest.user_idx, selectedRequest.title]
        );
        // 방금 생성,삭제된 게임idx 추출
        const latestGameResult = await poolClient.query(
            `SELECT
                idx
            FROM
                game
            ORDER BY
                idx DESC
            LIMIT
                1`
        );
        latestGame = latestGameResult.rows[0];
        //알림생성
        await generateNotification({
            conn: poolClient,
            type: 'DENY_GAME',
            gameIdx: latestGame.idx,
            toUserIdx: selectedRequest.user_idx,
        });

        await poolClient.query(`COMMIT`);

        res.status(200).send();
    } catch (e) {
        await poolClient.query(`ROLLBACK`);
        next(e);
    } finally {
        if (poolClient) poolClient.release();
    }
});

//배너이미지 등록
router.post(
    '/game/:gameidx/banner',
    checkLogin,
    checkAdmin,
    uploadS3.array('images', 1),
    async (req, res, next) => {
        const gameIdx = req.params.gameidx;
        let poolClient;

        try {
            const location = req.files[0].location;

            poolClient = await pool.connect();
            await poolClient.query(`BEGIN`);

            //기존배너이미지 삭제
            await poolClient.query(
                `UPDATE 
                    game_img_banner
                SET 
                    deleted_at = now()
                WHERE 
                    game_idx = $1
                AND 
                    deleted_at IS NULL`,
                [gameIdx]
            );
            //새로운배너이미지 추가
            await poolClient.query(
                `INSERT INTO
                    game_img_banner(game_idx, img_path)
                VALUES
                    ($1, $2)`,
                [gameIdx, location]
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

//대표이미지 등록하기
router.post(
    '/game/:gameidx/thumbnail',
    checkLogin,
    checkAdmin,
    uploadS3.array('images', 1),
    async (req, res, next) => {
        const gameIdx = req.params.gameidx;
        let poolClient;
        try {
            poolClient = await pool.connect();
            const location = req.files[0].location;

            await poolClient.query(`BEGIN`);
            //기존 썸네일 삭제
            await poolClient.query(
                `UPDATE
                    game_img_thumbnail
                SET
                    deleted_at = now()
                WHERE
                    game_idx = $1
                AND
                    deleted_at IS NULL`,
                [gameIdx]
            );
            //새로운 썸네일 등록
            await poolClient.query(
                `INSERT INTO
                    game_img_thumbnail(game_idx, img_path)
                VALUES 
                    ( $1, $2 )`,
                [gameIdx, location]
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

module.exports = router;
