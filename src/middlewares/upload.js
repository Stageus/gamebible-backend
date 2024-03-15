//Import
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

//aws region 및 자격증명 설정
const s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    region: 'ap-northeast-2',
});

const uploadS3 = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.S3_BUCKET_NAME,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key(req, file, cb) {
            try {
                const fileType = file.mimetype.split('/')[0] != 'image';
                if (fileType) {
                    console.log('이미지 타입 아님');
                    return cb(new Error('이미지 형식이 올바르지 않습니다.'));
                }
                cb(null, `${Date.now()}_${file.originalname}`);
            } catch {
                return cb(new Error('이미지 업로드 중 오류 발생'));
            }
        },
        acl: 'public-read-write',
    }),
});

module.exports = { uploadS3 };
