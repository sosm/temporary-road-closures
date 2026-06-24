# SSL Certificate Setup and Renewal Guide

This guide explains how to set up and renew SSL certificates for the OSM Road Closures application using Let's Encrypt.

## Overview

The application uses Let's Encrypt SSL certificates for HTTPS encryption on:
- **Frontend**: `closures.osm.ch`
- **API**: `api.closures.osm.ch`

## Prerequisites

- Root access to the production server
- Domains properly configured in DNS (A records pointing to server IP)
- Docker and Docker Compose installed
- Nginx running (either in Docker or on host system)

## Initial SSL Certificate Setup

### Option 1: Manual Setup with Certbot (Recommended for First-Time)

1. **Install Certbot**

   ```bash
   sudo apt-get update
   sudo apt-get install certbot python3-certbot-nginx
   ```

2. **Stop Nginx** (if running)

   ```bash
   # If using Docker
   docker-compose -f docker-compose.prod.yml stop nginx

   # If using system nginx
   sudo systemctl stop nginx
   ```

3. **Obtain Certificates**

   For both domains at once:
   ```bash
   sudo certbot certonly --standalone \
     -d closures.osm.ch \
     -d api.closures.osm.ch \
     --email your-email@example.com \
     --agree-tos \
     --non-interactive
   ```

   Or separately:
   ```bash
   # Frontend domain
   sudo certbot certonly --standalone \
     -d closures.osm.ch \
     --email your-email@example.com \
     --agree-tos

   # API domain
   sudo certbot certonly --standalone \
     -d api.closures.osm.ch \
     --email your-email@example.com \
     --agree-tos
   ```

4. **Verify Certificates**

   ```bash
   sudo certbot certificates
   ```

   You should see output showing certificates for both domains with expiration dates.

5. **Start Nginx**

   ```bash
   # If using Docker
   docker-compose -f docker-compose.prod.yml start nginx

   # If using system nginx
   sudo systemctl start nginx
   ```

6. **Test HTTPS Access**

   ```bash
   curl -I https://closures.osm.ch
   curl -I https://api.closures.osm.ch
   ```

### Option 2: Using Docker Certbot Service (Automated)

The repository includes a certbot service in `docker-compose.prod.yml` that can automatically obtain and renew certificates.

1. **First-time setup** - Obtain certificates:

   ```bash
   docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
     --webroot \
     --webroot-path=/var/lib/letsencrypt \
     -d closures.osm.ch \
     -d api.closures.osm.ch \
     --email your-email@example.com \
     --agree-tos \
     --non-interactive
   ```

2. **Reload nginx** to use new certificates:

   ```bash
   docker exec osm_closures_nginx_prod nginx -s reload
   ```

## Certificate Renewal

Let's Encrypt certificates expire every **90 days**. Here are the renewal methods:

### Method 1: Automatic Renewal (Recommended)

**Using the provided script:**

1. Run the renewal script:
   ```bash
   sudo /path/to/temporary-road-closures/scripts/renew_ssl.sh
   ```

2. Set up a cron job for automatic renewal:
   ```bash
   sudo crontab -e
   ```

   Add this line to run daily at midnight:
   ```cron
   0 0 * * * /path/to/temporary-road-closures/scripts/renew_ssl.sh >> /var/log/certbot-renewal.log 2>&1
   ```

**Using certbot's built-in timer:**

```bash
# Enable certbot renewal timer
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Check timer status
sudo systemctl status certbot.timer
```

### Method 2: Manual Renewal

When you receive an expiration warning or the certificate has expired:

1. **Stop the nginx container** (to free port 80):
   ```bash
   docker-compose -f docker-compose.prod.yml stop nginx
   ```

2. **Renew certificates**:
   ```bash
   sudo certbot renew
   ```

3. **Start nginx**:
   ```bash
   docker-compose -f docker-compose.prod.yml start nginx
   ```

### Method 3: Webroot Renewal (No Downtime)

If nginx is already configured with the Let's Encrypt snippet:

```bash
sudo certbot renew --webroot \
  --webroot-path=/var/lib/letsencrypt \
  --post-hook "docker exec osm_closures_nginx_prod nginx -s reload"
```

## Troubleshooting

### Certificate Expired Error

**Symptom**: Browser shows `ERR_CERT_DATE_INVALID` or "Your connection is not private"

**Solution**:
1. Check certificate status:
   ```bash
   sudo certbot certificates
   ```

2. If expired, renew immediately:
   ```bash
   sudo /path/to/temporary-road-closures/scripts/renew_ssl.sh
   ```

### Certificate Not Found

**Symptom**: Nginx fails to start with error about missing certificate files

**Solution**:
1. Verify certificate files exist:
   ```bash
   sudo ls -la /etc/letsencrypt/live/closures.osm.ch/
   sudo ls -la /etc/letsencrypt/live/api.closures.osm.ch/
   ```

2. If missing, obtain new certificates (see Initial Setup above)

### Port 80 Already in Use

**Symptom**: Certbot fails with "Address already in use" error

**Solutions**:
- **Option A**: Stop nginx temporarily:
  ```bash
  docker-compose -f docker-compose.prod.yml stop nginx
  # Run certbot
  docker-compose -f docker-compose.prod.yml start nginx
  ```

- **Option B**: Use webroot method instead of standalone:
  ```bash
  sudo certbot renew --webroot --webroot-path=/var/lib/letsencrypt
  ```

### Domain Validation Failed

**Symptom**: Certbot cannot validate domain ownership

**Solutions**:
1. Verify DNS is correctly configured:
   ```bash
   dig closures.osm.ch
   dig api.closures.osm.ch
   ```

2. Ensure firewall allows HTTP (port 80):
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

3. Check that nginx is properly serving `.well-known/acme-challenge`:
   ```bash
   curl http://closures.osm.ch/.well-known/acme-challenge/test
   ```

## Certificate Locations

After successful setup, certificates are stored in:

```
/etc/letsencrypt/
├── live/
│   ├── closures.osm.ch/
│   │   ├── fullchain.pem    # Public certificate + intermediate
│   │   ├── privkey.pem      # Private key
│   │   ├── cert.pem         # Public certificate only
│   │   └── chain.pem        # Intermediate certificates only
│   └── api.closures.osm.ch/
│       ├── fullchain.pem
│       ├── privkey.pem
│       ├── cert.pem
│       └── chain.pem
├── renewal/                  # Renewal configuration files
└── archive/                  # Historical certificates
```

## Nginx Configuration

The nginx configuration in `/nginx/sites-available/osm-closures` references these certificates:

```nginx
ssl_certificate /etc/letsencrypt/live/closures.osm.ch/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/closures.osm.ch/privkey.pem;
```

These paths are mounted in `docker-compose.prod.yml`:

```yaml
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
  - /var/lib/letsencrypt:/var/lib/letsencrypt
```

## Monitoring Certificate Expiration

### Check Expiration Date

```bash
# Using certbot
sudo certbot certificates

# Using openssl
echo | openssl s_client -servername closures.osm.ch -connect closures.osm.ch:443 2>/dev/null | openssl x509 -noout -dates
```

### Set Up Expiration Alerts

1. **Email notifications**: Certbot automatically sends expiration warnings to the email address provided during setup.

2. **Monitoring script**: Create a simple monitoring script:
   ```bash
   #!/bin/bash
   EXPIRY=$(sudo certbot certificates | grep "Expiry Date" | head -1 | awk '{print $3}')
   DAYS_LEFT=$(( ($(date -d "$EXPIRY" +%s) - $(date +%s)) / 86400 ))

   if [ $DAYS_LEFT -lt 30 ]; then
       echo "WARNING: SSL certificate expires in $DAYS_LEFT days!"
       # Add notification logic here
   fi
   ```

## Best Practices

1. **Renew Early**: Renew certificates at least 30 days before expiration
2. **Test Renewals**: Always test with `--dry-run` before actual renewal
3. **Monitor Logs**: Check `/var/log/letsencrypt/` for renewal issues
4. **Backup Certificates**: Keep backups of `/etc/letsencrypt/` directory
5. **Use Automation**: Set up cron jobs or systemd timers for automatic renewal
6. **Version Control**: Don't commit certificates to git (they're in `.gitignore`)

## Security Considerations

1. **Private Keys**: Never share or commit `privkey.pem` files
2. **File Permissions**: Let's Encrypt sets correct permissions automatically (600 for private keys)
3. **Renewal Hooks**: Use `--post-hook` to reload nginx after renewal
4. **Strong Ciphers**: nginx config includes strong SSL/TLS settings
5. **HSTS Headers**: Strict-Transport-Security headers are enabled in nginx

## Quick Reference

| Task | Command |
|------|---------|
| Check certificates | `sudo certbot certificates` |
| Renew all certificates | `sudo certbot renew` |
| Test renewal | `sudo certbot renew --dry-run` |
| Run renewal script | `sudo /path/to/scripts/renew_ssl.sh` |
| Reload nginx (Docker) | `docker exec osm_closures_nginx_prod nginx -s reload` |
| Check expiration | `openssl s_client -servername closures.osm.ch -connect closures.osm.ch:443 2>/dev/null \| openssl x509 -noout -dates` |

## Additional Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://eff-certbot.readthedocs.io/)
- [Nginx SSL Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)

## Support

If you encounter issues not covered in this guide:
1. Check certbot logs: `/var/log/letsencrypt/letsencrypt.log`
2. Review nginx logs: `docker-compose -f docker-compose.prod.yml logs nginx`
3. Contact the project maintainers: closures@sosm.ch
