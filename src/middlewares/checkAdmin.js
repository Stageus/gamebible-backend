const jwt = require('jsonwebtoken');
require('dotenv').config();

const checkAdmin = async () => {
    const token = req.headers.authorization;

    try {
        if (!token) throw new Error('no token');
        const payload = jwt.verify(token, process.env.SECRET_KEY);

        const isAdmin = payload.isAdmin;
        if (isAdmin != false) throw new Error('관리자권한 필요');
    } catch (e) {}
};

module.exports = checkAdmin;
