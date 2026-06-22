package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"study-roadmap/backend/internal/service"
)

type DocumentHandler struct {
	service *service.DocumentService
	db      *gorm.DB
}

func NewDocumentHandler(service *service.DocumentService, db *gorm.DB) *DocumentHandler {
	return &DocumentHandler{service: service, db: db}
}

func (h *DocumentHandler) Health(c *gin.Context) {
	mysqlStatus := "up"

	sqlDB, err := h.db.DB()
	if err != nil || sqlDB.Ping() != nil {
		mysqlStatus = "down"
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "llm interview api is running",
		"services": gin.H{
			"api":   "up",
			"mysql": mysqlStatus,
		},
	})
}

func (h *DocumentHandler) ListDocuments(c *gin.Context) {
	items, err := h.service.ListDocuments(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取文档列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *DocumentHandler) GetDocument(c *gin.Context) {
	id, ok := parseIDParam(c)
	if !ok {
		return
	}

	item, err := h.service.GetDocument(c.Request.Context(), id)
	if err != nil {
		respondServiceError(c, err, "获取文档失败")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *DocumentHandler) CreateDocument(c *gin.Context) {
	var input service.SaveDocumentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请求参数不正确"})
		return
	}

	item, err := h.service.CreateDocument(c.Request.Context(), input)
	if err != nil {
		respondServiceError(c, err, "创建文档失败")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": item})
}

func (h *DocumentHandler) UpdateDocument(c *gin.Context) {
	id, ok := parseIDParam(c)
	if !ok {
		return
	}

	var input service.SaveDocumentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请求参数不正确"})
		return
	}

	item, err := h.service.UpdateDocument(c.Request.Context(), id, input)
	if err != nil {
		respondServiceError(c, err, "更新文档失败")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *DocumentHandler) DeleteDocument(c *gin.Context) {
	id, ok := parseIDParam(c)
	if !ok {
		return
	}

	if err := h.service.DeleteDocument(c.Request.Context(), id); err != nil {
		respondServiceError(c, err, "删除文档失败")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "文档已删除"})
}

func parseIDParam(c *gin.Context) (uint, bool) {
	rawID := c.Param("id")
	id, err := strconv.ParseUint(rawID, 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "无效的文档 ID"})
		return 0, false
	}

	return uint(id), true
}

func respondServiceError(c *gin.Context, err error, fallback string) {
	switch {
	case err == gorm.ErrRecordNotFound:
		c.JSON(http.StatusNotFound, gin.H{"message": "文档不存在"})
	default:
		c.JSON(http.StatusBadRequest, gin.H{"message": safeMessage(err, fallback)})
	}
}

func safeMessage(err error, fallback string) string {
	if err == nil {
		return fallback
	}
	if err.Error() == "" {
		return fallback
	}
	return err.Error()
}
