package router

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"study-roadmap/backend/internal/config"
	"study-roadmap/backend/internal/handler"
)

func New(cfg config.Config, documentHandler *handler.DocumentHandler) *gin.Engine {
	r := gin.Default()
	r.Static("/uploads", "./uploads")
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://127.0.0.1:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Admin-Token"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "welcome to study roadmap backend",
			"env":     cfg.AppEnv,
		})
	})

	api := r.Group("/api")
	{
		api.GET("/health", documentHandler.Health)
		api.GET("/admin/status", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"data": gin.H{
					"authenticated": isAdminRequest(c, cfg),
					"configured":    isAdminProtectionEnabled(cfg),
				},
			})
		})
		api.GET("/documents", documentHandler.ListDocuments)
		api.GET("/documents/:id", documentHandler.GetDocument)
		admin := api.Group("")
		admin.Use(requireAdmin(cfg))
		admin.POST("/upload/image", documentHandler.UploadImage)
		admin.POST("/documents", documentHandler.CreateDocument)
		admin.PUT("/documents/:id", documentHandler.UpdateDocument)
		admin.DELETE("/documents/:id", documentHandler.DeleteDocument)
	}

	return r
}

func requireAdmin(cfg config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !isAdminRequest(c, cfg) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "仅管理员可执行该操作"})
			return
		}
		c.Next()
	}
}

func isAdminRequest(c *gin.Context, cfg config.Config) bool {
	if !isAdminProtectionEnabled(cfg) {
		return true
	}

	token := strings.TrimSpace(c.GetHeader("X-Admin-Token"))
	return token != "" && token == strings.TrimSpace(cfg.AdminToken)
}

func isAdminProtectionEnabled(cfg config.Config) bool {
	return cfg.AppEnv == "production" || strings.TrimSpace(cfg.AdminToken) != ""
}
