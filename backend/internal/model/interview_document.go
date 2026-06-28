package model

import "time"

type InterviewDocument struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Title     string    `json:"title" gorm:"size:160;not null"`
	Category  string    `json:"category" gorm:"size:80;not null;default:'未分类'"`
	Content   string    `json:"content" gorm:"type:longtext;not null"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (InterviewDocument) TableName() string {
	return "interview_documents"
}
