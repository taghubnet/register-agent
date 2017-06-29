# Register agent

Service that will collect environment information and register itself with a [register-api](https://github.com/taghubnet/register-api).

`register-agent` is designed to be used as a [linuxkit](https://github.com/linuxkit/linuxkit) service in conjunction with [register-api](https://github.com/taghubnet/register-api). It belongs on a node running a `docker swarm worker`.

Agents will query their environment using [cloud-detector](https://github.com/asbjornenge/cloud-detector) and register itself with a `register-api`. In return it will get a `swarm join key` and use that to connect to the `docker swarm`.
