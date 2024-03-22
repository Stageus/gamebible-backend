const { pool } = require('../config/postgres');

const generateNotification = async (type, userIdx, gameIdx, postIdx) => {
    const insertNotificationSQL = `
                                INSERT INTO
                                    notification (type, user_idx, game_idx, post_idx)
                                VALUES( $1, $2, $3, $4 )`;
    const insertNotificationValues = [type, userIdx, gameIdx, postIdx];
    await pool.query(insertNotificationSQL, insertNotificationValues);
};

module.exports = { generateNotification };
