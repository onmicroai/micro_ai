# Micro AI

Build Micro Apps with No Code

## Installation - Docker

The easiest way to get up and running is with [Docker](https://www.docker.com/).

Just [install Docker](https://www.docker.com/get-started) and
[Docker Compose](https://docs.docker.com/compose/install/)
and then run:

```
make init
```

This will spin up a database, web worker, celery worker, and Redis broker and run your migrations.

You can then go to [localhost:8000](http://localhost:8000/) to view the app.

*Note: if you get an error, make sure you have a `.env` file, or create one based on `.env.example`.*

### Using the Makefile

You can run `make` to see other helper functions, and you can view the source
of the file in case you need to run any specific commands.

For example, you can run management commands in containers using the same method 
used in the `Makefile`. E.g.

```
docker compose exec web python manage.py createsuperuser
```

### Launch Stripe subscription
```bash
sudo docker exec -it web /bin/sh
python ./manage.py bootstrap_subscriptions
```

## Installation - Native

You can also install/run the app directly on your OS using the instructions below.

Setup a virtualenv and install requirements
(this example uses [virtualenvwrapper](https://virtualenvwrapper.readthedocs.io/en/latest/)):

```bash
mkvirtualenv micro_ai -p python3.11
pip install -r dev-requirements.txt
```

## Set up database

*If you are using Docker you can skip these steps.*

Create a database named `micro_ai`.

```
createdb micro_ai
```

Create database migrations:

```
./manage.py makemigrations
```

Create database tables:

```
./manage.py migrate
```

## Running server

**Docker:**

```bash
make start
```

**Native:**

```bash
./manage.py runserver
```

## Building front-end

To build JavaScript and CSS files, first install npm packages:

**Docker:**

```bash
make npm-install
```

**Native:**

```bash
npm install
```

Then build (and watch for changes locally):

**Docker:**

```bash
make npm-watch
```

**Native:**

```bash
npm run dev-watch
```

## Running Celery

Celery can be used to run background tasks.
If you use Docker it will start automatically.

You can run it using:

```bash
celery -A micro_ai worker -l INFO
```

Or with celery beat (for scheduled tasks):

```bash
celery -A micro_ai worker -l INFO -B
```

## Google Authentication Setup

To setup Google Authentication, follow the [instructions here](https://docs.allauth.org/en/latest/socialaccount/providers/google.html).

## Installing Git commit hooks

To install the Git commit hooks run the following:

```shell
$ pre-commit install --install-hooks
```

Once these are installed they will be run on every commit.

For more information see the [docs](https://docs.saaspegasus.com/code-structure.html#code-formatting).

## Running Tests

To run tests:

**Docker:**

```bash
make test
```

**Native:**

```bash
./manage.py test
```

Or to test a specific app/module:

**Docker:**

```bash
docker compose exec web python manage.py test apps.utils.tests.test_slugs
```

**Native:**

```bash
./manage.py test apps.utils.tests.test_slugs
```

On Linux-based systems you can watch for changes using the following:

**Docker:**

```bash
find . -name '*.py' | entr docker compose exec web python manage.py test apps.utils.tests.test_slugs
```

**Native:**

```bash
find . -name '*.py' | entr python ./manage.py test apps.utils.tests.test_slugs
```
