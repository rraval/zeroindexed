# @zeroindexed/valheim

Pulumi component to run [Valheim][valheim] in any Kubernetes environment.

Builds upon the excellent [mbround18/valheim-docker][valheim-docker] image:

-   Game ports on the default UDP ports (2456, 2457, and 2458) are exposed to the external world. This allows the game to connect directly to the server via IP address or domain name.
-   The [Odin][odin] HTTP service allows querying game server status, but is only accessible inside the cluster.

## Related work

- [`@zeroindexed/valheimctl-worker`][valheimctl-worker]: a web UI to control your Valheim server and automatically turn it off when it is idle.
- [`@zeroindexed/valheimctl`][valheimctl]: a Pulumi package to deploy `@zeroindexed/valheimctl-worker`.

[valheim]: https://www.valheimgame.com/
[valheim-docker]: https://github.com/mbround18/valheim-docker
[valheimctl-worker]: ../valheimctl-worker
[valheimctl]: ../valheimctl
[odin]: https://github.com/mbround18/valheim-docker/blob/main/docs/releases/status_update.md#-http-server-for-serving-status
