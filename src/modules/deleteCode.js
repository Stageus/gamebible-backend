const cron = require('node-cron');

//db성능을 고려해서 1분으로 설정(상황에 따라 시간 변경 가능)
function deleteCode(pool) {
    cron.schedule('* * * * *', async () => {
        try {
            const deleteQuery = `
        DELETE FROM email_verification
        WHERE created_at < NOW() - INTERVAL '3 minutes'
      `;
            const result = await pool.query(deleteQuery);
            console.log(`${result.rowCount}개 code 지워짐`);
        } catch (error) {
            console.error('Error deleting expired records:', error);
        }
    });
}

module.exports = deleteCode;
