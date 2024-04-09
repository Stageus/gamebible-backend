const { pool } = require('../config/postgres');

const log = async (req, res, next) => {
    const logData = {
        ip: req.ip,
        idx: req.decoded ? req.decoded.idx : 'unknown',
        url: req.originalUrl,
        method: req.method,
        requestedTimestamp: new Date(),
        respondedTimestamp: null,
        status: null,
        stackTrace: null,
    };
    res.on('finish', async () => {
        logData.respondedTimestamp = new Date();
        logData.status = res.locals.error ? res.locals.error.statusCode : res.statusCode;
        logData.stackTrace = res.locals.error ? res.locals.error.stackTrace : null;
        logData.message = res.locals.error ? res.locals.error.message : null;

        try {
            const client = await pool.connect();
            await client.query('BEGIN');
            const queryText = `
                INSERT INTO logs(ip, idx, url, method, requested_timestamp, responded_timestamp, status, stack_trace, message)
                VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `;
            const values = [
                logData.ip,
                logData.idx,
                logData.url,
                logData.method,
                logData.requestedTimestamp,
                logData.respondedTimestamp,
                logData.status,
                logData.stackTrace,
                logData.message,
            ];
            await client.query(queryText, values);
            await client.query('COMMIT');
            client.release();
            console.log('로그가 성공적으로 저장되었습니다.');
        } catch (err) {
            console.error('로그 저장 중 오류 발생:', err);
        }
    });
    next();
};

module.exports = { log };
