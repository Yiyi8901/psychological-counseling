package com.example.psy.service;

import java.util.Map;

public interface UserService {

    /**
     * 用户注册：检查用户名是否已存在，不存在则对密码做 MD5 加密后入库
     *
     * @param username 用户名
     * @param password 明文密码
     */
    void register(String username, String password);

    /**
     * 用户登录：校验用户名密码，成功则返回包含 token 与 userId 的结果
     *
     * @param username 用户名
     * @param password 明文密码
     * @return Map 包含 token、userId 两个字段
     */
    Map<String, Object> login(String username, String password);
}
