package com.example.psy.config;

import cn.hutool.jwt.JWT;
import cn.hutool.jwt.JWTUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * JWT Token 校验拦截器
 *
 * 流程：
 * 1. 从 Authorization 头提取 Bearer token
 * 2. 用 jwt.secret 验证签名
 * 3. 验证通过则把 userId 放入 request attribute，Controller 可直接取用
 * 4. 验证失败返回 401 + JSON 错误信息
 */
@Slf4j
@Component
public class JwtInterceptor implements HandlerInterceptor {

    public static final String ATTR_USER_ID = "userId";

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        // 跳过 OPTIONS 预检请求
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            return writeUnauthorized(response, "未提供登录凭证，请先登录");
        }

        String token = auth.substring(7);
        try {
            JWT jwt = JWTUtil.parseToken(token);
            if (!jwt.setKey(jwtSecret.getBytes(StandardCharsets.UTF_8)).verify()) {
                return writeUnauthorized(response, "Token 签名无效");
            }

            // 检查是否过期
            if (jwt.getPayload(JWTPayload.EXPIRES_AT) != null) {
                long exp = Long.parseLong(jwt.getPayload(JWTPayload.EXPIRES_AT).toString());
                if (System.currentTimeMillis() / 1000 > exp) {
                    return writeUnauthorized(response, "登录已过期，请重新登录");
                }
            }

            // 提取 userId 存入 request，Controller 直接取用
            Object userIdObj = jwt.getPayload("userId");
            if (userIdObj == null) {
                return writeUnauthorized(response, "Token 中缺少用户信息");
            }
            Long userId = Long.valueOf(userIdObj.toString());
            request.setAttribute(ATTR_USER_ID, userId);
            return true;

        } catch (Exception e) {
            log.warn("[JWT] Token 解析失败: {}", e.getMessage());
            return writeUnauthorized(response, "Token 解析失败，请重新登录");
        }
    }

    /**
     * 返回 401 未授权响应
     */
    private boolean writeUnauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
        return false;
    }

    /**
     * Hutool JWT payload 常量（避免引入额外类）
     */
    private static class JWTPayload {
        static final String EXPIRES_AT = "exp";
    }
}
