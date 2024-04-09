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
  deleted_at timestamp with time zone,
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
  deleted_at timestamp with time zone,
  PRIMARY KEY (idx)
);


CREATE TABLE game_img
(
  idx         SERIAL                   NOT NULL,
  history_idx SERIAL                   NOT NULL,
  img_path    VARCHAR                  NOT NULL,
  created_at  timestamp with time zone DEFAULT now(),
  deleted_at  timestamp with time zone,
  PRIMARY KEY (idx)
);


CREATE TABLE game_img_banner
(
  idx        SERIAL                   NOT NULL,
  game_idx   SERIAL                   NOT NULL,
  img_path   VARCHAR                  NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  PRIMARY KEY (idx)
);


CREATE TABLE game_img_thumnail
(
  idx        SERIAL                   NOT NULL,
  game_idx   SERIAL                   NOT NULL,
  imq_path   VARCHAR                  NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  PRIMARY KEY (idx)
);


CREATE TABLE history
(
  idx        SERIAL                   NOT NULL,
  game_idx   SERIAL                   NOT NULL,
  user_idx   SERIAL                   NOT NULL,
  content    TEXT                     NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  PRIMARY KEY (idx)
);


CREATE TABLE notification
(
  idx        SERIAL                   NOT NULL,
  type       SERIAL                   NOT NULL,
  user_idx   SERIAL                   NOT NULL,
  game_idx   SERIAL                  ,
  post_idx   SERIAL                  ,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
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
  deleted_at timestamp with time zone,
  PRIMARY KEY (idx)
);


CREATE TABLE post_img
(
  idx        SERIAL                   NOT NULL,
  post_idx   SERIAL                   NOT NULL,
  img_path   VARCHAR                  NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  PRIMARY KEY (idx)
);


CREATE TABLE profile_img
(
  idx        SERIAL                   NOT NULL,
  user_idx   SERIAL                   NOT NULL,
  img_path   VARCHAR                  NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
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
  deleted_at timestamp with time zone,
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

        
      