package com.example.psy.service;

import cn.hutool.core.util.StrUtil;
import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.psy.entity.ChatMessage;
import com.example.psy.mapper.ChatMessageMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.function.Consumer;

/**
 * 大模型对话服务：对接通义千问（Qwen）OpenAI 兼容模式
 *
 * 三大能力：
 * 1. 多轮上下文记忆 —— 每次调用前从 DB 取最近 N 条历史
 * 2. 危机干预     —— 检测自伤/自杀关键词，强制返回干预文案，不依赖 AI
 * 3. 流式输出     —— chatStream 方法支持 SSE 逐字返回
 */
@Slf4j
@Service
public class AiService {

    @Autowired
    private ChatMessageMapper chatMessageMapper;

    @Value("${ai.qwen.api-key:}")
    private String apiKey;

    @Value("${ai.qwen.base-url}")
    private String baseUrl;

    @Value("${ai.qwen.model}")
    private String model;

    @Value("${ai.qwen.system-prompt}")
    private String systemPrompt;

    private static final int HISTORY_LIMIT = 10;

    // ===== 危机关键词 & 干预文案 =====
    private static final List<String> CRISIS_KEYWORDS = Arrays.asList(
            "自杀", "不想活", "想死", "自残", "跳楼", "结束生命",
            "活不下去", "了结自己", "轻生", "寻死", "活着没意义", "不想活了"
    );

    private static final String CRISIS_RESPONSE =
            "我听到你现在的痛苦，你的生命对我来说很重要。" +
            "请立刻拨打 24 小时心理援助热线 400-161-9995，" +
            "有人在电话那头等你，他们能帮到你。" +
            "你现在不是一个人，我们都在这里陪你。";

    // ================================================================
    //  危机检测（公开方法，Controller 也可调用）
    // ================================================================

    /**
     * 检测用户消息是否命中危机关键词
     * @return 命中则返回干预文案；未命中返回 null
     */
    public String checkCrisis(String userMessage) {
        if (StrUtil.isEmpty(userMessage)) return null;
        for (String keyword : CRISIS_KEYWORDS) {
            if (userMessage.contains(keyword)) {
                log.warn("[AI] 命中危机关键词: {}，返回危机干预文案，不调用大模型", keyword);
                return CRISIS_RESPONSE;
            }
        }
        return null;
    }

    // ================================================================
    //  非流式调用
    // ================================================================

    public String chat(Long userId, String sessionId, String userMessage) {
        if (StrUtil.isEmpty(userMessage)) {
            return "我在听，请继续说。";
        }

        // 1. 危机检测优先
        String crisis = checkCrisis(userMessage);
        if (crisis != null) return crisis;

        // 2. API Key 检查
        if (StrUtil.isEmpty(apiKey)) {
            log.warn("[AI] 未配置 api-key，返回兜底回复");
            return "（AI 服务未配置，请联系管理员设置 API Key）";
        }

        // 3. 构造 messages（含历史上下文）
        JSONArray messages = buildMessages(userId, sessionId, userMessage);
        JSONObject payload = new JSONObject();
        payload.set("model", model);
        payload.set("messages", messages);

        String requestUrl = baseUrl + "/chat/completions";
        String requestBody = payload.toString();

        // 4. HTTP 调用
        try (HttpResponse response = HttpRequest.post(requestUrl)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .body(requestBody)
                .timeout(30000)
                .execute()) {

            String respBody = response.body();
            int status = response.getStatus();

            if (status == 200) {
                JSONObject respJson = JSONUtil.parseObj(respBody);
                String content = respJson.getByPath("choices[0].message.content", String.class);
                if (StrUtil.isEmpty(content)) {
                    log.warn("[AI] 模型返回空内容，原始响应：{}", respBody);
                    return "（AI 暂时没有给出回复，请稍后再试）";
                }
                log.info("[AI] 调用成功 model={} 回复长度={}", model, content.length());
                return content;
            }

            log.error("[AI] 调用失败 HTTP {} 响应体={}", status, respBody);
            return "（AI 服务返回错误 " + status + "）";

        } catch (Exception e) {
            log.error("[AI] 调用异常", e);
            return "（AI 服务调用异常：" + e.getMessage() + "）";
        }
    }

    // ================================================================
    //  流式调用（SSE）
    // ================================================================

    /**
     * 流式调用大模型，每收到一个文本片段就通过 onChunk 回调推送
     *
     * @param userId      用户 ID
     * @param sessionId   会话 ID
     * @param userMessage 用户消息
     * @param onChunk     每个文本片段的回调
     * @return 完整的 AI 回复文本（用于入库）
     */
    public String chatStream(Long userId, String sessionId, String userMessage, Consumer<String> onChunk) {
        if (StrUtil.isEmpty(userMessage)) {
            onChunk.accept("我在听，请继续说。");
            return "我在听，请继续说。";
        }

        // 1. 危机检测优先
        String crisis = checkCrisis(userMessage);
        if (crisis != null) {
            onChunk.accept(crisis);
            return crisis;
        }

        // 2. API Key 检查
        if (StrUtil.isEmpty(apiKey)) {
            log.warn("[AI] 未配置 api-key，返回兜底回复");
            String fallback = "（AI 服务未配置）";
            onChunk.accept(fallback);
            return fallback;
        }

        // 3. 构造请求（加 stream: true）
        JSONArray messages = buildMessages(userId, sessionId, userMessage);
        JSONObject payload = new JSONObject();
        payload.set("model", model);
        payload.set("messages", messages);
        payload.set("stream", true);  // 开启流式

        String requestUrl = baseUrl + "/chat/completions";
        String requestBody = payload.toString();

        // 4. 流式 HTTP 调用
        StringBuilder fullReply = new StringBuilder();
        try (HttpResponse response = HttpRequest.post(requestUrl)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .body(requestBody)
                .timeout(60000)
                .executeAsync()) {  // executeAsync 不预读 body，支持流式

            int status = response.getStatus();
            if (status != 200) {
                String errBody = response.body();
                log.error("[AI] 流式调用失败 HTTP {} 响应体={}", status, errBody);
                String errMsg = "（AI 服务返回错误 " + status + "）";
                onChunk.accept(errMsg);
                return errMsg;
            }

            // 5. 逐行读取 SSE 流
            try (InputStream is = response.bodyStream();
                 BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!line.startsWith("data:")) continue;
                    String data = line.substring(5).trim();
                    if ("[DONE]".equals(data)) break;

                    try {
                        JSONObject chunk = JSONUtil.parseObj(data);
                        String content = chunk.getByPath("choices[0].delta.content", String.class);
                        if (StrUtil.isNotEmpty(content)) {
                            fullReply.append(content);
                            onChunk.accept(content);
                        }
                    } catch (Exception parseEx) {
                        log.debug("[AI] 跳过无法解析的 SSE 行: {}", data);
                    }
                }
            }

        } catch (Exception e) {
            log.error("[AI] 流式调用异常", e);
            if (fullReply.length() == 0) {
                String errMsg = "（AI 服务调用异常：" + e.getMessage() + "）";
                onChunk.accept(errMsg);
                return errMsg;
            }
        }

        log.info("[AI] 流式调用完成 model={} 回复长度={}", model, fullReply.length());
        return fullReply.toString();
    }

    // ================================================================
    //  辅助方法
    // ================================================================

    /**
     * 构造 OpenAI 兼容的 messages 数组（system + 历史 + 当前消息）
     */
    private JSONArray buildMessages(Long userId, String sessionId, String userMessage) {
        List<ChatMessage> history = getHistory(userId, sessionId);
        log.info("[AI] 用户={} 会话={} 历史条数={}", userId, sessionId, history.size());

        JSONArray messages = new JSONArray();
        messages.set(new JSONObject().set("role", "system").set("content", systemPrompt));

        for (ChatMessage msg : history) {
            String role = "user".equals(msg.getRole()) ? "user" : "assistant";
            messages.set(new JSONObject().set("role", role).set("content", msg.getContent()));
        }

        messages.set(new JSONObject().set("role", "user").set("content", userMessage));
        return messages;
    }

    /**
     * 查询指定会话的历史消息，按时间正序返回
     */
    private List<ChatMessage> getHistory(Long userId, String sessionId) {
        if (userId == null) return Collections.emptyList();

        LambdaQueryWrapper<ChatMessage> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ChatMessage::getUserId, userId);

        // session_id 有值时按会话过滤；无值时查全部（兼容旧数据）
        if (StrUtil.isNotEmpty(sessionId)) {
            wrapper.eq(ChatMessage::getSessionId, sessionId);
        }

        wrapper.orderByDesc(ChatMessage::getId)
                .last("LIMIT " + HISTORY_LIMIT);
        List<ChatMessage> list = chatMessageMapper.selectList(wrapper);
        Collections.reverse(list);
        return list;
    }
}
