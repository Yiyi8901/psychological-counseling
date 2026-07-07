package com.example.psy.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.psy.config.JwtInterceptor;
import com.example.psy.entity.ChatMessage;
import com.example.psy.mapper.ChatMessageMapper;
import com.example.psy.service.AiService;
import com.example.psy.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
public class MainController {

    @Autowired
    private UserService userService;

    @Autowired
    private AiService aiService;

    @Autowired
    private ChatMessageMapper chatMessageMapper;

    // ================================================================
    //  注册 / 登录（无需 Token）
    // ================================================================

    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody Map<String, String> body) {
        userService.register(body.get("username"), body.get("password"));
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "注册成功");
        return result;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body) {
        return userService.login(body.get("username"), body.get("password"));
    }

    // ================================================================
    //  会话管理
    // ================================================================

    /**
     * 获取用户的所有会话列表
     * GET /api/sessions
     * 返回：{ "sessions": [ {sessionId, title, msgCount, lastTime}, ... ] }
     */
    @GetMapping("/sessions")
    public Map<String, Object> sessions(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute(JwtInterceptor.ATTR_USER_ID);
        List<Map<String, Object>> list = chatMessageMapper.selectSessionList(userId);

        Map<String, Object> result = new HashMap<>();
        result.put("sessions", list);
        return result;
    }

    /**
     * 获取指定会话的历史消息
     * GET /api/history?sessionId=xxx&limit=30
     */
    @GetMapping("/history")
    public Map<String, Object> history(@RequestParam String sessionId,
                                       @RequestParam(defaultValue = "30") int limit,
                                       HttpServletRequest request) {
        Long userId = (Long) request.getAttribute(JwtInterceptor.ATTR_USER_ID);
        int safeLimit = Math.min(Math.max(limit, 1), 100);

        LambdaQueryWrapper<ChatMessage> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ChatMessage::getUserId, userId)
                .eq(ChatMessage::getSessionId, sessionId)
                .orderByDesc(ChatMessage::getId)
                .last("LIMIT " + safeLimit);
        List<ChatMessage> list = chatMessageMapper.selectList(wrapper);
        Collections.reverse(list);

        Map<String, Object> result = new HashMap<>();
        result.put("messages", list);
        return result;
    }

    // ================================================================
    //  聊天（非流式）
    // ================================================================

    /**
     * POST /api/chat
     * 请求体：{ "sessionId": "xxx", "message": "xxx" }
     * （userId 从 JWT Token 中提取，前端无需传）
     */
    @PostMapping("/chat")
    public Map<String, Object> chat(@RequestBody Map<String, Object> body,
                                    HttpServletRequest request) {
        Long userId = (Long) request.getAttribute(JwtInterceptor.ATTR_USER_ID);
        String sessionId = body.get("sessionId") == null ? null : body.get("sessionId").toString();
        String message = body.get("message") == null ? "" : body.get("message").toString().trim();

        if (message.isEmpty()) {
            throw new RuntimeException("消息内容不能为空");
        }

        // 1. 保存用户消息
        saveMessage(userId, sessionId, "user", message);

        // 2. 调用 AI
        String aiReply = aiService.chat(userId, sessionId, message);
        if (aiReply == null || aiReply.trim().isEmpty()) {
            aiReply = "抱歉，我暂时无法回复，请稍后再试。";
        }

        // 3. 保存 AI 回复
        saveMessage(userId, sessionId, "ai", aiReply);

        Map<String, Object> result = new HashMap<>();
        result.put("reply", aiReply);
        return result;
    }

    // ================================================================
    //  聊天（流式 SSE）
    // ================================================================

    /**
     * POST /api/chat/stream
     * 请求体：{ "sessionId": "xxx", "message": "xxx" }
     * 返回：SSE 流，每个事件 data 字段为一个文本片段
     */
    @PostMapping(value = "/chat/stream", produces = "text/event-stream;charset=UTF-8")
    public SseEmitter chatStream(@RequestBody Map<String, Object> body,
                                 HttpServletRequest request) {
        Long userId = (Long) request.getAttribute(JwtInterceptor.ATTR_USER_ID);
        String sessionId = body.get("sessionId") == null ? null : body.get("sessionId").toString();
        String message = body.get("message") == null ? "" : body.get("message").toString().trim();

        // 超时设 2 分钟，足够大模型流式返回
        SseEmitter emitter = new SseEmitter(120000L);

        if (message.isEmpty()) {
            try {
                emitter.send(SseEmitter.event().data("消息不能为空"));
                emitter.complete();
            } catch (Exception ignored) {}
            return emitter;
        }

        // 异步执行，不阻塞 Servlet 线程
        new Thread(() -> {
            try {
                // 1. 保存用户消息
                saveMessage(userId, sessionId, "user", message);

                // 2. 流式调用 AI，每个 chunk 推给前端
                StringBuilder fullReply = new StringBuilder();
                String reply = aiService.chatStream(userId, sessionId, message, chunk -> {
                    try {
                        emitter.send(SseEmitter.event().data(chunk));
                        fullReply.append(chunk);
                    } catch (Exception e) {
                        log.debug("[SSE] 推送失败: {}", e.getMessage());
                    }
                });

                // 3. 保存完整 AI 回复（优先用 reply 返回值，其次用累积的 fullReply）
                String toSave = StrUtil.isNotEmpty(reply) ? reply : fullReply.toString();
                if (StrUtil.isNotEmpty(toSave)) {
                    saveMessage(userId, sessionId, "ai", toSave);
                }

                // 4. 发送结束标记 + 完成
                emitter.send(SseEmitter.event().data("[DONE]"));
                emitter.complete();

            } catch (Exception e) {
                log.error("[SSE] 流式聊天异常", e);
                emitter.completeWithError(e);
            }
        }).start();

        return emitter;
    }

    // ================================================================
    //  辅助方法
    // ================================================================

    private void saveMessage(Long userId, String sessionId, String role, String content) {
        ChatMessage msg = new ChatMessage();
        msg.setUserId(userId);
        msg.setSessionId(sessionId);
        msg.setRole(role);
        msg.setContent(content);
        chatMessageMapper.insert(msg);
    }

    /** 简单封装 StrUtil.isNotEmpty，避免在 Controller 里再 import */
    private static class StrUtil {
        static boolean isNotEmpty(String s) {
            return s != null && !s.trim().isEmpty();
        }
    }
}
