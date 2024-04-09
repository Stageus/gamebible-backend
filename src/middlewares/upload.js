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

const fileFilter = (req, file, cb) => {
    if (file.mimetype.split('/')[0] != 'image') {
        return cb(new Error('이미지 형식이 올바르지 않습니다.'));
    }

    const maxSize = 10 * 1024 * 1024; // 10MB를 최대 파일 크기로 지정
    if (file.size > maxSize) {
        return cb(new Error('파일 크기가 너무 큽니다. 최대 10MB까지 허용됩니다.'));
    }

    cb(null, true); // 모든 검증을 통과한 경우, 파일을 업로드 허용
};

const uploadS3 = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.S3_BUCKET_NAME,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key(req, file, cb) {
            cb(null, `${Date.now()}_${file.originalname}`);
        },
        acl: 'public-read-write',
    }),
    fileFilter: fileFilter, // 파일 필터링 함수 설정
});

module.exports = { uploadS3 };
