package service

import "testing"

func TestNormalizeDocumentInput(t *testing.T) {
	t.Parallel()

	entity, err := normalizeDocumentInput(SaveDocumentInput{
		Title:   "  Harness  ",
		Content: "  verified  ",
	})
	if err != nil {
		t.Fatalf("normalizeDocumentInput() error = %v", err)
	}
	if entity.Title != "Harness" || entity.Content != "verified" {
		t.Fatalf("unexpected normalized entity: %#v", entity)
	}
	if entity.Category != "未分类" {
		t.Fatalf("Category = %q, want 未分类", entity.Category)
	}
}

func TestNormalizeDocumentInputRejectsRequiredFields(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input SaveDocumentInput
	}{
		{name: "title", input: SaveDocumentInput{Content: "content"}},
		{name: "content", input: SaveDocumentInput{Title: "title"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if _, err := normalizeDocumentInput(tt.input); err == nil {
				t.Fatal("normalizeDocumentInput() error = nil, want validation error")
			}
		})
	}
}
