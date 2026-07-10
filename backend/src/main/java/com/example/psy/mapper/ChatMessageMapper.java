package com.example.psy.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.psy.entity.ChatMessage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface ChatMessageMapper extends BaseMapper<ChatMessage> {

    /**
     * 查询某用户的会话列表（按最后活跃时间倒序）
     * 返回每个会话的：session_id、首条消息作为标题、消息数、最后消息时间
     */
    @Select("SELECT session_id, " +
            "MIN(content) AS title, " +
            "COUNT(*) AS msg_count, " +
            "MAX(create_time) AS last_time " +
            "FROM chat_message " +
            "WHERE user_id = #{userId} AND session_id IS NOT NULL " +
            "GROUP BY session_id " +
            "ORDER BY MAX(id) DESC")
    List<Map<String, Object>> selectSessionList(@Param("userId") Long userId);
}
