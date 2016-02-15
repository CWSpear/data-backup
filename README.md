# docker-volume-backup
Backup Docker Volumes

```
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -w /app/ -v `pwd`:/app/ node:4.3 node index
```
