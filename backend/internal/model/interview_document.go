package model

import "time"

type InterviewDocument struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Title     string    `json:"title" gorm:"size:160;not null"`
	Content   string    `json:"content" gorm:"type:longtext;not null"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (InterviewDocument) TableName() string {
	return "interview_documents"
}
