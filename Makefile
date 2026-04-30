.PHONY: help deploy-prod deploy-local local-stop local-logs local-shell-fe local-shell-be clean

help:
	@echo "AI Assistant Shopify Project — Available Commands"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy-prod       Start production stack (docker-compose.yml)"
	@echo "  make deploy-local      Start local debug stack (docker-compose.debug.yml)"
	@echo "  make deploy-local FULL=1  Full reset: wipe containers, reinstall deps, rebuild"
	@echo ""
	@echo "Local Development:"
	@echo "  make local-stop        Stop local containers"
	@echo "  make local-logs        Tail logs from local containers"
	@echo "  make local-shell-fe    SSH into running frontend container"
	@echo "  make local-shell-be    SSH into running backend container"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean             Remove all containers and volumes"

deploy-prod:
	docker-compose up -d

deploy-local:
ifdef FULL
	@echo "Full reset: stopping containers, removing volumes, rebuilding..."
	docker-compose -f docker-compose.debug.yml down -v
	docker-compose -f docker-compose.debug.yml build --no-cache
	docker-compose -f docker-compose.debug.yml up -d
else
	docker-compose -f docker-compose.debug.yml up -d
endif

local-stop:
	docker-compose -f docker-compose.debug.yml down

local-logs:
	docker-compose -f docker-compose.debug.yml logs -f

local-shell-fe:
	docker-compose -f docker-compose.debug.yml exec app sh -c "cd /app/frontend && sh"

local-shell-be:
	docker-compose -f docker-compose.debug.yml exec app sh -c "cd /app/backend && sh"

clean:
	docker-compose down -v
	docker-compose -f docker-compose.debug.yml down -v
