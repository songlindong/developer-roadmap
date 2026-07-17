package config

import (
	"os"
)

type Config struct {
	AppEnv      string
	ServerPort  string
	MySQLDSN    string
	AccessToken string
	AdminToken  string
}

func Load() Config {
	return Config{
		AppEnv:      getEnv("APP_ENV", "development"),
		ServerPort:  getEnv("SERVER_PORT", "8080"),
		MySQLDSN:    getEnv("MYSQL_DSN", "root:root123@tcp(127.0.0.1:3306)/study_platform?charset=utf8mb4&parseTime=True&loc=Local"),
		AccessToken: getEnv("ACCESS_TOKEN", "123456"),
		AdminToken:  getEnv("ADMIN_TOKEN", "828512"),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
