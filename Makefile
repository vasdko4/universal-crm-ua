# ─────────────────────────────────────────────────────────────────────
# Techno Store — управление через Docker
#
# Использование:
#   make start       — запустить магазин (первый раз + последующие)
#   make stop        — остановить
#   make restart     — перезапустить
#   make logs        — показать логи
#   make backup      — бэкап базы данных
#   make restore     — восстановить базу из бэкапа
#   make clean       — удалить всё (контейнеры + данные)
# ─────────────────────────────────────────────────────────────────────

.PHONY: start stop restart logs status backup restore clean rebuild help

help: ## Показать справку
	@echo ""
	@echo "  Techno Store — доступные команды:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""

start: ## Запустить магазин
	@bash start.sh

stop: ## Остановить магазин
	docker compose down

restart: ## Перезапустить магазин
	docker compose restart app

logs: ## Показать логи (Ctrl+C для выхода)
	docker compose logs -f app

status: ## Показать статус контейнеров
	docker compose ps

backup: ## Сделать бэкап базы данных
	@mkdir -p backups
	@BACKUP_FILE="backups/db-backup-$$(date +%Y%m%d-%H%M%S).sql"; \
	docker compose exec -T db pg_dump -U techno techno_store > "$$BACKUP_FILE" && \
	echo "✓ Бэкап сохранён: $$BACKUP_FILE"

restore: ## Восстановить БД из последнего бэкапа
	@LATEST=$$(ls -t backups/*.sql 2>/dev/null | head -1); \
	if [ -z "$$LATEST" ]; then \
		echo "✗ Бэкапы не найдены в папке backups/"; \
		exit 1; \
	fi; \
	echo "Восстановление из: $$LATEST"; \
	docker compose exec -T db psql -U techno -d techno_store < "$$LATEST" && \
	echo "✓ База восстановлена"

rebuild: ## Пересобрать и перезапустить
	docker compose up -d --build

clean: ## Удалить всё (контейнеры + данные БД!)
	@echo "⚠ Это удалит все данные магазина (товары, заказы, клиенты)!"
	@read -p "  Продолжить? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	docker compose down -v
	@echo "✓ Всё удалено"
