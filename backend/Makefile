# micro_ai\Makefile

setup-env:
	@[ ! -f ./.env ] && cp ./.env.example ./.env || echo ".env file already exists."

start: ## Start the docker containers
	@echo "Starting the docker containers"
	@docker compose up
	@echo "Containers started - http://localhost:8000"

start-prod: ## Start the docker containers
	@echo "Starting the docker containers"
	@docker compose -f docker-compose.prod.yml up -d
	@echo "Containers started - http://localhost:8000"

debug: ## Start the docker containers in debug mode
	@echo "Starting docker containers in debug mode..."
	@docker compose -f docker-compose-debug.yml up -d
	@echo "Running migrations..."
	@docker compose -f docker-compose-debug.yml run --rm --no-deps web ./wait-for-db.sh db:5432 -- python manage.py migrate
	@echo "Starting the Django server..."
	@echo "In VSCode, go to Run and Debug and choose 'Python: Remote Attach'"

stop: ## Stop Containers
	@docker compose down

restart: stop start ## Restart Containers

start-bg:  ## Run containers in the background
	@docker compose up -d

start-bg-prod:  ## Run containers in the background
	@docker compose -f docker-compose.prod.yml up -d

build: ## Build Containers
	@docker compose build

ssh: ## SSH into running web container
	docker compose exec web bash

bash: ## Get a bash shell into the web container
	docker compose run --rm --no-deps web bash

migrations: ## Create DB migrations in the container
	@docker compose run --rm --no-deps web python manage.py makemigrations

migrate: ## Run DB migrations in the container
	@docker compose run --rm --no-deps web python manage.py migrate

shell: ## Get a Django shell
	@docker compose run --rm --no-deps web python manage.py shell

dbshell: ## Get a Database shell
	@docker compose exec db psql -U postgres micro_ai

test: ## Run Django tests
	@docker compose run --rm --no-deps web python manage.py test

init: setup-env start-bg migrations migrate  ## Quickly get up and running (start containers and migrate DB)

init-prod: setup-env  ## Quickly get up and running (start containers and migrate DB)

pip-compile: ## Compiles your requirements.in file to requirements.txt
	@docker compose run --rm --no-deps web pip-compile requirements/requirements.in
	@docker compose run --rm --no-deps web pip-compile requirements/dev-requirements.in
	@docker compose run --rm --no-deps web pip-compile requirements/prod-requirements.in

requirements: pip-compile build restart  ## Rebuild your requirements and restart your containers

black: ## Runs black on the codebase
	@docker compose run --rm --no-deps web black --extend-exclude migrations --line-length 120 .

isort: ## Runs isort on the codebase
	@docker compose run --rm --no-deps web isort -l 120 --profile black .

format: black isort ## Runs formatting (black and isort) on the codebase

upgrade: pip-compile build start-bg migrations migrate

.PHONY: help
.DEFAULT_GOAL := help

help:
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
