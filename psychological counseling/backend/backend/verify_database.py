import mysql.connector
from mysql.connector import Error

DB_NAME = "psy_mvp"
HOST = "localhost"
USER = "root"
PASSWORD = "123456"


def verify_database():
    """验证数据库和表"""
    try:
        connection = mysql.connector.connect(
            host=HOST,
            user=USER,
            password=PASSWORD,
            database=DB_NAME
        )
        
        if connection.is_connected():
            cursor = connection.cursor()
            
            print("验证数据库结构：")
            print("-" * 40)
            
            cursor.execute("SHOW TABLES")
            tables = cursor.fetchall()
            print(f"数据库 {DB_NAME} 中的表：")
            for table in tables:
                print(f"  - {table[0]}")
            
            print("\n表结构详情：")
            print("-" * 40)
            
            for table in tables:
                table_name = table[0]
                print(f"\n表 {table_name} 的字段：")
                cursor.execute(f"DESCRIBE {table_name}")
                columns = cursor.fetchall()
                for col in columns:
                    print(f"  {col[0]:20s} {col[1]:25s} {col[2]:5s} {col[3]:5s}")
            
            cursor.close()
            connection.close()
            return True
    except Error as e:
        print(f"验证失败: {e}")
        return False


if __name__ == "__main__":
    verify_database()
