const bcrypt = require('bcrypt');

const hashPassword = async (password) => {
    const saltRounds = 10;
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        return hashedPassword;
    } catch (error) {
        throw new Error('비밀번호 해싱 중 에러 발생', error);
    }
};

module.exports = {
    hashPassword,
};
