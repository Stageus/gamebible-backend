const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
require('dotenv').config();

const { pool } = require('../config/postgres.js');
const checkLogin = require('../middlewares/checkLogin.js');
const generateVerificationCode = require('../modules/generateVerificationCode');
const sendVerificationEmail = require('../modules/sendVerificationEmail');
const changePwEmail = require('../modules/changePwEmail');
const deleteCode = require('../modules/deleteCode');
const { uploadS3 } = require('../middlewares/upload');
const {
    validateId,
    validateEmail,
    validatePassword,
    validatePasswordMatch,
    validateNickname,
    handleValidationErrors,
} = require('../middlewares/validator');

//로그인
router.post(
    '/auth',

    handleValidationErrors,
    async (req, res, next) => {
        const { id, pw } = req.body;
        try {
            const loginsql = `
            SELECT
                al.*, u.is_admin, u.deleted_at
            FROM
                account_local al
            JOIN
                "user" u ON al.user_idx = u.idx
            WHERE
                al.id = $1 AND al.pw = $2 AND u.deleted_at IS NULL`; // 삭제되지 않은 사용자만 조회
            const { rows: loginRows } = await pool.query(loginsql, [id, pw]);

            if (loginRows.length === 0) {
                return res.status(401).send({ message: '인증 실패' });
            }

            const login = loginRows[0];

            const token = jwt.sign(
                {
                    userIdx: login.user_idx,
                    isAdmin: login.is_admin,
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
router.post('/id/check', validateId, async (req, res, next) => {
    try {
        const { id } = req.body;

        const checkIdSql = `
        SELECT
            account_local.* 
        FROM
            account_local
        JOIN
            "user"
        ON
            account_local.user_idx = "user".idx
        WHERE
            account_local.id = $1
        AND 
            "user".deleted_at IS NULL;
        `;

        const idResults = await pool.query(checkIdSql, [id]);
        if (idResults.rows.length > 0) return res.status(409).send('아이디가 이미 존재합니다.');

        return res.status(200).send('사용 가능한 아이디입니다.');
    } catch (e) {
        next(e);
    }
});

//닉네임 중복 확인
router.post('/nickname/check', validateNickname, async (req, res, next) => {
    try {
        const { nickname } = req.body;

        const checkNicknameSql = `
        SELECT
            * 
        FROM
            "user" 
        WHERE 
            nickname = $1 
        AND 
            deleted_at IS NULL`;

        const nicknameResults = await pool.query(checkNicknameSql, [nickname]);
        if (nicknameResults.rows.length > 0)
            return res.status(409).send('닉네임이 이미 존재합니다.');

        return res.status(200).send('사용 가능한 닉네임입니다.');
    } catch (e) {
        next(e);
    }
});

//이메일 중복 확인/인증
router.post('/email/check', validateEmail, async (req, res, next) => {
    try {
        const { email } = req.body;

        const checkEmailSql = `
        SELECT
            * 
        FROM
            "user" 
        WHERE 
           email = $1 
        AND 
            deleted_at IS NULL`;
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
            deleteCode(pool);
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
router.post('/pw/email', validateEmail, async (req, res, next) => {
    const { email } = req.body;

    try {
        const emailToken = await changePwEmail(email);
        return res.status(200).send({ token: emailToken });
    } catch (error) {
        next(error);
    }
});

//비밀번호 변경
router.put('/pw', validatePassword, checkLogin, async (req, res, next) => {
    const { pw } = req.body;
    const { idx } = req.decoded;

    try {
        const deletePwSql = `
        UPDATE
            "user" 
        SET
            deleted_at = now()
        WHERE
            idx = $1`;
        await pool.query(deletePwSql, [idx]);

        const newPwSql = `
        INSERT INTO 
            "user" (is_admin, nickname, email)
        SELECT 
            is_admin, nickname, email
        FROM 
            "user"
        WHERE
            idx = $1
            RETURNING *`;
        const userInfo = await pool.query(newPwSql, [idx]);

        const user = userInfo.rows[0];

        const changePwSql = `
        INSERT INTO
            account_local(id, pw, user_idx)
        SELECT
            id,$2,$3
        FROM
            account_local
        WHERE
            user_idx=$1`;
        await pool.query(changePwSql, [idx, pw, user.idx]);
        return res.status(200).send('비밀번호 변경 성공');
    } catch (error) {
        next(error);
    }
});

// 내 정보 보기
router.get('/', checkLogin, async (req, res, next) => {
    try {
        const { userIdx } = req.decoded;
        // 사용자 정보를 조회하는 쿼리
        const getUserInfoQuery = `
         SELECT 
            *
        FROM
            "user"
         WHERE idx = $1
      `;
        // queryDatabase 함수를 사용하여 쿼리 실행
        const userInfo = await pool.query(getUserInfoQuery, [userIdx]);
        // 첫 번째 조회 결과 가져오기
        const user = userInfo.rows[0];
        // 응답 전송
        res.status(200).send({ data: user });
    } catch (error) {
        next(error);
    }
});

// 내 정보 수정
router.put('/', checkLogin, validateEmail, validateNickname, async (req, res, next) => {
    const { userIdx } = req.decoded;
    const { nickname, email } = req.body;
    try {
        const deleteInfoSql = `
        UPDATE
            "user" 
        SET
            deleted_at = now()
        WHERE
            idx = $1`;
        const result = await pool.query(deleteInfoSql, [userIdx]);
        console.log(userIdx);

        if (result.rowCount == 0) {
            return res.status(400).send('softdelete오류');
        }

        const newInfoSql = `
        INSERT INTO 
            "user" (
                is_admin,
                nickname, 
                email
                )
        SELECT 
            is_admin, $2, $3
        FROM 
            "user"
        WHERE
            idx = $1
            RETURNING *`;

        const userInfo = await pool.query(newInfoSql, [userIdx, nickname, email]);

        const user = userInfo.rows[0];

        const changeInfoSql = `
        INSERT INTO
            account_local(id, pw, user_idx)
        SELECT
            id,pw,$2
        FROM
            account_local
        WHERE
            user_idx=$1`;
        await pool.query(changeInfoSql, [userIdx, user.idx]);
        return res.status(200).send('내 정보 수정 성공');
    } catch (error) {
        next(error);
    }
});

//프로필 이미지
router.put('/image', checkLogin, uploadS3.single('image'), async (req, res, next) => {
    try {
        const { userIdx } = req.decoded;
        const uploadedFile = req.file;

        if (!uploadedFile) {
            return res.status(400).send({ message: '업로드 된 파일이 없습니다' });
        }

        const imageSql = `
        INSERT INTO 
            profile_img (
                img_path, 
                user_idx
                )
        VALUES ($1, $2);`;
        await pool.query(imageSql, [uploadedFile.location, userIdx]);
        return res.status(200).send('이미지 수정 성공');
    } catch (error) {
        next(error);
    }
});

// 회원 탈퇴
router.delete('/', checkLogin, async (req, res, next) => {
    try {
        const { userIdx } = req.decoded;

        const deleteSql = `
        UPDATE
            "user" 
        SET
            deleted_at = now()
        WHERE
            idx = $1`;
        await pool.query(deleteSql, [userIdx]);

        return res.status(200).send('회원 탈퇴 성공');
    } catch (error) {
        next(error);
    }
});

module.exports = router;
