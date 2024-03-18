const router = require('express').Router();
const { pool } = require('../config/postgres');
const checkLogin = require('../middlewares/checkLogin');
const checkAdmin = require('../middlewares/checkAdmin');

// 게임 생성
router.post('/game', checkLogin, checkAdmin, async (req, res, next) => {
    const { requestIdx } = req.body;
    const { userIdx, isAdmin } = req.decoded;
    try {
        const updateRequestSQL = `
                            UPDATE
                                request
                            SET 
                                deleted_at = now(), is_confirmed = true
                            WHERE idx = $1`;
        const updateRequestValues = [requestIdx];
        await pool.query(updateRequestSQL, updateRequestValues);

        const selectTitleSQL = `
                            SELECT
                                title
                            FROM
                                request
                            WHERE 
                                idx = $1`;
        const selectTitleValues = [requestIdx];
        const selectTitleSQLResult = await pool.query(selectTitleSQL, selectTitleValues);
        const selectResult = selectTitleSQLResult.rows[0];
        const title = selectResult.title;

        const insertGameSQL = `
        INSERT INTO 
            game(title, user_idx)
        VALUES
            ( $1, $2 )`;
        const insertGamevalues = [title, userIdx];
        await pool.query(insertGameSQL, insertGamevalues);

        res.status(201).send();
    } catch (e) {
        next(e);
    }
});

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
    } catch (e) {}
});

module.exports = router;
