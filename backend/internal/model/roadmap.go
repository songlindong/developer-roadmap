package model

import "strings"

type Roadmap struct {
	ID          uint   `json:"id" gorm:"primaryKey"`
	Title       string `json:"title" gorm:"size:120;not null"`
	Description string `json:"description" gorm:"type:text;not null"`
	Level       string `json:"level" gorm:"size:32;not null"`
	Duration    string `json:"duration" gorm:"size:32;not null"`
	LessonCount int    `json:"lessonCount" gorm:"not null;default:0"`
	TagsCSV     string `json:"-" gorm:"column:tags;size:255;not null"`
	Sort        int    `json:"sort" gorm:"not null;default:0"`
}

func (Roadmap) TableName() string {
	return "roadmaps"
}

func (r Roadmap) Tags() []string {
	if r.TagsCSV == "" {
		return []string{}
	}

	parts := strings.Split(r.TagsCSV, ",")
	tags := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			tags = append(tags, trimmed)
		}
	}

	return tags
}
