package main

import (
	"context"
	"log"

	"github.com/gin-gonic/gin"

	"study-roadmap/backend/internal/config"
	"study-roadmap/backend/internal/database"
	"study-roadmap/backend/internal/handler"
	"study-roadmap/backend/internal/router"
	"study-roadmap/backend/internal/service"
)

func main() {
	cfg := config.Load()
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	db, err := database.NewMySQL(cfg.MySQLDSN)
	if err != nil {
		log.Fatalf("connect mysql failed: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("get sql db failed: %v", err)
	}
	defer sqlDB.Close()

	documentService := service.NewDocumentService(db)
	if err := documentService.Bootstrap(context.Background()); err != nil {
		log.Fatalf("bootstrap data failed: %v", err)
	}

	handlerSet := handler.NewDocumentHandler(documentService, db)
	r := router.New(cfg, handlerSet)

	log.Printf("server listening on :%s", cfg.ServerPort)
	if err := r.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("start server failed: %v", err)
	}
}
