package service

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"study-roadmap/backend/internal/model"
)

const roadmapCacheKey = "roadmaps:all"

type RoadmapDTO struct {
	ID          uint     `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Level       string   `json:"level"`
	Duration    string   `json:"duration"`
	LessonCount int      `json:"lessonCount"`
	Tags        []string `json:"tags"`
}

type RoadmapService struct {
	db    *gorm.DB
	redis *redis.Client
}

func NewRoadmapService(db *gorm.DB, redis *redis.Client) *RoadmapService {
	return &RoadmapService{db: db, redis: redis}
}

func (s *RoadmapService) Bootstrap(ctx context.Context) error {
	if err := s.db.AutoMigrate(&model.Roadmap{}); err != nil {
		return err
	}

	var count int64
	if err := s.db.Model(&model.Roadmap{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	seedData := []model.Roadmap{
		{
			Title:       "前端基础路线",
			Description: "从 HTML、CSS、JavaScript 进入 React 工程化开发，适合想先搭建界面的同学。",
			Level:       "Beginner",
			Duration:    "4 周",
			LessonCount: 18,
			TagsCSV:     "HTML,CSS,JavaScript,React",
			Sort:        1,
		},
		{
			Title:       "Go Web 后端路线",
			Description: "掌握 Gin 路由设计、GORM 数据访问、缓存与接口组织方式。",
			Level:       "Intermediate",
			Duration:    "5 周",
			LessonCount: 22,
			TagsCSV:     "Go,Gin,GORM,RESTful API",
			Sort:        2,
		},
		{
			Title:       "数据库与缓存路线",
			Description: "理解 MySQL 表结构设计、索引优化与 Redis 缓存策略。",
			Level:       "Intermediate",
			Duration:    "3 周",
			LessonCount: 14,
			TagsCSV:     "MySQL,Redis,Index,Cache",
			Sort:        3,
		},
		{
			Title:       "部署上线路线",
			Description: "使用 Docker Compose、Nginx 和基础健康检查完成本地部署。",
			Level:       "Beginner",
			Duration:    "2 周",
			LessonCount: 10,
			TagsCSV:     "Docker Compose,Nginx,CI/CD,DevOps",
			Sort:        4,
		},
	}

	return s.db.WithContext(ctx).Create(&seedData).Error
}

func (s *RoadmapService) ListRoadmaps(ctx context.Context) ([]RoadmapDTO, error) {
	if cached, err := s.redis.Get(ctx, roadmapCacheKey).Result(); err == nil {
		var items []RoadmapDTO
		if json.Unmarshal([]byte(cached), &items) == nil {
			return items, nil
		}
	} else if err != redis.Nil {
		return nil, err
	}

	var entities []model.Roadmap
	if err := s.db.WithContext(ctx).Order("sort asc, id asc").Find(&entities).Error; err != nil {
		return nil, err
	}

	items := make([]RoadmapDTO, 0, len(entities))
	for _, entity := range entities {
		items = append(items, RoadmapDTO{
			ID:          entity.ID,
			Title:       entity.Title,
			Description: entity.Description,
			Level:       entity.Level,
			Duration:    entity.Duration,
			LessonCount: entity.LessonCount,
			Tags:        entity.Tags(),
		})
	}

	if payload, err := json.Marshal(items); err == nil {
		_ = s.redis.Set(ctx, roadmapCacheKey, payload, 10*time.Minute).Err()
	}

	return items, nil
}
