import mysql.connector
from mysql.connector import Error

DB_NAME = "psy_mvp"
HOST = "localhost"
USER = "root"
PASSWORD = "123456"


def create_database():
    """创建数据库"""
    try:
        connection = mysql.connector.connect(
            host=HOST,
            user=USER,
            password=PASSWORD
        )
        
        if connection.is_connected():
            cursor = connection.cursor()
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print(f"数据库 {DB_NAME} 创建成功（如果已存在则跳过）")
            cursor.close()
            connection.close()
            return True
    except Error as e:
        print(f"创建数据库失败: {e}")
        return False


def create_tables():
    """创建表结构"""
    try:
        connection = mysql.connector.connect(
            host=HOST,
            user=USER,
            password=PASSWORD,
            database=DB_NAME
        )
        
        if connection.is_connected():
            cursor = connection.cursor()
            
            # 创建用户表 sys_user
            create_user_table = """
            CREATE TABLE IF NOT EXISTS `sys_user` (
                `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
                `username` VARCHAR(50) NOT NULL COMMENT '用户名',
                `password` VARCHAR(255) NOT NULL COMMENT '密码（加密后）',
                `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                PRIMARY KEY (`id`),
                UNIQUE KEY `uk_username` (`username`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
            """
            cursor.execute(create_user_table)
            print("表 sys_user 创建成功")
            
            # 创建聊天消息表 chat_message
            create_message_table = """
            CREATE TABLE IF NOT EXISTS `chat_message` (
                `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
                `user_id` BIGINT NOT NULL COMMENT '用户ID',
                `session_id` VARCHAR(64) NULL COMMENT '会话ID',
                `role` VARCHAR(20) NOT NULL COMMENT '消息角色：user/ai',
                `content` TEXT NOT NULL COMMENT '消息内容',
                `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                PRIMARY KEY (`id`),
                INDEX `idx_session_user` (`session_id`, `user_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='聊天消息表';
            """
            cursor.execute(create_message_table)
            print("表 chat_message 创建成功")
            
            connection.commit()
            cursor.close()
            connection.close()
            return True
    except Error as e:
        print(f"创建表失败: {e}")
        return False


def main():
    print("=" * 50)
    print("开始创建数据库和表")
    print("=" * 50)
    
    if create_database():
        if create_tables():
            print("=" * 50)
            print("数据库和表创建完成！")
            print("=" * 50)
        else:
            print("表创建失败")
    else:
        print("数据库创建失败")


if __name__ == "__main__":
    main()
