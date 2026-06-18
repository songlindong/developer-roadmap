package config

import (
	"os"
	"strconv"
)

type Config struct {
	AppEnv        string
	ServerPort    string
	MySQLDSN      string
	RedisAddr     string
	RedisPassword string
	RedisDB       int
}

func Load() Config {
	redisDB, err := strconv.Atoi(getEnv("REDIS_DB", "0"))
	if err != nil {
		redisDB = 0
	}

	return Config{
		AppEnv:        getEnv("APP_ENV", "development"),
		ServerPort:    getEnv("SERVER_PORT", "8080"),
		MySQLDSN:      getEnv("MYSQL_DSN", "root:root123@tcp(127.0.0.1:3306)/study_platform?charset=utf8mb4&parseTime=True&loc=Local"),
		RedisAddr:     getEnv("REDIS_ADDR", "127.0.0.1:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       redisDB,
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
