include custom.mk

setup-env:
	@[ ! -f ./.env ] && cp ./.env.example ./.env || echo ".env file already exists."

start: ## Start the docker containers
	@echo "Starting the docker containers"
	@docker compose up
	@echo "Containers started - http://localhost:8000"

#TODO: doesn't work correctly. Stops with Error 143. Need to review. Seems it could't stop Django server
start-debug: ## Start the docker containers in debug mode
	@echo "Stopping any running containers..."
	@docker compose down
	@echo "Starting the docker containers in debug mode"
	@docker compose up --build -d
	@echo "Waiting for web container to be ready..."
	@docker compose exec web /bin/bash -c 'until curl -s -o /dev/null -f http://localhost:8000; do sleep 1; done'
	@echo "Stopping any running instances of Django server..."
	@docker compose exec web /bin/bash -c 'pid=$$(pgrep -f "manage.py runserver"); if [ -n "$$pid" ]; then echo "Stopping existing Django server..."; kill $$pid; else echo "No running server found."; fi'
	@echo "Starting Django server in debug mode..."
	@docker compose exec web python -Xfrozen_modules=off -m debugpy --wait-for-client --listen 0.0.0.0:5678 manage.py runserver 0.0.0.0:8000 --nothreading
	@echo "In VSCode go to Run and Debug and choose 'Python: Remote Attach'"

stop: ## Stop Containers
	@docker compose down

restart: stop start ## Restart Containers

start-bg:  ## Run containers in the background
	@docker compose up -d

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

npm-install: ## Runs npm install in the container
	@docker compose run --rm --no-deps web npm install $(filter-out $@,$(MAKECMDGOALS))

npm-uninstall: ## Runs npm uninstall in the container
	@docker compose run --rm --no-deps web npm uninstall $(filter-out $@,$(MAKECMDGOALS))

npm-build: ## Runs npm build in the container (for production assets)
	@docker compose run --rm --no-deps web npm run build

npm-dev: ## Runs npm dev in the container
	@docker compose run --rm --no-deps web npm run dev

npm-watch: ## Runs npm watch in the container (recommended for dev)
	@docker compose run --rm --no-deps web npm run dev-watch

npm-type-check: ## Runs the type checker on the front end TypeScript code
	@docker compose run --rm --no-deps web npm run type-check

build-api-client:  ## Update the JavaScript API client code.
	@docker run --rm --network host -v ${PWD}/api-client:/local openapitools/openapi-generator-cli:v7.5.0 generate \
	-i http://localhost:8000/api/schema/ \
	-g typescript-fetch \
	-o /local/

upgrade: pip-compile build start-bg migrations migrate npm-install npm-dev

.PHONY: help
.DEFAULT_GOAL := help

help:
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
