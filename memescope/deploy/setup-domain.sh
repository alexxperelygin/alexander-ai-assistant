#!/usr/bin/env bash
# Подключает домен aurahrt.com к дашборду MemeScope: nginx-vhost + Let's Encrypt
# SSL с авторедиректом на https. Запускается на сервере через ops-задачу "domain".
# Требование: A-запись aurahrt.com должна указывать на IP этого сервера.
set -euo pipefail

DOMAIN="aurahrt.com"
LE_EMAIL="ivanovich234@gmail.com"
APP="/opt/alexander-ai-assistant/memescope"
WEB_PORT=$(cat "$APP/.web-port" 2>/dev/null || echo 3000)

MYIP=$(curl -fsS4 --max-time 10 ifconfig.me)
RESOLVED=$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | head -1 || true)
if [ "$RESOLVED" != "$MYIP" ]; then
  echo "DNS ещё не указывает на этот сервер: $DOMAIN -> ${RESOLVED:-нет записи}, требуется $MYIP"
  echo "Добавьте в Namecheap (Advanced DNS) запись: A Record, Host @, Value $MYIP, TTL Automatic"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null 2>&1 || true
apt-get install -y certbot python3-certbot-nginx >/dev/null 2>&1 || true
command -v certbot >/dev/null || { echo "certbot не установился"; exit 1; }

cat > /etc/nginx/sites-available/memescope-domain <<NGINX
server {
  listen 80;
  server_name $DOMAIN www.$DOMAIN;
  location / {
    auth_basic "MemeScope";
    auth_basic_user_file /etc/nginx/.htpasswd-memescope;
    proxy_pass http://127.0.0.1:$WEB_PORT;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
  }
}
NGINX
ln -sf ../sites-available/memescope-domain /etc/nginx/sites-enabled/memescope-domain
nginx -t
systemctl reload nginx

# Файрвол: certbot и https требуют открытых 80/443.
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null || true
  ufw allow 443/tcp >/dev/null || true
fi

# Сертификат: пытаемся с www (если www-запись тоже настроена), иначе только апекс.
if ! certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$LE_EMAIL" --redirect; then
  echo "www.$DOMAIN не подтвердился (это нормально, если www-записи нет) — выпускаю только для $DOMAIN"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$LE_EMAIL" --redirect
fi

echo "DOMAIN ГОТОВО: https://$DOMAIN"
