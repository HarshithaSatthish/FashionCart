.PHONY: up up-dev down logs seed test clean
up:
	docker compose up --build -d
up-dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
down:
	docker compose down
logs:
	docker compose logs -f --tail=200
seed:
	docker compose --profile tools run --rm seed
test:
	cd backend && python -m pytest -q
clean:
	docker compose down -v --remove-orphans
