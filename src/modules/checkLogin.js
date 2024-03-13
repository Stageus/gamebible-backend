const jwt = require('jsonwebtoken');
const checkLogin = (req, res, next) => {
    const { token } = req.headers;

    try {
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

        res.status(statusCode).send(message);
    }
};

module.exports = checkLogin;
