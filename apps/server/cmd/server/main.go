package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/config"
	"github.com/Mournerliao/watermark-remover/apps/server/internal/server"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := config.Load()
	if err != nil {
		logger.Error("invalid configuration", "error", err)
		os.Exit(1)
	}
	app := server.New(cfg, logger)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	shutdown := make(chan struct{})
	go func() {
		<-ctx.Done()
		grace, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := app.Shutdown(grace); err != nil {
			_ = app.Close()
		}
		close(shutdown)
	}()
	logger.Info("server listening", "address", cfg.Address)
	if err := app.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("server failed", "error", err)
		os.Exit(1)
	}
	<-shutdown
}
