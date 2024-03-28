const nodemailer = require('nodemailer');
const { pool } = require('../config/postgres.js');
const jwt = require('jsonwebtoken');

async function changePwEmail(email) {
    let transporter = nodemailer.createTransport({
        service: 'naver',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const userQuery = `
    SELECT 
        idx
    FROM
        "user"
    WHERE
        email = $1
    AND
        deleted_at IS NULL`;
    const userResult = await pool.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
        throw new Error('사용자를 찾을 수 없습니다.');
    }

    const userIdx = userResult.rows[0].idx;

    const token = jwt.sign(
        {
            idx: userIdx,
        },
        process.env.SECRET_KEY,
        {
            expiresIn: '3m',
        }
    );

    const resetLink = `https://yourwebsite.com?token=${token}`;

    let mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: '게임대장경 비밀번호 변경 링크',
        html: `<p>비밀번호를 변경하려면 아래 링크를 클릭하세요:</p><a href="${resetLink}">비밀번호 변경하기</a>`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('이메일 전송 실패: ', error);
        } else {
            console.log('이메일 전송 성공: ' + info.response);
        }
    });
    return token;
}
module.exports = changePwEmail;
