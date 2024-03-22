const router = require('express').Router();
const { pool } = require('../config/postgres');
const checkLogin = require('../middlewares/checkLogin');
const checkAdmin = require('../middlewares/checkAdmin');
const { uploadS3 } = require('../middlewares/upload');
const { generateNotification } = require('../modules/generateNotification');

// 게임 생성
router.post('/game', checkLogin, checkAdmin, async (req, res, next) => {
    const { requestIdx } = req.body;
    let poolClient;

    try {
        poolClient = await pool.connect();

        await poolClient.query('BEGIN');
        const updateRequestSQL = `
                                UPDATE
                                    request
                                SET 
                                    deleted_at = now(), is_confirmed = true
                                WHERE idx = $1`;
        const updateRequestValues = [requestIdx];
        await poolClient.query(updateRequestSQL, updateRequestValues);

        const selectRequestSQL = `
                                SELECT
                                    title, user_idx
                                FROM
                                    request
                                WHERE 
                                    idx = $1`;
        const selectRequestValues = [requestIdx];
        const selectRequestSQLResult = await poolClient.query(
            selectRequestSQL,
            selectRequestValues
        );
        const selectedRequest = selectRequestSQLResult.rows[0];

        const insertGameSQL = `
                                INSERT INTO
                                    game(title, user_idx)
                                VALUES
                                    ( $1, $2 )`;
        const insertGamevalues = [selectedRequest.title, selectedRequest.user_idx];
        await poolClient.query(insertGameSQL, insertGamevalues);

        const selectLatestGameSQL = `
                                    SELECT 
                                        idx
                                    FROM
                                        game
                                    ORDER BY 
                                        idx DESC
                                    limit 1`;
        const selectLatestGameResult = await poolClient.query(selectLatestGameSQL);
        const latestGameIdx = selectLatestGameResult.rows[0].idx;

        const insertThumnailSQL = `
                                INSERT INTO
                                    game_img_thumnail(game_idx)
                                VALUES ( $1 )
                                 `;
        const insertThumnailValues = [latestGameIdx];
        await poolClient.query(insertThumnailSQL, insertThumnailValues);

        const insertBannerSQL = `
                                INSERT INTO
                                    game_img_banner(game_idx)
                                VALUES ( $1 )
                                 `;
        const insertBannerValues = [latestGameIdx];
        await poolClient.query(insertBannerSQL, insertBannerValues);

        res.status(201).send();
        await poolClient.query('COMMIT');
    } catch (e) {
        await poolClient.query('ROLLBACK');
        next(e);
    } finally {
        poolClient.release();
    }
});
//승인요청온 게임목록보기
router.get('/game/request', checkLogin, checkAdmin, async (req, res, next) => {
    const result = {
        data: {},
    };
    try {
        const selectRequestSQL = `
                            SELECT
                                *
                            FROM
                                request
                            WHERE 
                                deleted_at IS NULL`;
        const selectRequestSQLResult = await pool.query(selectRequestSQL);
        const requestList = selectRequestSQLResult.rows;

        result.data = requestList;
        res.status(200).send(result);
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
        const deleteRequestSQL = `
                            UPDATE
                                request
                            SET 
                                deleted_at = now(), is_confirmed = false
                            WHERE 
                                idx = $1`;
        const deleteRequestValues = [requestIdx];
        await poolClient.query(deleteRequestSQL, deleteRequestValues);

        const selectUserSQL = `
                            SELECT
                                user_idx
                            FROM 
                                request
                            WHERE 
                                idx = $1`;
        const selectUserSQLValues = [requestIdx];
        const selectUserSQLResult = await poolClient.query(selectUserSQL, selectUserSQLValues);
        const selectedUser = selectUserSQLResult.rows[0];
        const userIdx = selectedUser.user_idx;

        await generateNotification(3, userIdx);
        await poolClient.query(`COMMIT`);

        res.status(200).send();
    } catch (e) {
        await poolClient.query(`ROLLBACK`);
        next(e);
    } finally {
        poolClient.release();
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
            poolClient = await pool.connect();
            await poolClient.query(`BEGIN`);
            const location = req.files[0].location;
            const deleteBannerSQL = `
                            UPDATE 
                                game_img_banner
                            SET 
                                deleted_at = now()
                            WHERE 
                                game_idx = $1
                            AND 
                                deleted_at IS NULL`;
            const deleteBannerValues = [gameIdx];
            await poolClient.query(deleteBannerSQL, deleteBannerValues);

            const insertBannerSQL = `
                            INSERT INTO
                                game_img_banner(game_idx, img_path)
                            VALUES
                                ($1, $2)`;
            const insertBannerValues = [gameIdx, location];
            await poolClient.query(insertBannerSQL, insertBannerValues);
            await poolClient.query(`COMMIT`);

            res.status(201).send();
        } catch (e) {
            console.log('에러발생');
            await poolClient.query(`ROLLBACK`);
            next(e);
        } finally {
            poolClient.release();
        }
    }
);

//대표이미지 등록하기
router.post(
    '/game/:gameidx/thumnail',
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
            const deleteThumnailSQL = `
                                    UPDATE
                                        game_img_thumnail
                                    SET
                                        deleted_at = now()
                                    WHERE
                                        game_idx = $1
                                    AND
                                        deleted_at IS NULL`;
            const deleteThumnailValues = [gameIdx];
            await poolClient.query(deleteThumnailSQL, deleteThumnailValues);

            const insertThumnailSQL = `
                                    INSERT INTO
                                        game_img_thumnail(game_idx, img_path)
                                    VALUES 
                                        ( $1, $2 )`;
            const insertThumnailVALUES = [gameIdx, location];
            await poolClient.query(insertThumnailSQL, insertThumnailVALUES);

            await poolClient.query(`COMMIT`);

            res.status(201).send();
        } catch (e) {
            await poolClient.query(`ROLLBACK`);
            next(e);
        } finally {
            poolClient.release();
        }
    }
);

module.exports = router;
