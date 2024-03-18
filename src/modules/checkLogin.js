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
        let message = '';
        switch (err.message) {
            case 'no token':
                message = '로그인이 필요합니다';
                break;
            case 'jwt expired':
                message = '토큰이 만료되었습니다.';
                statusCode = 401;
                break;
            case 'invalid token':
                message = '유효하지 않은 토큰입니다.';
                statusCode = 401;
                break;
            case 'blacklisted token':
                message = '로그아웃 된 토큰입니다.';
                break;
            default:
                message = '인증에 실패했습니다.';
                break;
        }
        console.log(err.stack);
        res.status(statusCode).send(message);
    }
};

module.exports = checkLogin;
