const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
require('dotenv').config();

const { pool } = require('../config/postgres.js');
const checkLogin = require('../modules/checkLogin');
const generateVerificationCode = require('../modules/generateVerificationCode');
const sendVerificationEmail = require('../modules/sendVerificationEmail');
const deleteCode = require('../modules/deleteCode');
const {
    validateId,
    validateEmail,
    validatePassword,
    validatePasswordMatch,
    validateNickname,
    handleValidationErrors,
} = require('../middlewares/validator');
deleteCode(pool);
//로그인
router.post(
    '/auth',
    body('id')
        .trim()
        .isAlphanumeric()
        .withMessage('아이디는 알파벳과 숫자만 사용할 수 있습니다.')
        .isLength({ min: 4, max: 12 })
        .withMessage('아이디는 4자 이상 12자 이하로 해주세요.'),
    handleValidationErrors,
    async (req, res, next) => {
        const { id, pw } = req.body;
        try {
            const loginsql = `
        SELECT
            * 
        FROM
            account_local
        WHERE
            id = $1 AND pw = $2`;
            const { rows } = await pool.query(loginsql, [id, pw]);

            if (rows.length === 0) {
                return res.status(401).send({ message: '인증 실패' });
            }

            const login = rows[0];
            const token = jwt.sign(
                {
                    idx: login.user_idx,
                },
                process.env.SECRET_KEY,
                {
                    expiresIn: '5h',
                }
            );

            res.status(200).send({ message: '로그인 성공', token: token });
        } catch (e) {
            next(e);
        }
    }
);

// 회원가입
router.post(
    '/',
    [
        validateId,
        validateEmail,
        validatePassword,
        validatePasswordMatch,
        validateNickname,
        handleValidationErrors,
    ],
    async (req, res, next) => {
        const { id, pw, pw_same, nickname, email, isadmin } = req.body;

        try {
            //비밀번호 해싱 구현하기

            const insertUserSql = `
            INSERT INTO
                "user"(
                    nickname,
                    email,
                    is_admin
                    ) 
            VALUES ($1, $2, $3)
            RETURNING idx`;
            const userResult = await pool.query(insertUserSql, [nickname, email, isadmin]);
            const userIdx = userResult.rows[0].idx;

            const insertAccountSql = `
            INSERT INTO
                account_local (
                    user_idx, 
                    id, 
                    pw
                    )
            VALUES ($1, $2, $3)`;
            await pool.query(insertAccountSql, [userIdx, id, pw]);
            return res.status(200).send('회원가입 성공');
        } catch (e) {
            next(e);
        }
    }
);

//아이디 중복 확인
router.post('/id/check', async (req, res, next) => {
    try {
        const { id } = req.body;

        const checkIdSql = 'SELECT * FROM account_local WHERE id = $1';
        const idResults = await pool.query(checkIdSql, [id]);
        if (idResults.rows.length > 0) return res.status(409).send('아이디가 이미 존재합니다.');

        return res.status(200).send('사용 가능한 아이디입니다.');
    } catch (e) {
        next(e);
    }
});

//닉네임 중복 확인
router.post('/nickname/check', async (req, res, next) => {
    try {
        const { nickname } = req.body;

        const checkNicknameSql = 'SELECT * FROM "user" WHERE nickname = $1';
        const nicknameResults = await pool.query(checkNicknameSql, [nickname]);
        if (nicknameResults.rows.length > 0)
            return res.status(409).send('닉네임이 이미 존재합니다.');

        return res.status(200).send('사용 가능한 닉네임입니다.');
    } catch (e) {
        next(e);
    }
});

//이메일 중복 확인/인증
router.post('/email/check', async (req, res, next) => {
    try {
        const { email } = req.body;

        const checkEmailSql = 'SELECT * FROM "user" WHERE email = $1';
        const emailResults = await pool.query(checkEmailSql, [email]);
        if (emailResults.rows.length > 0) {
            return res.status(409).send('이메일이 이미 존재합니다.');
        } else {
            const verificationCode = generateVerificationCode();
            const insertQuery = `
            INSERT INTO email_verification (email, code)
            VALUES ($1, $2)
        `;
            await pool.query(insertQuery, [email, verificationCode]);
            await sendVerificationEmail(email, verificationCode);
            return res.status(200).send('인증 코드가 발송되었습니다.');
        }
    } catch (e) {
        next(e);
    }
});

//이메일 인증 확인
router.post('/email/auth', async (req, res, next) => {
    try {
        const { email, code } = req.body;

        const queryResult = await pool.query(
            'SELECT * FROM email_verification WHERE email = $1 AND code = $2',
            [email, code]
        );
        if (queryResult.rows.length > 0) {
            res.status(200).send('이메일 인증이 완료되었습니다.');
        } else {
            res.status(400).send('잘못된 인증 코드입니다.');
        }
    } catch (e) {
        next(e);
    }
});

// 아이디 찾기
router.get('/id', async (req, res, next) => {
    const { email } = req.query;
    try {
        const findIdxSql = 'SELECT idx FROM "user" WHERE email = $1';
        const results = await pool.query(findIdxSql, [email]);

        if (results.length === 0) {
            return res.status(400).send(createResult('일치하는 사용자가 없습니다.'));
        }
        const findIdSql = 'SELECT id FROM account_local WHERE user_idx = $1';
        const idResults = await pool.query(findIdSql, [results.rows[0].idx]);

        const foundId = idResults.rows[0].id;
        console.log(foundId);
        return res.status(200).send({ id: foundId });
    } catch (error) {
        next(error);
    }
});

//비밀번호 찾기(이메일 전송)
router.post('/pw/email', async (req, res, next) => {
    const { email } = req.query;

    try {
    } catch (error) {
        next(error);
    }
});

// 내 정보 보기
router.get('/', checkLogin, async (req, res, next) => {
    try {
        const { idx } = req.decoded;

        // 사용자 정보를 조회하는 쿼리
        const getUserInfoQuery = `
         SELECT * FROM "user"
         WHERE idx = $1
      `;
        // queryDatabase 함수를 사용하여 쿼리 실행
        const userInfo = await pool.query(getUserInfoQuery, [idx]);

        // 첫 번째 조회 결과 가져오기
        const user = userInfo.rows[0];

        // 응답 전송
        res.status(200).send({ data: user });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
