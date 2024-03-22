const router = require('express').Router();
const { pool } = require('../config/postgres');
const checkLogin = require('../middlewares/checkLogin');
const checkAdmin = require('../middlewares/checkAdmin');
const { uploadS3 } = require('../middlewares/upload');
const { generateNotification } = require('../modules/generateNotification');

// 게임 생성
router.post('/game', checkLogin, checkAdmin, async (req, res, next) => {
    const { requestIdx } = req.body;
    try {
        await pool.query('BEGIN');
        const updateRequestSQL = `
                                UPDATE
                                    request
                                SET 
                                    deleted_at = now(), is_confirmed = true
                                WHERE idx = $1`;
        const updateRequestValues = [requestIdx];
        await pool.query(updateRequestSQL, updateRequestValues);

        const selectRequestSQL = `
                                SELECT
                                    title, user_idx
                                FROM
                                    request
                                WHERE 
                                    idx = $1`;
        const selectRequestValues = [requestIdx];
        const selectRequestSQLResult = await pool.query(selectRequestSQL, selectRequestValues);
        const selectedRequest = selectRequestSQLResult.rows[0];

        const insertGameSQL = `
                            INSERT INTO
                                game(title, user_idx)
                            VALUES
                                ( $1, $2 )`;
        const insertGamevalues = [selectedRequest.title, selectedRequest.user_idx];
        await pool.query(insertGameSQL, insertGamevalues);

        const selectLatestGameSQL = `
                                    SELECT 
                                        idx
                                    FROM
                                        game
                                    ORDER BY 
                                        idx DESC
                                    limit 1`;
        const selectLatestGameResult = await pool.query(selectLatestGameSQL);
        const latestGameIdx = selectLatestGameResult.rows[0].idx;

        const insertThumnailSQL = `
                                INSERT INTO
                                    game_img_thumnail(game_idx)
                                VALUES ( $1 )
                                 `;
        const insertThumnailValues = [latestGameIdx];
        await pool.query(insertThumnailSQL, insertThumnailValues);

        const insertBannerSQL = `
                                INSERT INTO
                                    game_img_banner(game_idx)
                                VALUES ( $1 )
                                 `;
        const insertBannerValues = [latestGameIdx];
        await pool.query(insertBannerSQL, insertBannerValues);

        await generateNotification(3, selectedRequest.user_idx, latestGameIdx);
        res.status(201).send();
        await pool.query('COMMIT');
    } catch (e) {
        await pool.query('ROLLBACK');
        next(e);
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
    try {
        const deleteRequestSQL = `
                            UPDATE
                                request
                            SET 
                                deleted_at = now(), is_confirmed = false
                            WHERE 
                                idx = $1`;
        const deleteRequestValues = [requestIdx];
        await pool.query(deleteRequestSQL, deleteRequestValues);
        res.status(200).send();
    } catch (e) {
        next(e);
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

        try {
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
            await pool.query(deleteBannerSQL, deleteBannerValues);

            const insertBannerSQL = `
                            INSERT INTO
                                game_img_banner(game_idx, img_path)
                            VALUES
                                ($1, $2)`;
            const insertBannerValues = [gameIdx, location];
            await pool.query(insertBannerSQL, insertBannerValues);

            res.status(201).send();
        } catch (e) {
            next(e);
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
        console.log('실행');
        const gameIdx = req.params.gameidx;
        try {
            console.log(req.files);
            const location = req.files[0].location;
            console.log('location: ', location);

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
            await pool.query(deleteThumnailSQL, deleteThumnailValues);

            const insertThumnailSQL = `
                                    INSERT INTO
                                        game_img_thumnail(game_idx, img_path)
                                    VALUES 
                                        ( $1, $2 )`;
            const insertThumnailVALUES = [gameIdx, location];
            await pool.query(insertThumnailSQL, insertThumnailVALUES);

            res.status(201).send();
        } catch (e) {
            next(e);
        }
    }
);

module.exports = router;
