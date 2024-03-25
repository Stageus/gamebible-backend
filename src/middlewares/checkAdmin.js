const jwt = require('jsonwebtoken');
require('dotenv').config();

const checkAdmin = async (req, res, next) => {
    let { authorization } = req.headers;
    authorization = authorization.split(' ')[1];

    try {
        if (!authorization) {
            const error = new Error('no token');
            error.status = 401;
            throw error;
        }
        req.decoded = jwt.verify(authorization, process.env.SECRET_KEY);
        const isAdmin = req.decoded.isAdmin;

        if (isAdmin != true) {
            const error = new Error('no admin');
            error.status = 401;
            throw error;
        }
        next();
    } catch (e) {
        next(e);
    }
};

module.exports = checkAdmin;
