package com.example.psy.service.impl;

import cn.hutool.core.util.StrUtil;
import cn.hutool.crypto.SecureUtil;
import cn.hutool.jwt.JWTUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.psy.entity.User;
import com.example.psy.mapper.UserMapper;
import com.example.psy.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class UserServiceImpl implements UserService {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Autowired
    private UserMapper userMapper;

    @Override
    public void register(String username, String password) {
        // 1. 检查用户名是否已存在
        Long existCount = userMapper.selectCount(
                new LambdaQueryWrapper<User>().eq(User::getUsername, username)
        );
        if (existCount != null && existCount > 0) {
            throw new RuntimeException("用户名已存在");
        }

        // 2. 密码 MD5 加密后入库
        User user = new User();
        user.setUsername(username);
        user.setPassword(SecureUtil.md5(password));
        userMapper.insert(user);
    }

    @Override
    public Map<String, Object> login(String username, String password) {
        // 1. 根据用户名查询用户
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getUsername, username)
        );
        if (user == null) {
            throw new RuntimeException("用户不存在");
        }

        // 2. 校验密码
        String encryptedPwd = SecureUtil.md5(password);
        if (!StrUtil.equals(user.getPassword(), encryptedPwd)) {
            throw new RuntimeException("用户名或密码错误");
        }

        // 3. 生成 JWT Token
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", user.getId());
        payload.put("username", user.getUsername());
        String token = JWTUtil.createToken(payload, jwtSecret.getBytes());

        // 4. 组装返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("token", token);
        result.put("userId", user.getId());
        return result;
    }
}
