package com.example.psy;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.example.psy.mapper")
public class PsychologicalCounselingApplication {

    public static void main(String[] args) {
        SpringApplication.run(PsychologicalCounselingApplication.class, args);
    }
}
