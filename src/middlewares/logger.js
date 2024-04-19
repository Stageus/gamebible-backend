const { pool } = require('../config/postgres');

const logger = async (req, res, next) => {
    const logData = {
        ip: req.ip,
        idx: req.decoded ? req.decoded.userIdx : null,
        url: req.originalUrl,
        method: req.method,
        requestedTimestamp: new Date(),
        respondedTimestamp: null,
        status: null,
        stackTrace: null,
    };
    console.log(req.decoded);
    res.on('finish', async () => {
        logData.respondedTimestamp = new Date();
        logData.status = res.locals.error ? res.locals.error.statusCode : res.statusCode;
        logData.stackTrace = res.locals.error ? res.locals.error.stackTrace : null;
        console.log(logData);
        try {
            await pool.query(
                `INSERT INTO 
                    log(
                        ip,
                        user_idx,
                        url,
                        method,
                        requested_timestamp,
                        responded_timestamp,
                        status,
                        stack_trace
                    )
                VALUES
                    ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    logData.ip,
                    logData.idx,
                    logData.url,
                    logData.method,
                    logData.requestedTimestamp,
                    logData.respondedTimestamp,
                    logData.status,
                    logData.stackTrace,
                ]
            );
        } catch (err) {
            console.error('로그 저장 중 오류 발생:', err);
        }
    });
    next();
};

module.exports = { logger };
