# Deployment with Kamal
#TO-DO: Remove this file

This folder contains the configuration and scripts for deploying using [Kamal](https://kamal-deploy.org/),
a Ruby-based deployment tool.

The full documentation can be found at [docs.saaspegasus.com/deployment/kamal/](https://docs.saaspegasus.com/deployment/kamal/).

Below are some useful commands for deploying and managing the app. All commands should be run from the `deploy` directory.

See the [Kamal documentation](https://kamal-deploy.org/docs/commands) for more commands.

## Updating Django Settings

If you need to make changes to the Django environment variables, you can do so by editing the `.env` file in this
directory and then using Kamal to push the changes to the servers:

```bash
kamal env push
```

This will copy the `.env` file to all the servers and restart the Docker containers.

## Deploy

Normal 'code' deploys can be done by running `kamal deploy` from the `deploy` directory.

## Accessing logs

By default, Kamal uses the `json-file` Docker logging driver to log to the local filesystem.
You can view the logs using Kamal or directly on the server using `docker logs`:

```bash
kamal app logs
```

See `kamal app logs --help` for more details.
