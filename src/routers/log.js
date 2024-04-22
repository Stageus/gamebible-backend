// Import
const router = require('express').Router();
const { validationResult } = require('express-validator');
const { pool } = require('../config/postgres');

// 날짜 형식은 2000-01-01
const validateDate = (date) => {
    const dateReg = /^\d{4}-\d{2}-\d{2}$/;
    return !date || dateReg.test(date);
};

// API Validate
const validateApi = (api) => {
    const validApis = ['account', 'admin', 'game', 'post', 'comment', 'visitor', 'log'];
    return !api || validApis.includes(api);
};

// 로그목록 보기
router.get('/', async (req, res, next) => {
    const { startdate, enddate, idx, api } = req.query;
    console.log(req.decode);

    // Express Validator를 사용하여 검증 결과 확인
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        let values = [];
        let query = `
            SELECT 
                * 
            FROM 
                log
            WHERE 
                1=1`;
        if (startdate && validateDate(startdate)) {
            query += ` AND requested_timestamp >= $${values.length + 1}`;
            values.push(startdate);
        }
        if (enddate && validateDate(enddate)) {
            query += ` AND requested_timestamp <= $${values.length + 1}`;
            values.push(enddate);
        }
        if (idx) {
            query += ` AND idx = $${values.length + 1}`;
            values.push(idx);
        }
        if (api && validateApi(api)) {
            query += ` AND url LIKE $${values.length + 1}`;
            values.push(`%/${api}%`);
        }
        query += ` ORDER BY requested_timestamp DESC`;
        console.log(query);
        const result = await pool.query(query, values);
        res.status(200).send(result.rows);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
