const { pool } = require('../config/postgres');

/**
 *
 * @param {{
 *  conn: any,
 *  type: 'DENY_GAME'| 'MODIFY_GAME' | 'MAKE_COMMENT' |,
 *  gameIdx: number,
 *  postIdx: number,
 *  toUserIdx: number,
 * }} option
 */

const generateNotification = async (option) => {
    let notificationType = null;

    if (option.type == 'MAKE_COMMENT') notificationType = 1;
    else if (option.type == 'MODIFY_GAME') notificationType = 2;
    else if (option.type == 'DENY_GAME') notificationType = 3;

    const insertNotificationSQL = `
        INSERT INTO
            notification (type, user_idx, game_idx, post_idx)
        VALUES( $1, $2, $3, $4 )`;
    const insertNotificationValues = [
        notificationType,
        option.toUserIdx,
        option.gameIdx,
        option.postIdx || null,
    ];
    console.log('실행');
    const result = await (option.poolClient || pool).query(
        insertNotificationSQL,
        insertNotificationValues
    );
    console.log(result);
    console.log('실행완료');
};

module.exports = { generateNotification };
