const jwt = require('jsonwebtoken');
require('dotenv').config();

const checkLogin = (req, res, next) => {
    // `Authorization` 헤더에서 값을 추출
    const authHeader = req.headers.authorization;

    try {
        if (!authHeader) {
            const error = new Error('no token');
            error.status = 400;
            throw error;
        }

        // `Bearer ` 접두사를 제거하여 실제 토큰 값만 추출
        const token = authHeader.split(' ')[1];

        if (!token) {
            const error = new Error('no token');
            error.status = 400;
            throw error;
        }

        req.decoded = jwt.verify(token, process.env.SECRET_KEY);
        next();
    } catch (err) {
        let statusCode = err.status || 500;
        console.log(err.stack);
        res.status(statusCode).send(err.message);
    }
};

module.exports = checkLogin;
