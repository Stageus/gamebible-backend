CREATE USER test_deploy_admin WITH PASSWORD '1234';

CREATE DATABASE gamebible OWNER test_deploy_admin;

\c gamebible test_deploy_admin

CREATE TABLE account_kakao
(
  user_idx  SERIAL NOT NULL,
  kakao_key int    NOT NULL,
  PRIMARY KEY (user_idx)
);


CREATE TABLE account_local
(
  user_idx SERIAL  NOT NULL,
  id       VARCHAR NOT NULL,
  pw       VARCHAR NOT NULL,
  PRIMARY KEY (user_idx)
);



CREATE TABLE comment
(
  idx        SERIAL                   NOT NULL,
  user_idx   SERIAL                   NOT NULL,
  post_idx   SERIAL                   NOT NULL,
  content    TEXT                     NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  PRIMARY KEY (idx)
);


CREATE TABLE email_verification
(
  idx        SERIAL                   NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  code       VARCHAR                  NOT NULL,
  email      VARCHAR                  NOT NULL,
  PRIMARY KEY (idx)
);



CREATE TABLE game
(
  idx        SERIAL                   NOT NULL,
  user_idx   SERIAL                   NOT NULL,
  title      VARCHAR(40)              NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  PRIMARY KEY (idx)
);


CREATE TABLE game_img
(
  idx         SERIAL                   NOT NULL,
  history_idx SERIAL                   NOT NULL,
  img_path    VARCHAR                  NOT NULL,
  created_at  timestamp with time zone DEFAULT now(),
  deleted_at  timestamp with time zone NULL,
  PRIMARY KEY (idx)
);


CREATE TABLE game_img_banner
(
  idx        SERIAL                   NOT NULL,
  game_idx   SERIAL                   NOT NULL,
  img_path   VARCHAR                  NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  PRIMARY KEY (idx)
);


CREATE TABLE game_img_thumnail
(
  idx        SERIAL                   NOT NULL,
  game_idx   SERIAL                   NOT NULL,
  img_path   VARCHAR                  NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  PRIMARY KEY (idx)
);


CREATE TABLE history
(
  idx        SERIAL                   NOT NULL,
  game_idx   SERIAL                   NOT NULL,
  user_idx   SERIAL                   NOT NULL,
  content    TEXT                     NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  PRIMARY KEY (idx)
);


CREATE TABLE notification
(
  idx        SERIAL                   NOT NULL,
  type       SERIAL                   NOT NULL,
  user_idx   SERIAL                   NOT NULL,
  game_idx   int                      NULL,
  post_idx   int                      NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  PRIMARY KEY (idx)
);


CREATE TABLE notification_type
(
  idx     SERIAL  NOT NULL,
  content VARCHAR NOT NULL,
  PRIMARY KEY (idx)
);


CREATE TABLE post
(
  idx        SERIAL                   NOT NULL,
  game_idx   SERIAL                   NOT NULL,
  user_idx   SERIAL                   NOT NULL,
  title      VARCHAR(40)              NOT NULL,
  content    TEXT                     NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  PRIMARY KEY (idx)
);


CREATE TABLE post_img
(
  idx        SERIAL                   NOT NULL,
  post_idx   SERIAL                   NOT NULL,
  img_path   VARCHAR                  NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  PRIMARY KEY (idx)
);


CREATE TABLE profile_img
(
  idx        SERIAL                   NOT NULL,
  user_idx   SERIAL                   NOT NULL,
  img_path   VARCHAR                  NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  PRIMARY KEY (idx)
);

CREATE TABLE request
(
  idx          SERIAL                   NOT NULL,
  user_idx     SERIAL                   NOT NULL,
  title        VARCHAR                  NOT NULL,
  is_confirmed BOOLEAN                  NOT NULL DEFAULT false,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at   timestamp with time zone,
  PRIMARY KEY (idx)
);


CREATE TABLE "user"
(
  idx        SERIAL                   NOT NULL,
  is_admin   BOOLEAN                  NOT NULL,
  nickname   VARCHAR                  NOT NULL,
  email      VARCHAR                  NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  PRIMARY KEY (idx)
);

CREATE TABLE view
(
  idx      SERIAL NOT NULL,
  post_idx SERIAL NOT NULL,
  user_idx SERIAL NOT NULL,
  PRIMARY KEY (idx)
);


ALTER TABLE post
  ADD CONSTRAINT FK_game_TO_post
    FOREIGN KEY (game_idx)
    REFERENCES game (idx);

ALTER TABLE post
  ADD CONSTRAINT FK_user_TO_post
    FOREIGN KEY (user_idx)
    REFERENCES "user" (idx);

ALTER TABLE comment
  ADD CONSTRAINT FK_user_TO_comment
    FOREIGN KEY (user_idx)
    REFERENCES "user" (idx);

ALTER TABLE comment
  ADD CONSTRAINT FK_post_TO_comment
    FOREIGN KEY (post_idx)
    REFERENCES post (idx);

ALTER TABLE view
  ADD CONSTRAINT FK_post_TO_view
    FOREIGN KEY (post_idx)
    REFERENCES post (idx);

ALTER TABLE view
  ADD CONSTRAINT FK_user_TO_view
    FOREIGN KEY (user_idx)
    REFERENCES "user" (idx);

ALTER TABLE notification
  ADD CONSTRAINT FK_user_TO_notification
    FOREIGN KEY (user_idx)
    REFERENCES "user" (idx);

ALTER TABLE profile_img
  ADD CONSTRAINT FK_user_TO_profile_img
    FOREIGN KEY (user_idx)
    REFERENCES "user" (idx);

ALTER TABLE request
  ADD CONSTRAINT FK_user_TO_request
    FOREIGN KEY (user_idx)
    REFERENCES "user" (idx);

ALTER TABLE account_local
  ADD CONSTRAINT FK_user_TO_account_local
    FOREIGN KEY (user_idx)
    REFERENCES "user" (idx);

ALTER TABLE game
  ADD CONSTRAINT FK_user_TO_game
    FOREIGN KEY (user_idx)
    REFERENCES "user" (idx);

ALTER TABLE account_kakao
  ADD CONSTRAINT FK_user_TO_account_kakao
    FOREIGN KEY (user_idx)
    REFERENCES "user" (idx);

ALTER TABLE game_img_thumnail
  ADD CONSTRAINT FK_game_TO_game_img_thumnail
    FOREIGN KEY (game_idx)
    REFERENCES game (idx);

ALTER TABLE game_img_banner
  ADD CONSTRAINT FK_game_TO_game_img_banner
    FOREIGN KEY (game_idx)
    REFERENCES game (idx);

ALTER TABLE notification
  ADD CONSTRAINT FK_notification_type_TO_notification
    FOREIGN KEY (type)
    REFERENCES notification_type (idx);

ALTER TABLE notification
  ADD CONSTRAINT FK_post_TO_notification
    FOREIGN KEY (post_idx)
    REFERENCES post (idx);

ALTER TABLE notification
  ADD CONSTRAINT FK_game_TO_notification
    FOREIGN KEY (game_idx)
    REFERENCES game (idx);

ALTER TABLE history
  ADD CONSTRAINT FK_game_TO_history
    FOREIGN KEY (game_idx)
    REFERENCES game (idx);

ALTER TABLE history
  ADD CONSTRAINT FK_user_TO_history
    FOREIGN KEY (user_idx)
    REFERENCES "user" (idx);

ALTER TABLE post_img
  ADD CONSTRAINT FK_post_TO_post_img
    FOREIGN KEY (post_idx)
    REFERENCES post (idx);

ALTER TABLE game_img
  ADD CONSTRAINT FK_history_TO_game_img
    FOREIGN KEY (history_idx)
    REFERENCES history (idx);

INSERT INTO "user" 
  (idx, is_admin, nickname, email)
  VALUES
  (1, false, '홍길동', 'abc123@xx.xx'),
  (2, true, '관리자', 'admin@xx.xx'),
  (3, false, '게스트', 'guest@xx.xx'),
  (4, false, '악의적사용자', 'block@xx.xx');

INSERT INTO account_local 
  (user_idx, id, pw)
  VALUES  
  (1, 'abc123', '$2b$10$ACe1KTIhdPlOWdMTgRCu1OXxLkmXuumzT.Nd9.5nRiT61gGpEI93K'),
  (2, 'admin1234', '$2b$10$ACe1KTIhdPlOWdMTgRCu1OXxLkmXuumzT.Nd9.5nRiT61gGpEI93K'),
  (3, 'guest1234', '$2b$10$ACe1KTIhdPlOWdMTgRCu1OXxLkmXuumzT.Nd9.5nRiT61gGpEI93K'),
  (4, 'block1234', '$2b$10$ACe1KTIhdPlOWdMTgRCu1OXxLkmXuumzT.Nd9.5nRiT61gGpEI93K');

INSERT INTO request
  (idx, user_idx, title, is_confirmed)
  VALUES 
  (1, 1, '리그오브레전드', true),
  (2, 3, '오버워치', true),
  (3, 1, '메이플스토리', false),
  (4, 3, '메이플스토리2', false),
  (5, 3, '폴가이즈', false),
  (6, 4, '비난과욕설', false),
  (7, 4, '나쁜XX', false);

INSERT INTO game
  (idx, user_idx, title)
  VALUES 
  (1, 1, '리그오브레전드'),
  (2, 3, '오버워치');

  INSERT INTO post
  (idx, game_idx, user_idx, title, content)
  VALUES
  (1, 1, 1, '리그오브레전드 게시글1', '리그오브레전드 게시글1'),
  (2, 1, 1, '리그오브레전드 게시글2', '리그오브레전드 게시글2'),
  (3, 1, 1, '리그오브레전드 게시글3', '리그오브레전드 게시글3'),
  (4, 2, 1, '오버워치 게시글1', '오버워치 게시글1'),
  (5, 2, 1, '오버워치 게시글2', '오버워치 게시글2'),
  (6, 2, 1, '오버워치 게시글3', '오버워치 게시글3'),
  (7, 2, 1, '오버워치 게시글4', '오버워치 게시글4');

  INSERT INTO comment
  (idx, user_idx, post_idx, content)
  VALUES
  (1, 2, 1, '리그오브레전드 댓글1'),
  (2, 1, 1, '리그오브레전드 댓글2'),
  (3, 1, 4, '오버워치 댓글1'),
  (4, 2, 4, '오버워치 댓글2'),
  (5, 3, 4, '오버워치 댓글3');


  INSERT INTO game_img_thumnail
  (idx, game_idx, img_path)
  VALUES
  (1, 1, 'https://gamebible.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8%EC%9D%B4%EB%AF%B8%EC%A7%80/%EC%8D%B8%EB%84%A4%EC%9D%BC_%EA%B8%B0%EB%B3%B8%EC%9D%B4%EB%AF%B8%EC%A7%80.png'),
  (2, 2, 'https://gamebible.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8%EC%9D%B4%EB%AF%B8%EC%A7%80/%EC%8D%B8%EB%84%A4%EC%9D%BC_%EA%B8%B0%EB%B3%B8%EC%9D%B4%EB%AF%B8%EC%A7%80.png');


  INSERT INTO game_img_banner
  (idx, game_idx, img_path)
  VALUES
  (1, 1, 'https://gamebible.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8%EC%9D%B4%EB%AF%B8%EC%A7%80/%EB%B0%B0%EB%84%88_%EA%B8%B0%EB%B3%B8%EC%9D%B4%EB%AF%B8%EC%A7%80.png'),
  (2, 2, 'https://gamebible.s3.ap-northeast-2.amazonaws.com/%EA%B8%B0%EB%B3%B8%EC%9D%B4%EB%AF%B8%EC%A7%80/%EB%B0%B0%EB%84%88_%EA%B8%B0%EB%B3%B8%EC%9D%B4%EB%AF%B8%EC%A7%80.png');

  INSERT INTO history
  (idx, game_idx, user_idx, content)
  VALUES
  (1, 1, 1, '히스토리내용1'),
  (2, 1, 1, '히스토리내용2'),
  (3, 1, 1, '히스토리내용3'),
  (4, 2, 1, '히스토리내용1'),
  (5, 2, 1, '히스토리내용2'),
  (6, 2, 1, '히스토리내용3');

  INSERT INTO notification_type
  (idx, content)
  VALUES
  (1, '사용자의 ${title} 게시글에 새로운 댓글이 달렸습니다.'),
  (2, '${title} 위키가 수정되었습니다.'),
  (3, '요청하신 ${title} 게임생성이 거절되었습니다.');

  INSERT INTO notification
  (idx, type, user_idx, game_idx, post_idx)
  VALUES
  (1, 1, 1, null, 1),
  (2, 1, 1, null, 1),
  (3, 2, 1, 1, null),
  (4, 2, 1, 2, null);

INSERT INTO view
(idx, post_idx, user_idx)
VALUES
(1,1,1),
(2,1,1),
(3,1,1),
(4,2,1);
