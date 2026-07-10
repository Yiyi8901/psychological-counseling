package com.example.psy.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

/**
 * 全局异常处理器
 * 把所有抛到 Controller 之外的异常统一转成结构化 JSON，避免前端拿到裸 500 + 堆栈
 *
 * 返回格式：HTTP 500 + { "message": "错误描述" }
 * 前端用 e.response.data.message 即可拿到错误提示
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 业务异常：注册时用户名已存在、登录密码错误等
     * 这类异常信息可读，直接展示给用户
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntime(RuntimeException e) {
        log.warn("[业务异常] {}", e.getMessage());
        Map<String, Object> body = new HashMap<>();
        body.put("message", e.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    /**
     * 兜底异常：参数解析失败、空指针等非预期错误
     * 不把原始堆栈暴露给前端，只返回通用提示
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception e) {
        log.error("[系统异常]", e);
        Map<String, Object> body = new HashMap<>();
        body.put("message", "服务器开小差了，请稍后再试");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }
}
