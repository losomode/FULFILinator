# FULFILinator Deployment Guide

This guide covers production deployment for FULFILinator following the "inator microservice philosophy" - simple, focused deployment.

## Prerequisites

- Python 3.11+
- PostgreSQL 13+ (recommended for production) or MySQL 8+
- Web server (nginx, Apache, or similar)
- SMTP server access for email notifications
- Authinator service running and accessible
- System with systemd (for service management)

## Production Architecture

```
[nginx/Apache] → [WSGI Server (Gunicorn/uWSGI)] → [Django App]
                                                         ↓
                                                   [PostgreSQL]
                                                         ↓
                                                   [Authinator API]
```

## Step 1: Server Setup

### Install system dependencies

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3.11 python3.11-venv python3-pip postgresql postgresql-contrib nginx

# RHEL/CentOS
sudo yum install python311 python311-devel postgresql-server postgresql-contrib nginx
```

### Create application user

```bash
sudo useradd -m -s /bin/bash fulfilinator
sudo su - fulfilinator
```

### Clone and setup application

```bash
cd /home/fulfilinator
git clone <repository-url> fulfilinator
cd fulfilinator/backend
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn psycopg2-binary  # Production dependencies
```

## Step 2: Database Setup

### PostgreSQL Configuration

```bash
sudo -u postgres psql

-- Create database and user
CREATE DATABASE fulfilinator;
CREATE USER fulfilinator_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE fulfilinator TO fulfilinator_user;
ALTER DATABASE fulfilinator OWNER TO fulfilinator_user;
\q
```

### Update Django settings for PostgreSQL

Edit `config/settings.py` or use environment variables:

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'fulfilinator',
        'USER': 'fulfilinator_user',
        'PASSWORD': 'secure_password_here',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

Or use `DATABASE_URL` in `.env`:

```bash
DATABASE_URL=postgresql://fulfilinator_user:secure_password_here@localhost:5432/fulfilinator
```

## Step 3: Environment Configuration

### Create production .env file

```bash
cd /home/fulfilinator/fulfilinator/backend
cp .env.example .env
nano .env
```

### Required production settings

```bash
# Security
SECRET_KEY=<generate-secure-random-50+-character-key>
DEBUG=False
ALLOWED_HOSTS=fulfilinator.yourdomain.com,api.yourdomain.com

# Database
DATABASE_URL=postgresql://fulfilinator_user:secure_password@localhost:5432/fulfilinator

# CORS (your frontend domain)
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Authinator
AUTHINATOR_API_URL=https://auth.yourdomain.com/api/auth/
AUTHINATOR_VERIFY_SSL=True

# Service Registry
SERVICE_REGISTRY_URL=https://auth.yourdomain.com/api/services/register/
SERVICE_REGISTRATION_KEY=<secure-service-registration-key>

# Email (SMTP)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=fulfilinator@yourdomain.com
EMAIL_HOST_PASSWORD=<smtp-password>
DEFAULT_FROM_EMAIL=fulfilinator@yourdomain.com
```

### Generate secure SECRET_KEY

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

## Step 4: Django Application Setup

### Run migrations

```bash
source venv/bin/activate
python manage.py migrate
```

### Collect static files

```bash
python manage.py collectstatic --noinput
```

### Test application

```bash
python manage.py runserver 0.0.0.0:8001
# Test in browser, then stop with Ctrl+C
```

## Step 5: Gunicorn Configuration

### Create Gunicorn configuration

```bash
nano /home/fulfilinator/fulfilinator/backend/gunicorn_config.py
```

```python
bind = "127.0.0.1:8001"
workers = 4  # 2-4 x CPU cores
worker_class = "sync"
timeout = 120
keepalive = 5
max_requests = 1000
max_requests_jitter = 50
accesslog = "/home/fulfilinator/logs/gunicorn-access.log"
errorlog = "/home/fulfilinator/logs/gunicorn-error.log"
loglevel = "info"
```

### Create log directory

```bash
mkdir -p /home/fulfilinator/logs
```

## Step 6: Systemd Service

### Create systemd service file

```bash
sudo nano /etc/systemd/system/fulfilinator.service
```

```ini
[Unit]
Description=FULFILinator Gunicorn Service
After=network.target postgresql.service

[Service]
Type=notify
User=fulfilinator
Group=fulfilinator
WorkingDirectory=/home/fulfilinator/fulfilinator/backend
Environment="PATH=/home/fulfilinator/fulfilinator/backend/venv/bin"
ExecStart=/home/fulfilinator/fulfilinator/backend/venv/bin/gunicorn \
    --config /home/fulfilinator/fulfilinator/backend/gunicorn_config.py \
    config.wsgi:application
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true
Restart=always

[Install]
WantedBy=multi-user.target
```

### Enable and start service

```bash
sudo systemctl daemon-reload
sudo systemctl enable fulfilinator
sudo systemctl start fulfilinator
sudo systemctl status fulfilinator
```

## Step 7: Nginx Configuration

### Create nginx configuration

```bash
sudo nano /etc/nginx/sites-available/fulfilinator
```

```nginx
upstream fulfilinator {
    server 127.0.0.1:8001;
}

server {
    listen 80;
    server_name fulfilinator.yourdomain.com api.yourdomain.com;

    client_max_body_size 100M;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name fulfilinator.yourdomain.com api.yourdomain.com;

    ssl_certificate /etc/ssl/certs/fulfilinator.crt;
    ssl_certificate_key /etc/ssl/private/fulfilinator.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 100M;

    location /api/fulfil/ {
        proxy_pass http://fulfilinator;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }

    location /static/ {
        alias /home/fulfilinator/fulfilinator/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /media/ {
        alias /home/fulfilinator/fulfilinator/backend/media/;
        expires 7d;
    }
}
```

### Enable site and restart nginx

```bash
sudo ln -s /etc/nginx/sites-available/fulfilinator /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 8: SSL Certificate

### Using Let's Encrypt (recommended)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d fulfilinator.yourdomain.com -d api.yourdomain.com
```

### Auto-renewal

```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## Step 9: Scheduled Tasks (Cron)

### Setup cron for expiring PO checks

```bash
crontab -e
```

Add daily check at 9 AM:

```cron
# Check for expiring POs daily at 9:00 AM
0 9 * * * cd /home/fulfilinator/fulfilinator/backend && /home/fulfilinator/fulfilinator/backend/venv/bin/python manage.py check_expiring_pos
```

## Step 10: Monitoring and Logging

### Log locations

- Application logs: `/home/fulfilinator/logs/gunicorn-*.log`
- Nginx logs: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- System logs: `sudo journalctl -u fulfilinator`

### Monitor service status

```bash
sudo systemctl status fulfilinator
sudo journalctl -u fulfilinator -f  # Follow logs
```

### Health check endpoint

```bash
curl https://fulfilinator.yourdomain.com/api/fulfil/health/
```

## Security Considerations

### File permissions

```bash
chmod 600 /home/fulfilinator/fulfilinator/backend/.env
chmod 750 /home/fulfilinator/fulfilinator/backend/media
chown -R fulfilinator:fulfilinator /home/fulfilinator/fulfilinator
```

### Firewall

```bash
# Allow only HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Database backups

```bash
# Create backup script
nano /home/fulfilinator/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/fulfilinator/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -U fulfilinator_user fulfilinator | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Media files backup
tar -czf $BACKUP_DIR/media_$DATE.tar.gz /home/fulfilinator/fulfilinator/backend/media/

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete
```

```bash
chmod +x /home/fulfilinator/backup.sh
```

Add to crontab (daily at 2 AM):

```cron
0 2 * * * /home/fulfilinator/backup.sh
```

### Regular updates

```bash
cd /home/fulfilinator/fulfilinator/backend
source venv/bin/activate
pip install --upgrade -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart fulfilinator
```

## Troubleshooting

### Service won't start

```bash
sudo journalctl -u fulfilinator -n 50
sudo systemctl status fulfilinator
```

### Database connection issues

```bash
# Test PostgreSQL connection
psql -U fulfilinator_user -d fulfilinator -h localhost
```

### Permission errors

```bash
sudo chown -R fulfilinator:fulfilinator /home/fulfilinator/fulfilinator
```

### Check application logs

```bash
tail -f /home/fulfilinator/logs/gunicorn-error.log
```

## Scaling Considerations

### Horizontal scaling

- Run multiple instances behind a load balancer
- Use shared PostgreSQL database
- Use shared file storage (NFS, S3) for media files

### Vertical scaling

- Increase Gunicorn workers: `workers = (2 * cpu_cores) + 1`
- Optimize database queries with indexes
- Enable database connection pooling

### Caching (optional)

Add Redis for token caching:

```bash
pip install redis django-redis
```

Update `config/settings.py`:

```python
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}
```

## Production Checklist

- [ ] SECRET_KEY is secure and unique
- [ ] DEBUG=False
- [ ] ALLOWED_HOSTS configured correctly
- [ ] Database is PostgreSQL with backups enabled
- [ ] SSL certificate installed and auto-renewal enabled
- [ ] Email (SMTP) configured and tested
- [ ] Firewall configured (only 80/443 open)
- [ ] File permissions secured
- [ ] Systemd service enabled and running
- [ ] Nginx configured and running
- [ ] Cron job for expiring PO checks setup
- [ ] Daily database backups configured
- [ ] Logs monitored
- [ ] Health check endpoint responding
- [ ] Authinator integration tested

## Support

For issues or questions, refer to the main [README.md](README.md) or project documentation.
