const jwt = require('jsonwebtoken');
require('dotenv').config();

const checkAdmin = async (req, res, next) => {
    console.log(req.headers);
    console.log(req.headers.authorization);
    const { authorization } = req.headers;

    console.log(authorization);

    try {
        if (!authorization) {
            const error = new Error('no token');
            error.status = 401;
            throw error;
        }
        req.decoded = jwt.verify(authorization, process.env.SECRET_KEY);
        const isAdmin = req.decoded.isadmin;

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
