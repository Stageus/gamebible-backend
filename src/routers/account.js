const router = require('express').Router();

// 로그인
router.post('/login', async (req, res, next) => {
    const { id, pw } = req.body;
    try {
        await Pool.query(`SELECT * FROM user WHERE id = $1 AND password = $2`, [id, pw]);
        res.status(200).send();
    } catch (e) {
        next(e);
    }
});

module.exports = router;
