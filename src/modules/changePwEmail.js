const nodemailer = require('nodemailer');

async function changePwEmail(email) {
    let transporter = nodemailer.createTransport({
        service: 'naver',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const resetLink = `https://yourwebsite.com/password-reset`;

    let mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: '게임대장경 비밀번호 변경 링크',
        html: `<p>비밀번호를 변경하려면 아래 링크를 클릭하세요:</p><a href="${resetLink}">비밀번호 변경하기</a>`,
    };

    await transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('이메일 전송 실패: ', error);
        } else {
            console.log('이메일 전송 성공: ' + info.response);
        }
    });
}
module.exports = changePwEmail;
