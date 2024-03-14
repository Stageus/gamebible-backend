const jwt = require('jsonwebtoken');
require('dotenv').config();

const checkAdmin = async (req, res, next) => {
    const token = req.headers.authorization;

    try {
        if (!token) throw new Error('no token');
        const payload = jwt.verify(token, process.env.SECRET_KEY);

        const isAdmin = payload.isAdmin;
        if (isAdmin != true) throw new Error('관리자권한 필요');
        next();
    } catch (e) {
        next(e);
    }
};

module.exports = checkAdmin;
