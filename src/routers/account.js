const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
require('dotenv').config();
const bcrypt = require('bcrypt');

const { pool } = require('../config/postgres.js');
const checkLogin = require('../middlewares/checkLogin.js');
const generateVerificationCode = require('../modules/generateVerificationCode');
const sendVerificationEmail = require('../modules/sendVerificationEmail');
const changePwEmail = require('../modules/sendChangePwEmail.js');
const deleteCode = require('../modules/deleteEmailCode.js');
const { uploadS3 } = require('../middlewares/upload');
const { handleValidationErrors } = require('../middlewares/validator');
const { hashPassword } = require('../modules/hashPassword');
//로그인
router.post(
    '/auth',
    body('id')
        .trim()
        .isAlphanumeric()
        .withMessage('아이디는 알파벳과 숫자만 사용할 수 있습니다.')
        .isLength({ min: 4, max: 12 })
        .withMessage('아이디는 4자 이상 12자 이하로 해주세요.'),
    body('pw')
        .trim()
        .isLength({ min: 8 })
        .withMessage('비밀번호는 8자 이상이어야 합니다.')
        .matches(/\d/)
        .withMessage('비밀번호에는 숫자가 최소 1개 이상 포함되어야 합니다.')
        .matches(/[a-z]/)
        .withMessage('비밀번호에는 소문자가 최소 1개 이상 포함되어야 합니다.')
        .matches(/[A-Z]/)
        .withMessage('비밀번호에는 대문자가 최소 1개 이상 포함되어야 합니다.')
        .matches(/[!@#$%^&*(),.?":{}|<>]/)
        .withMessage('비밀번호에는 특수문자가 최소 1개 이상 포함되어야 합니다.'),
    handleValidationErrors,
    async (req, res, next) => {
        const { id, pw } = req.body;
        try {
            // 사용자 정보 조회 (비밀번호는 해시된 상태로 저장되어 있음)
            const userQuery = `
            SELECT
                al.pw, u.is_admin, u.deleted_at, al.user_idx
            FROM
                account_local al
            JOIN
                "user" u ON al.user_idx = u.idx
            WHERE
                al.id = $1 AND u.deleted_at IS NULL`;

            const values = [id];

            const { rows: userRows } = await pool.query(userQuery, values);

            if (userRows.length === 0) {
                return res.status(401).send({ message: '로그인 실패' });
            }

            const user = userRows[0];

            // bcrypt.compare 함수로 비밀번호 비교
            const match = await bcrypt.compare(pw, user.pw);

            if (!match) {
                return res.status(401).send({ message: '비밀번호 일치하지 않음' });
            }

            // 비밀번호가 일치하면 토큰 생성
            const token = jwt.sign(
                {
                    userIdx: user.user_idx,
                    isAdmin: user.is_admin,
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
        body('id')
            .trim()
            .isAlphanumeric()
            .withMessage('아이디는 알파벳과 숫자만 사용할 수 있습니다.')
            .isLength({ min: 4, max: 12 })
            .withMessage('아이디는 4자 이상 12자 이하로 해주세요.'),
        body('email').trim().isEmail().withMessage('유효하지 않은 이메일 형식입니다.'),
        body('pw')
            .trim()
            .isLength({ min: 8 })
            .withMessage('비밀번호는 8자 이상이어야 합니다.')
            .matches(/\d/)
            .withMessage('비밀번호에는 숫자가 최소 1개 이상 포함되어야 합니다.')
            .matches(/[a-z]/)
            .withMessage('비밀번호에는 소문자가 최소 1개 이상 포함되어야 합니다.')
            .matches(/[A-Z]/)
            .withMessage('비밀번호에는 대문자가 최소 1개 이상 포함되어야 합니다.')
            .matches(/[!@#$%^&*(),.?":{}|<>]/)
            .withMessage('비밀번호에는 특수문자가 최소 1개 이상 포함되어야 합니다.'),
        body('pw_same')
            .trim()
            .custom((value, { req }) => {
                if (value !== req.body.pw) {
                    throw new Error('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
                }
                return true;
            }),
        body('nickname')
            .trim()
            .isLength({ min: 2, max: 16 })
            .withMessage('닉네임은 2자 이상 16자 이하로 해주세요.'),
        handleValidationErrors,
    ],
    async (req, res, next) => {
        const { id, pw, pw_same, nickname, email, isadmin } = req.body;

        try {
            const hashedPw = await hashPassword(pw); // 비밀번호 해싱
            console.log('Hashed Password:', hashedPw); // 해싱된 비밀번호 출력

            const insertUserSql = `
            INSERT INTO
                "user"(
                    nickname,
                    email,
                    is_admin
                    ) 
            VALUES ($1, $2, $3)
            RETURNING idx`;
            const userValues = [nickname, email, isadmin];
            const userResult = await pool.query(insertUserSql, userValues);
            if (userResult.rows.length === 0) {
                return res.status(401).send({ message: '회원가입 실패' });
            }
            const userIdx = userResult.rows[0].idx;

            const insertAccountSql = `
            INSERT INTO
                account_local (
                    user_idx, 
                    id, 
                    pw
                    )
            VALUES ($1, $2, $3)
            RETURNING *`;
            const accountValues = [userIdx, id, hashedPw];
            const accountResult = await pool.query(insertAccountSql, accountValues);
            if (accountResult.rows.length === 0) {
                return res.status(401).send({ message: '회원가입 실패' });
            }
            return res.status(200).send('회원가입 성공');
        } catch (e) {
            next(e);
        }
    }
);

//아이디 중복 확인
router.post(
    '/id/check',
    body('id')
        .trim()
        .isAlphanumeric()
        .withMessage('아이디는 알파벳과 숫자만 사용할 수 있습니다.')
        .isLength({ min: 4, max: 12 })
        .withMessage('아이디는 4자 이상 12자 이하로 해주세요.'),
    handleValidationErrors,
    async (req, res, next) => {
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

            const values = [id];

            const idResults = await pool.query(checkIdSql, values);
            if (idResults.rows.length > 0) return res.status(409).send('아이디가 이미 존재합니다.');

            return res.status(200).send('사용 가능한 아이디입니다.');
        } catch (e) {
            next(e);
        }
    }
);

//닉네임 중복 확인
router.post(
    '/nickname/check',
    body('nickname')
        .trim()
        .isLength({ min: 2, max: 16 })
        .withMessage('닉네임은 2자 이상 16자 이하로 해주세요.'),
    async (req, res, next) => {
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

            const value = [nickname];

            const nicknameResults = await pool.query(checkNicknameSql, value);
            if (nicknameResults.rows.length > 0)
                return res.status(409).send('닉네임이 이미 존재합니다.');

            return res.status(200).send('사용 가능한 닉네임입니다.');
        } catch (e) {
            next(e);
        }
    }
);

//이메일 중복 확인/인증
router.post(
    '/email/check',
    body('email').trim().isEmail().withMessage('유효하지 않은 이메일 형식입니다.'),
    async (req, res, next) => {
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

            const checkEmailvalue = [email];
            const emailResults = await pool.query(checkEmailSql, checkEmailvalue);
            if (emailResults.rows.length > 0) {
                return res.status(409).send('이메일이 이미 존재합니다.');
            } else {
                const verificationCode = generateVerificationCode();
                const insertQuery = `
            INSERT INTO
                email_verification (
                    email,
                    code
                    )
            VALUES
                ($1, $2)
            RETURNING *
            `;
                const codeValues = [email, verificationCode];
                const codeResults = await pool.query(insertQuery, codeValues);
                if (codeResults.rows.length == 0) {
                    return res.status(401).send('코드 저장 오류');
                }
                await sendVerificationEmail(email, verificationCode);
                await deleteCode(pool);
                return res.status(200).send('인증 코드가 발송되었습니다.');
            }
        } catch (e) {
            next(e);
        }
    }
);

//이메일 인증 확인
router.post('/email/auth', async (req, res, next) => {
    try {
        const { email, code } = req.body;
        const checkEmailSql = `
        SELECT
            * 
        FROM 
            email_verification 
        WHERE 
            email = $1
        AND
            code = $2`;
        const queryResult = await pool.query(checkEmailSql, [email, code]);
        if (queryResult.rows.length == 0) {
            return res.status(400).send('잘못된 인증 코드입니다.');
        }
        return res.status(200).send('이메일 인증이 완료되었습니다.');
    } catch (e) {
        next(e);
    }
});

// 아이디 찾기
router.get('/id', async (req, res, next) => {
    const { email } = req.query;
    try {
        const findIdxSql = `
        SELECT 
            idx 
        FROM 
            "user"
        WHERE 
            email = $1
        AND 
            deleted_at IS NULL`;
        const findIdxvalue = [email];
        const results = await pool.query(findIdxSql, findIdxvalue);

        if (results.rows.length === 0) {
            return res.status(400).send('일치하는 사용자가 없습니다.');
        }
        const findIdSql = `
        SELECT 
            id 
        FROM 
            account_local 
        WHERE 
            user_idx = $1`;

        const findIdValue = [results.rows[0].idx];
        const idResults = await pool.query(findIdSql, findIdValue);
        if (idResults.rows.length === 0) {
            return res.status(400).send('일치하는 사용자가 없습니다.');
        }
        const foundId = idResults.rows[0].id;

        return res.status(200).send({ id: foundId });
    } catch (error) {
        next(error);
    }
});

//비밀번호 찾기(이메일 전송)
router.post(
    '/pw/email',
    body('email').trim().isEmail().withMessage('유효하지 않은 이메일 형식입니다.'),
    async (req, res, next) => {
        const { email } = req.body;

        try {
            const emailToken = await changePwEmail(email);
            return res.status(200).send({ token: emailToken });
        } catch (error) {
            next(error);
        }
    }
);

//비밀번호 변경
router.put(
    '/pw',
    body('pw')
        .trim()
        .isLength({ min: 8 })
        .withMessage('비밀번호는 8자 이상이어야 합니다.')
        .matches(/\d/)
        .withMessage('비밀번호에는 숫자가 최소 1개 이상 포함되어야 합니다.')
        .matches(/[a-z]/)
        .withMessage('비밀번호에는 소문자가 최소 1개 이상 포함되어야 합니다.')
        .matches(/[A-Z]/)
        .withMessage('비밀번호에는 대문자가 최소 1개 이상 포함되어야 합니다.')
        .matches(/[!@#$%^&*(),.?":{}|<>]/)
        .withMessage('비밀번호에는 특수문자가 최소 1개 이상 포함되어야 합니다.'),
    checkLogin,
    async (req, res, next) => {
        const { pw } = req.body;
        const { idx } = req.decoded;

        try {
            const hashedPw = await hashPassword(pw); // 비밀번호 해싱
            const deletePwSql = `
            UPDATE
                account_local
            SET
                pw = $2
            WHERE
                user_idx = $1
            RETURNING *`;
            const deletePwValue = [idx, hashedPw];
            const deletePwResult = await pool.query(deletePwSql, deletePwValue);
            if (deletePwResult.rows.length === 0) {
                return res.status(400).send('비밀번호 변경 실패');
            }
            return res.status(200).send('비밀번호 변경 성공');
        } catch (error) {
            next(error);
        }
    }
);

// 내 정보 보기
router.get('/info', checkLogin, async (req, res, next) => {
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
router.put(
    '/info',
    checkLogin,
    body('email').trim().isEmail().withMessage('유효하지 않은 이메일 형식입니다.'),
    body('nickname')
        .trim()
        .isLength({ min: 2, max: 16 })
        .withMessage('닉네임은 2자 이상 16자 이하로 해주세요.'),
    async (req, res, next) => {
        const { userIdx } = req.decoded;
        const { nickname, email } = req.body;
        try {
            const newInfoSql = `
            UPDATE "user"
            SET
                nickname = $2,
                email = $3
            WHERE
                idx = $1
            RETURNING *;
            `;

            const userInfo = await pool.query(newInfoSql, [userIdx, nickname, email]);
            if (userInfo.rows.length === 0) {
                return res.status(401).send({ message: '내 정보 수정 실패' });
            }

            return res.status(200).send('내 정보 수정 성공');
        } catch (error) {
            next(error);
        }
    }
);

//프로필 이미지
router.put('/image', checkLogin, uploadS3.single('image'), async (req, res, next) => {
    try {
        const { userIdx } = req.decoded;
        const uploadedFile = req.file;

        if (!uploadedFile) {
            return res.status(400).send({ message: '업로드 된 파일이 없습니다' });
        }
        const serachImageSql = `
        SELECT
            *
        FROM
            profile_img
        WHERE
            user_idx = $1`;
        const { rows } = await pool.query(serachImageSql, [userIdx]);

        if (rows.length > 0) {
            const deleteImageSql = `
        UPDATE
            profile_img 
        SET
            deleted_at = now()
        WHERE
            user_idx = $1`;
            await pool.query(deleteImageSql, [userIdx]);
            console.log('이전 이미지 삭제');
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

//알람 출력
router.get('/notification', checkLogin, async (req, res, next) => {
    try {
        const { userIdx } = req.decoded;
        const { lastIdx } = req.query;

        // 사용자의 알람 조회
        const getNotificationsQuery = `
        SELECT 
            * 
        FROM 
            notification 
        WHERE 
            user_idx = $1
        AND 
            idx > $2 
        ORDER BY 
            idx DESC 
        LIMIT 20`;
        const notifications = await pool.query(getNotificationsQuery, [userIdx, lastIdx]);
        const returnLastIdx = notifications.rows[0].idx;
        if (!notifications.rows || notifications.rows.length === 0) {
            return res.status(400).send(userIdx + '번 사용자의 알람이 없습니다.');
        }

        // 알람 타입에 따른 title 조회
        for (let notification of notifications.rows) {
            if (notification.type === 1) {
                // post 테이블 조회
                const postQuery = `
                SELECT 
                    title 
                FROM
                    post 
                WHERE
                    idx = $1`;
                const postResult = await pool.query(postQuery, [notification.post_idx]);
                notification.postInfo = postResult.rows[0];
            } else if (notification.type === 2 || notification.type === 3) {
                // game 테이블 조회
                const gameQuery = `
                SELECT 
                    title 
                FROM
                    game
                WHERE
                    idx = $1`;
                const gameResult = await pool.query(gameQuery, [notification.game_idx]);
                notification.gameInfo = gameResult.rows[0];
            }
        }

        res.status(200).send({ notifications: notifications.rows, lastIdx: returnLastIdx });
    } catch (error) {
        next(error);
    }
});

//알람 삭제
router.delete('/notification/:notificationId', checkLogin, async (req, res, next) => {
    try {
        const { userIdx } = req.decoded; // 사용자 ID
        const { notificationId } = req.params; // URL에서 알람 ID 추출

        // 알람이 사용자의 것인지 확인하는 쿼리
        const checkNotificationQuery = `
        SELECT
            *
        FROM
            notification
        WHERE
            idx = $1 AND user_idx = $2`;
        const checkResult = await pool.query(checkNotificationQuery, [notificationId, userIdx]);

        if (checkResult.rows.length === 0) {
            return res.status(404).send('해당 알람을 찾을 수 없거나 삭제할 권한이 없습니다.');
        }

        // 알람 삭제 쿼리 실행
        const deleteNotificationQuery = `
        UPDATE
            notification
        SET
            deleted_at = now()
        WHERE
            idx = $1`;
        await pool.query(deleteNotificationQuery, [notificationId]);

        res.status(200).send(notificationId + '번 알람이 삭제되었습니다.');
    } catch (error) {
        next(error);
    }
});

module.exports = router;
