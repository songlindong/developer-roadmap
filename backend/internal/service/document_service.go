package service

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"

	"study-roadmap/backend/internal/model"
)

type DocumentSummary struct {
	ID       uint   `json:"id"`
	Title    string `json:"title"`
	Category string `json:"category"`
}

type DocumentDetail struct {
	ID        uint   `json:"id"`
	Title     string `json:"title"`
	Category  string `json:"category"`
	Content   string `json:"content"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type SaveDocumentInput struct {
	Title    string `json:"title"`
	Category string `json:"category"`
	Content  string `json:"content"`
}

type DocumentService struct {
	db *gorm.DB
}

func NewDocumentService(db *gorm.DB) *DocumentService {
	return &DocumentService{db: db}
}

func (s *DocumentService) Bootstrap(ctx context.Context) error {
	return s.db.WithContext(ctx).AutoMigrate(&model.InterviewDocument{})
}

func (s *DocumentService) ListDocuments(ctx context.Context) ([]DocumentSummary, error) {
	var entities []model.InterviewDocument
	if err := s.db.WithContext(ctx).Order("updated_at desc, id desc").Find(&entities).Error; err != nil {
		return nil, err
	}

	items := make([]DocumentSummary, 0, len(entities))
	for _, entity := range entities {
		items = append(items, DocumentSummary{
			ID:       entity.ID,
			Title:    entity.Title,
			Category: entity.Category,
		})
	}

	return items, nil
}

func (s *DocumentService) GetDocument(ctx context.Context, id uint) (DocumentDetail, error) {
	var entity model.InterviewDocument
	if err := s.db.WithContext(ctx).First(&entity, id).Error; err != nil {
		return DocumentDetail{}, err
	}

	return DocumentDetail{
		ID:        entity.ID,
		Title:     entity.Title,
		Category:  entity.Category,
		Content:   entity.Content,
		CreatedAt: entity.CreatedAt.Format("2006-01-02 15:04"),
		UpdatedAt: entity.UpdatedAt.Format("2006-01-02 15:04"),
	}, nil
}

func (s *DocumentService) CreateDocument(ctx context.Context, input SaveDocumentInput) (DocumentDetail, error) {
	entity, err := normalizeDocumentInput(input)
	if err != nil {
		return DocumentDetail{}, err
	}

	if err := s.db.WithContext(ctx).Create(&entity).Error; err != nil {
		return DocumentDetail{}, err
	}

	return s.GetDocument(ctx, entity.ID)
}

func (s *DocumentService) UpdateDocument(ctx context.Context, id uint, input SaveDocumentInput) (DocumentDetail, error) {
	entity, err := normalizeDocumentInput(input)
	if err != nil {
		return DocumentDetail{}, err
	}

	updates := map[string]any{
		"title":    entity.Title,
		"category": entity.Category,
		"content":  entity.Content,
	}

	result := s.db.WithContext(ctx).Model(&model.InterviewDocument{}).Where("id = ?", id).Updates(updates)
	if result.Error != nil {
		return DocumentDetail{}, result.Error
	}
	if result.RowsAffected == 0 {
		return DocumentDetail{}, gorm.ErrRecordNotFound
	}

	return s.GetDocument(ctx, id)
}

func (s *DocumentService) DeleteDocument(ctx context.Context, id uint) error {
	result := s.db.WithContext(ctx).Delete(&model.InterviewDocument{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}

	return nil
}

func normalizeDocumentInput(input SaveDocumentInput) (model.InterviewDocument, error) {
	title := strings.TrimSpace(input.Title)
	category := strings.TrimSpace(input.Category)
	content := strings.TrimSpace(input.Content)

	if title == "" {
		return model.InterviewDocument{}, errors.New("标题不能为空")
	}
	if category == "" {
		category = "未分类"
	}
	if content == "" {
		return model.InterviewDocument{}, errors.New("内容不能为空")
	}

	return model.InterviewDocument{
		Title:    title,
		Category: category,
		Content:  content,
	}, nil
}
