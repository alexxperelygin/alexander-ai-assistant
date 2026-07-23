#!/usr/bin/env bash
# MemeScope AI — установка на чистый Ubuntu/Debian VPS одной командой:
#   bash <(curl -fsSL https://raw.githubusercontent.com/alexxperelygin/alexander-ai-assistant/main/memescope/deploy/install.sh)
# Скрипт идемпотентен: повторный запуск обновляет код и перезапускает сервисы.
set -euo pipefail

REPO_URL="https://github.com/alexxperelygin/alexander-ai-assistant.git"
APP_DIR="/opt/alexander-ai-assistant"
APP="$APP_DIR/memescope"

say() { echo -e "\n\033[1;32m==> $*\033[0m"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите от root (в Aeza вы и так root)."; exit 1
fi

say "1/8 Системные пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git nginx apache2-utils openssl ca-certificates ufw >/dev/null

say "2/8 Swap (если мало RAM)"
TOTAL_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$TOTAL_MB" -lt 3000 ] && ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Добавлен swap 2G"
else
  echo "Swap не требуется"
fi

say "3/8 Node.js 22 + pm2"
if ! command -v node >/dev/null || [ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null
fi
command -v pm2 >/dev/null || npm install -g pm2 >/dev/null
echo "node $(node --version), pm2 $(pm2 --version)"

say "4/8 Код проекта"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin main && git -C "$APP_DIR" checkout main && git -C "$APP_DIR" pull origin main
else
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP"

say "5/8 Зависимости, база, сборка (может занять несколько минут)"
npm install --no-audit --no-fund
[ -f .env ] || cp .env.example .env
npx prisma db push --skip-generate >/dev/null
npx prisma generate >/dev/null
NODE_OPTIONS=--max-old-space-size=1536 npm run build

say "6/8 Запуск сервисов (pm2)"
pm2 delete memescope-web >/dev/null 2>&1 || true
pm2 delete memescope-worker >/dev/null 2>&1 || true
pm2 start npm --name memescope-web --cwd "$APP" -- start
pm2 start npm --name memescope-worker --cwd "$APP" -- run worker
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null || true
pm2 save >/dev/null

say "7/8 Nginx с паролем"
if [ ! -f /etc/nginx/.htpasswd ]; then
  DASH_PASS=$(openssl rand -base64 12 | tr -d '=+/' | cut -c1-12)
  htpasswd -cb /etc/nginx/.htpasswd admin "$DASH_PASS"
  echo "$DASH_PASS" > /root/memescope-dashboard-password.txt
  chmod 600 /root/memescope-dashboard-password.txt
else
  DASH_PASS="(прежний; смотрите /root/memescope-dashboard-password.txt)"
fi
cat > /etc/nginx/sites-available/memescope <<'NGINX'
server {
  listen 80 default_server;
  server_name _;
  location / {
    auth_basic "MemeScope";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
NGINX
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/memescope /etc/nginx/sites-enabled/memescope
nginx -t && systemctl reload nginx

say "8/8 Файрвол"
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

IP=$(curl -fsS4 --max-time 5 ifconfig.me || hostname -I | awk '{print $1}')
say "ГОТОВО"
cat <<DONE

  Дашборд:  http://$IP
  Логин:    admin
  Пароль:   $DASH_PASS
            (сохранён в /root/memescope-dashboard-password.txt)

  Проверка сервисов:  pm2 status
  Логи сканера:       pm2 logs memescope-worker
  Обновление позже:   повторно запустите эту же команду установки

  Telegram-уведомления (по желанию): впишите TELEGRAM_BOT_TOKEN и
  TELEGRAM_CHAT_ID в $APP/.env и выполните: pm2 restart all
DONE
