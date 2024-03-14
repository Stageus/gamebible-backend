const { body, validationResult } = require('express-validator');

// 아이디 검증 미들웨어
const validateId = body('id')
    .trim()
    .isAlphanumeric()
    .withMessage('아이디는 알파벳과 숫자만 사용할 수 있습니다.')
    .isLength({ min: 4, max: 12 })
    .withMessage('아이디는 4자 이상 12자 이하로 해주세요.');

// 이메일 검증 미들웨어
const validateEmail = body('email')
    .trim()
    .isEmail()
    .withMessage('유효하지 않은 이메일 형식입니다.');

// 비밀번호 검증 미들웨어
const validatePassword = body('pw')
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
    .withMessage('비밀번호에는 특수문자가 최소 1개 이상 포함되어야 합니다.');

// 비밀번호 확인 검증 미들웨어
const validatePasswordMatch = body('pw_same')
    .trim()
    .custom((value, { req }) => {
        if (value !== req.body.pw) {
            throw new Error('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
        }
        return true;
    });

// 닉네임 검증 미들웨어
const validateNickname = body('nickname')
    .trim()
    .isLength({ min: 2, max: 16 })
    .withMessage('닉네임은 2자 이상 16자 이하로 해주세요.');

// 에러 처리 미들웨어
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

module.exports = {
    validateId,
    validateEmail,
    validatePassword,
    validatePasswordMatch,
    validateNickname,
    handleValidationErrors,
};
