const generateNotification = async (poolClient, type, userIdx, gameIdx, postIdx) => {
    const insertNotificationSQL = `
                                INSERT INTO
                                    notification (type, user_idx, game_idx, post_idx)
                                VALUES( $1, $2, $3, $4 )`;
    const insertNotificationValues = [type, userIdx, gameIdx, postIdx];
    await poolClient.query(insertNotificationSQL, insertNotificationValues);
};

module.exports = { generateNotification };
