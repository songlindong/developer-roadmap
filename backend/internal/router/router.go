package router

import (
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"study-roadmap/backend/internal/config"
	"study-roadmap/backend/internal/handler"
)

func New(cfg config.Config, documentHandler *handler.DocumentHandler) *gin.Engine {
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://127.0.0.1:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
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
		api.GET("/documents", documentHandler.ListDocuments)
		api.GET("/documents/:id", documentHandler.GetDocument)
		api.POST("/documents", documentHandler.CreateDocument)
		api.PUT("/documents/:id", documentHandler.UpdateDocument)
		api.DELETE("/documents/:id", documentHandler.DeleteDocument)
	}

	return r
}
