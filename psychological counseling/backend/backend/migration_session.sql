-- ============================================
-- 会话隔离功能 - 数据库迁移脚本
-- 请在 MySQL 中执行（Navicat / DBeaver / 命令行均可）
-- ============================================

USE psy_mvp;

-- 1. 给 chat_message 表添加 session_id 列
ALTER TABLE `chat_message`
    ADD COLUMN `session_id` VARCHAR(64) NULL COMMENT '会话ID' AFTER `user_id`;

-- 2. 创建联合索引（session_id + user_id），加速按会话查询历史
CREATE INDEX `idx_session_user` ON `chat_message`(`session_id`, `user_id`);

-- 3. 给已有的历史消息补一个默认 session_id，避免查询时丢失
UPDATE `chat_message` SET `session_id` = 'legacy' WHERE `session_id` IS NULL;

-- 4. 验证
SELECT * FROM chat_message LIMIT 5;
