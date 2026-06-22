FROM golang:1.25.1-alpine AS builder
ENV GOPROXY=https://goproxy.cn,direct
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o server ./cmd/server

FROM alpine:3.22
WORKDIR /app
COPY --from=builder /app/server ./server
EXPOSE 8080
CMD ["./server"]
