const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { body, query } = require('express-validator');
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
const { default: axios } = require('axios');

//로그인
router.post(
    '/auth',
    body('id')
        .trim()
        .isLength({ min: 4, max: 20 })
        .withMessage('아이디는 4자 이상 20자 이하로 해주세요.'),
    body('pw')
        .trim()
        .isLength({ min: 8, max: 20 })
        .withMessage('비밀번호는 8자 이상 20자 이하이어야 합니다.'),
    handleValidationErrors,
    async (req, res, next) => {
        const { id, pw } = req.body;
        try {
            // 사용자 정보 조회 (비밀번호는 해시된 상태로 저장되어 있음)
            const userQuery = `
            SELECT
            *
            FROM
                account_local al
            JOIN
                "user" u ON al.user_idx = u.idx
            WHERE
                al.id = $1 AND u.deleted_at IS NULL`;

            const values = [id];

            const { rows: userRows } = await pool.query(userQuery, values);

            if (userRows.length === 0) {
                return res.status(204).send({ message: '로그인 실패' });
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

            res.status(200).send({ message: '로그인 성공', token: token, data: user });
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
            .isLength({ min: 4, max: 20 })
            .withMessage('아이디는 4자 이상 20자 이하로 해주세요.'),
        body('pw')
            .trim()
            .isLength({ min: 8, max: 20 })
            .withMessage('비밀번호는 8자 이상 20자 이하이어야 합니다.'),
        body('email').trim().isEmail().withMessage('유효하지 않은 이메일 형식입니다.'),
        body('nickname')
            .trim()
            .isLength({ min: 2, max: 20 })
            .withMessage('닉네임은 2자 이상 20자 이하로 해주세요.'),
        handleValidationErrors,
    ],
    async (req, res, next) => {
        const { id, pw, nickname, email } = req.body;
        let { isadmin } = req.body;
        let poolClient;

        try {
            if (!isadmin) {
                isadmin = false;
            }
            console.log(id, pw, nickname, email, isadmin);
            poolClient = await pool.connect();
            await poolClient.query('BEGIN');

            //아이디 중복 확인
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
            const idResults = await poolClient.query(checkIdSql, values);
            if (idResults.rows.length > 0) return res.status(409).send('아이디가 이미 존재합니다.');

            //닉네임 중복 확인
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
            const nicknameResults = await poolClient.query(checkNicknameSql, value);
            if (nicknameResults.rows.length > 0)
                return res.status(409).send('닉네임이 이미 존재합니다.');

            //이메일 중복 확인
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
            const emailResults = await poolClient.query(checkEmailSql, checkEmailvalue);
            if (emailResults.rows.length > 0)
                return res.status(409).send('이메일이 이미 존재합니다.');

            const hashedPw = await hashPassword(pw); // 비밀번호 해싱

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
            const userResult = await poolClient.query(insertUserSql, userValues);
            if (userResult.rows.length === 0) {
                await poolClient.query('ROLLBACK');
                console.log('트랜젝션');
                return res.status(204).send({ message: '회원가입 실패' });
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
            const accountResult = await poolClient.query(insertAccountSql, accountValues);

            if (accountResult.rows.length === 0) {
                await poolClient.query('ROLLBACK');
                console.log('트랜젝션');
                return res.status(204).send({ message: '회원가입 실패' });
            }
            await poolClient.query('COMMIT');
            return res.status(200).send('회원가입 성공');
        } catch (e) {
            await poolClient.query('ROLLBACK');
            next(e);
        } finally {
            if (poolClient) poolClient.release();
        }
    }
);

//아이디 중복 확인
router.post(
    '/id/check',
    body('id')
        .trim()
        .isLength({ min: 4, max: 20 })
        .withMessage('아이디는 4자 이상 20자 이하로 해주세요.'),
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
        .isLength({ min: 2, max: 20 })
        .withMessage('닉네임은 2자 이상 20자 이하로 해주세요.'),
    handleValidationErrors,
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
    handleValidationErrors,
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
router.post(
    '/email/auth',
    body('code')
        .trim()
        .isLength({ min: 5, max: 5 })
        .withMessage('인증코드는 5자리 숫자로 해주세요.')
        .isNumeric()
        .withMessage('인증코드는 숫자로만 구성되어야 합니다.'),
    body('email').trim().isEmail().withMessage('유효하지 않은 이메일 형식입니다.'),
    handleValidationErrors,
    async (req, res, next) => {
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
                return res.status(204).send('잘못된 인증 코드입니다.');
            }
            return res.status(200).send('이메일 인증이 완료되었습니다.');
        } catch (e) {
            next(e);
        }
    }
);

// 아이디 찾기
router.get(
    '/id',
    query('email').trim().isEmail().withMessage('유효하지 않은 이메일 형식입니다.'),
    handleValidationErrors,
    async (req, res, next) => {
        const { email } = req.query;
        try {
            const findIdxSql = `
            SELECT 
                a.id 
            FROM 
                account_local a
            JOIN 
                "user" u ON a.user_idx = u.idx
            WHERE 
                u.email = $1
            AND 
                u.deleted_at IS NULL;
        `;
            const findIdxvalue = [email];
            const results = await pool.query(findIdxSql, findIdxvalue);

            if (results.rows.length === 0) {
                return res.status(204).send('일치하는 사용자가 없습니다.');
            }
            const foundId = results.rows[0].id;

            return res.status(200).send({ id: foundId });
        } catch (error) {
            next(error);
        }
    }
);

//비밀번호 찾기(이메일 전송)
router.post(
    '/pw/email',
    body('email').trim().isEmail().withMessage('유효하지 않은 이메일 형식입니다.'),
    handleValidationErrors,
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
        .isLength({ min: 8, max: 20 })
        .withMessage('비밀번호는 8자 이상 20자 이하이어야 합니다.'),
    handleValidationErrors,
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
                return res.status(204).send('비밀번호 변경 실패');
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
            u.*, al.*, ak.*
        FROM
            "user" u
        LEFT JOIN account_local al ON u.idx = al.user_idx
        LEFT JOIN account_kakao ak ON u.idx = ak.user_idx
        WHERE u.idx = $1;
    `;
        // queryDatabase 함수를 사용하여 쿼리 실행
        const userInfo = await pool.query(getUserInfoQuery, [userIdx]);

        if (userInfo.rows.length === 0) {
            return res.status(204).send({ message: '내 정보 보기 실패' });
        }

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
        .isLength({ min: 2, max: 20 })
        .withMessage('닉네임은 2자 이상 20자 이하로 해주세요.'),
    handleValidationErrors,
    async (req, res, next) => {
        const { userIdx } = req.decoded;
        const { nickname, email } = req.body;
        console.log(nickname, email);
        try {
            const userInfoSql = `
            SELECT
                nickname,email
            FROM
                "user"
            WHERE
                idx=$1
            AND 
                deleted_at IS NULL
            `;
            const infoValue = [userIdx];

            const userInfoResults = await pool.query(userInfoSql, infoValue);
            if (userInfoResults.rows.length === 0)
                return res.status(204).send('사용자 정보 조회 실패');

            const { nickname: userNickname, email: userEmail } = userInfoResults.rows[0];
            console.log(userNickname, userEmail);
            console.log(nickname, email);
            //닉네임 중복 확인
            const checkNicknameSql = `
            SELECT
                * 
            FROM
                "user" 
            WHERE 
                nickname = $1
            AND 
                nickname <> $2 
            AND
                deleted_at IS NULL`;

            const value = [nickname, userNickname];

            const nicknameResults = await pool.query(checkNicknameSql, value);
            if (nicknameResults.rows.length > 0)
                return res.status(409).send('닉네임이 이미 존재합니다.');

            //이메일 중복 확인
            const checkEmailSql = `
            SELECT
                * 
            FROM
                "user" 
            WHERE 
                email = $1
            AND 
                email <> $2
            AND 
                deleted_at IS NULL`;

            const checkEmailvalue = [email, userEmail];
            const emailResults = await pool.query(checkEmailSql, checkEmailvalue);
            if (emailResults.rows.length > 0) {
                return res.status(409).send('이메일이 이미 존재합니다.');
            }

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
                return res.status(204).send({ message: '내 정보 수정 실패' });
            }

            return res.status(200).send({ message: '내 정보 수정 성공' });
        } catch (error) {
            next(error);
        }
    }
);

//프로필 이미지
router.put('/image', checkLogin, uploadS3.single('image'), async (req, res, next) => {
    let poolClient;
    try {
        const { userIdx } = req.decoded;
        const uploadedFile = req.file;

        poolClient = await pool.connect();
        await poolClient.query('BEGIN');

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
            await poolClient.query(deleteImageSql, [userIdx]);
            console.log('이전 이미지 삭제');
        }
        const imageSql = `
        INSERT INTO 
            profile_img (
                img_path, 
                user_idx
                )
        VALUES ($1, $2)
        RETURNING *`;
        const imageQuery = await poolClient.query(imageSql, [uploadedFile.location, userIdx]);
        if (imageQuery.rows.length === 0) {
            await poolClient.query(`ROLLBACK`);
            return res.status(204).send({ message: '이미지 수정 실패' });
        }

        await poolClient.query(`COMMIT`);
        return res.status(200).send('이미지 수정 성공');
    } catch (error) {
        if (poolClient) await poolClient.query(`ROLLBACK`);
        next(error);
    } finally {
        if (poolClient) poolClient.release();
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
        const lastIdx = req.query.lastidx || 1;

        // 사용자의 알람 조회
        const noti = `SELECT
            n.*,
            p.title AS post_title,
            g.title AS game_title
        FROM
            notification n
        LEFT JOIN
            post p ON n.post_idx = p.idx AND n.type = 1
        LEFT JOIN
            game g ON n.game_idx = g.idx AND (n.type = 2 OR n.type = 3)
        WHERE
            n.user_idx = $1
        AND
            n.idx > $2
        ORDER BY
            n.idx DESC
        LIMIT 20;`;

        const notifications = await pool.query(noti, [userIdx, lastIdx]);
        const returnLastIdx = notifications.rows[0].idx;
        if (notifications.rows.length === 0) {
            return res.status(204).send(userIdx + '번 사용자의 알람이 없습니다.');
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
            return res.status(204).send('해당 알람을 찾을 수 없거나 삭제할 권한이 없습니다.');
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

//카카오 로그인(회원가입)경로
router.get('/auth/kakao', (req, res, next) => {
    const kakao = process.env.KAKAO_LOGIN_AUTH;
    res.status(200).send({ data: kakao });
});

//카카오톡 로그인(회원가입)
router.get('/kakao/callback', async (req, res, next) => {
    const { code } = req.query;
    REST_API_KEY = process.env.REST_API_KEY;
    REDIRECT_URI = process.env.REDIRECT_URI;
    const tokenRequestData = {
        grant_type: 'authorization_code',
        client_id: REST_API_KEY,
        redirect_uri: REDIRECT_URI,
        code,
    };
    let poolClient;
    try {
        const params = new URLSearchParams();
        Object.keys(tokenRequestData).forEach((key) => {
            params.append(key, tokenRequestData[key]);
        });

        // Axios POST 요청
        const { data } = await axios.post(
            'https://kauth.kakao.com/oauth/token',
            params.toString(), // URLSearchParams 객체를 문자열로 변환
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );
        const ACCESS_TOKEN = data.access_token;
        console.log(ACCESS_TOKEN);
        const config = {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
            },
        };
        const response = await axios.get('https://kapi.kakao.com/v2/user/me', config);

        poolClient = await pool.connect();
        await poolClient.query('BEGIN');

        const kakaoSql = `
        SELECT
            *
        FROM
            account_kakao ak
        JOIN
            "user" u ON ak.user_idx = u.idx
        WHERE
        ak.kakao_key = $1 AND u.deleted_at IS NULL`;
        const kakaoResult = await poolClient.query(kakaoSql, [response.data.id]);

        //중복 사용자가 없다면(회원가입)
        if (kakaoResult.rows.length === 0) {
            console.log('회원가입: ');
            //이메일 중복 확인
            const checkEmailSql = `
            SELECT
                *
            FROM
                "user"
            WHERE
            email = $1
            AND
                deleted_at IS NULL`;

            const checkEmailvalue = [response.data.kakao_account.email];
            const emailResults = await poolClient.query(checkEmailSql, checkEmailvalue);
            if (emailResults.rows.length > 0) {
                await poolClient.query('ROLLBACK');
                return res.status(409).send('일반 회원가입으로 가입된 사용자입니다.');
            }

            //랜덤 닉네임 생성
            function generateRandomString(length) {
                let result = '';
                let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                let charactersLength = characters.length;
                for (let i = 0; i < length; i++) {
                    result += characters.charAt(Math.floor(Math.random() * charactersLength));
                }
                return result;
            }
            let randomNickname = generateRandomString(20);
            //닉네임 중복 확인
            const checkNicknameSql = `
            SELECT
                * 
            FROM
                "user" 
            WHERE 
                nickname = $1 
            AND 
                deleted_at IS NULL`;

            const value = [randomNickname];
            const nicknameResults = await poolClient.query(checkNicknameSql, value);
            if (nicknameResults.rows.length > 0) {
                while (nicknameResults.rows.length > 0) {
                    randomNickname = generateRandomString(20);
                    nicknameResults = await poolClient.query(checkNicknameSql, value);
                }
            }

            const kakaoAuthSql = `
              INSERT INTO
                "user"(
                    nickname,
                    email,
                    is_admin
                    ) 
            VALUES ($1, $2, $3)
            RETURNING idx
            `;
            const kakaoResult = await poolClient.query(kakaoAuthSql, [
                randomNickname,
                response.data.kakao_account.email,
                false, //굳이 관리자 권한 안 줘도 되겠지?
            ]);
            if (kakaoResult.rows.length === 0) {
                await poolClient.query('ROLLBACK');
                return res.status(204).send('카카오 회원가입 실패');
            }

            const userIdx = kakaoResult.rows[0].idx;

            const insertAccountSql = `
            INSERT INTO
                account_kakao (
                    user_idx, 
                    kakao_key
                    )
            VALUES ($1, $2)
            RETURNING *`;
            const accountValues = [userIdx, response.data.id];
            const accountResult = await poolClient.query(insertAccountSql, accountValues);

            if (accountResult.rows.length === 0) {
                await poolClient.query('ROLLBACK');
                return res.status(204).send({ message: '카카오 회원가입 실패' });
            }
        }

        const values = [response.data.id];

        const { rows: userRows } = await poolClient.query(kakaoSql, values);

        if (userRows.length === 0) {
            return res.status(204).send({ message: '카카오톡 로그인 실패' });
        }

        const user = userRows[0];

        await poolClient.query('COMMIT');

        const token = jwt.sign(
            {
                id: response.data.id,
                userIdx: user.user_idx,
                isAdmin: user.is_admin,
            },
            process.env.SECRET_KEY,
            {
                expiresIn: '5h',
            }
        );
        return res.status(200).json({
            idx: user.user_idx,
            id: response.data.id,
            email: response.data.kakao_account.email,
            token: token,
        });
    } catch (error) {
        next(error);
    }
});

//카카오톡 탈퇴
router.delete('/auth/kakao', checkLogin, async (req, res, next) => {
    const SERVICE_APP_ADMIN_KEY = process.env.ADMIN_KEY;
    console.log(SERVICE_APP_ADMIN_KEY);
    const { id, userIdx } = req.decoded;
    console.log(id, userIdx);

    try {
        const response = await axios.post(
            'https://kapi.kakao.com/v1/user/unlink',
            `target_id_type=user_id&target_id=${id}`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `KakaoAK ${SERVICE_APP_ADMIN_KEY}`,
                },
            }
        );
        const deleteSql = `
        UPDATE
            "user"
        SET
            deleted_at = now()
        WHERE
            idx = $1`;

        const deletequery = await pool.query(deleteSql, [userIdx]);
        if (deletequery.rowCount === 0) {
            return res.status(204).send({ message: '카카오 회원 탈퇴 실패' });
        }
        res.json('회원 탈퇴 성공');
    } catch (error) {
        next(error);
    }
});

module.exports = router;
