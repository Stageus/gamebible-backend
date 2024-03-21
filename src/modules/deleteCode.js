async function deleteExpiredCodes(pool) {
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
}

async function deleteCode(pool) {
    setTimeout(() => {
        deleteExpiredCodes(pool);
    }, 190000);
}

module.exports = deleteCode;
