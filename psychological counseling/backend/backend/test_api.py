# -*- coding: utf-8 -*-
"""
心理陪伴助手接口自动化测试脚本
使用 Python 标准库 urllib，无需安装任何依赖
运行：python test_api.py
"""
import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8080/api"

USERNAME = "test"
PASSWORD = "123456"


def post(path, body, token=None):
    """发送 POST 请求，返回解析后的 JSON dict"""
    url = BASE_URL + path
    data = json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token

    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        # 业务异常（如用户名已存在）会走这里
        err_body = e.read().decode("utf-8", errors="ignore")
        return {"_http_error": e.code, "_body": err_body}
    except urllib.error.URLError as e:
        return {"_url_error": str(e.reason)}


def step(msg):
    print("\n" + "=" * 50)
    print("STEP:", msg)
    print("=" * 50)


if __name__ == "__main__":
    # ===== 1. 注册 =====
    step("1) POST /api/register  注册用户 test/123456")
    reg_resp = post("/register", {"username": USERNAME, "password": PASSWORD})
    print("Response:", json.dumps(reg_resp, ensure_ascii=False, indent=2))
    # 用户名已存在属于预期情况，不中断流程

    # ===== 2. 登录拿 Token =====
    step("2) POST /api/login  登录获取 Token")
    login_resp = post("/login", {"username": USERNAME, "password": PASSWORD})
    print("Response:", json.dumps(login_resp, ensure_ascii=False, indent=2))

    token = login_resp.get("token")
    user_id = login_resp.get("userId")
    if not token or not user_id:
        print("\n登录失败，未拿到 token/userId，流程终止")
        exit(1)

    print("\n提取到：")
    print("  token  =", token[:30] + "..." if len(token) > 30 else token)
    print("  userId =", user_id)

    # ===== 3. 发送聊天消息 =====
    step("3) POST /api/chat  发送消息 '我最近压力好大'")
    chat_resp = post(
        "/chat",
        {"userId": user_id, "message": "我最近压力好大"},
        token=token,
    )
    print("Response:", json.dumps(chat_resp, ensure_ascii=False, indent=2))

    print("\n" + "=" * 50)
    print("测试完成")
    print("=" * 50)
