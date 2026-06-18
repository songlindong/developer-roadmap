package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"study-roadmap/backend/internal/service"
)

type RoadmapHandler struct {
	service *service.RoadmapService
	db      *gorm.DB
	redis   *redis.Client
}

func NewRoadmapHandler(service *service.RoadmapService, db *gorm.DB, redis *redis.Client) *RoadmapHandler {
	return &RoadmapHandler{service: service, db: db, redis: redis}
}

func (h *RoadmapHandler) Health(c *gin.Context) {
	mysqlStatus := "up"
	redisStatus := "up"

	sqlDB, err := h.db.DB()
	if err != nil || sqlDB.Ping() != nil {
		mysqlStatus = "down"
	}

	if err := h.redis.Ping(c.Request.Context()).Err(); err != nil {
		redisStatus = "down"
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "study roadmap api is running",
		"services": gin.H{
			"api":   "up",
			"mysql": mysqlStatus,
			"redis": redisStatus,
		},
	})
}

func (h *RoadmapHandler) ListRoadmaps(c *gin.Context) {
	items, err := h.service.ListRoadmaps(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "获取学习路线失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": items,
	})
}
