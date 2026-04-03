import pymysql.cursors

def db_connection():
    return pymysql.connect(
        host="localhost",
        user="edu_sync",
        password="Edu_sync4672",
        database="edu_sync",
        cursorclass=pymysql.cursors.DictCursor
    )
