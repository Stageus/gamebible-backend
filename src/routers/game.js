const router = require('express').Router();

//위키생성요청
router.post('/request', async (req, res, next) => {
    const { title } = req.body;
    // 미들웨어에 authorization 반영

    try {
        await Pool.query(
            `INSERT INTO request(user_idx, title) 
                        VALUES ( $1 ,$2 ) `,
            [useridx, title]
        );

        res.status(200).send();
    } catch (e) {
        next(e);
    }
});

module.exports = router;
