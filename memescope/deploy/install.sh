#!/usr/bin/env bash
# MemeScope AI — установка на Ubuntu/Debian VPS одной командой:
#   bash <(curl -fsSL https://raw.githubusercontent.com/alexxperelygin/alexander-ai-assistant/main/memescope/deploy/install.sh)
#
# Безопасен для сервера, где уже работают другие приложения:
#  - НЕ трогает существующие сайты nginx (свой vhost на отдельном порту);
#  - НЕ включает и не переконфигурирует файрвол (только добавляет правило,
#    если ufw уже был активен);
#  - НЕ обновляет уже установленный Node.js (использует ваш, если он >= 20;
#    если < 20 — останавливается с объяснением вместо молчаливой замены);
#  - кладёт всё в /opt/alexander-ai-assistant и pm2-процессы memescope-*,
#    чужие pm2-процессы не затрагивает.
# Скрипт идемпотентен: повторный запуск обновляет код и перезапускает сервисы.
set -euo pipefail

REPO_URL="https://github.com/alexxperelygin/alexander-ai-assistant.git"
APP_DIR="/opt/alexander-ai-assistant"
APP="$APP_DIR/memescope"

say() { echo -e "\n\033[1;32m==> $*\033[0m"; }
port_busy() { ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$1\$"; }
pick_port() { local p=$1; while port_busy "$p"; do p=$((p+1)); done; echo "$p"; }
# Порт занят ЧУЖИМ процессом (не нашим nginx). На общем сервере владельца
# 443 и 8443 держит docker-proxy, поэтому «свободен» проверяется по владельцу:
# наш собственный nginx на порту — это норма, чужой сервис — нет.
port_foreign() {
  local line
  line=$(ss -ltnp 2>/dev/null | awk -v p="[:.]$1\$" '$4 ~ p' | head -1)
  [ -n "$line" ] && ! echo "$line" | grep -q '"nginx"'
}
pick_own_port() { local p=$1; while port_foreign "$p"; do p=$((p + 1)); done; echo "$p"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите от root."; exit 1
fi

HAD_NGINX=0; command -v nginx >/dev/null && HAD_NGINX=1

say "1/8 Системные пакеты"
export DEBIAN_FRONTEND=noninteractive
# На общем сервере могут быть сломанные сторонние apt-репозитории (например,
# зеркало docker с битыми индексами). Это не должно валить установку MemeScope:
# терпим ошибку apt update и проверяем фактическое наличие нужных бинарников.
apt-get update -y || echo "⚠ apt update завершился с ошибками (вероятно, сторонний репозиторий) — продолжаю"
apt-get install -y curl git nginx apache2-utils openssl ca-certificates iproute2 >/dev/null || true
for bin in curl git nginx htpasswd openssl ss; do
  command -v "$bin" >/dev/null || { echo "Не удалось установить '$bin' — прерываюсь"; exit 1; }
done

say "2/8 Swap (если мало RAM)"
TOTAL_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$TOTAL_MB" -lt 3000 ] && ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Добавлен swap 2G"
else
  echo "Swap не требуется"
fi

say "3/8 Node.js (не трогаем существующий, если он свежий)"
if command -v node >/dev/null; then
  NODE_MAJOR=$(node -e 'console.log(process.versions.node.split(".")[0])')
  if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "На сервере уже установлен Node.js $(node --version), а MemeScope нужен >= 20."
    echo "Автозамена могла бы сломать другие ваши приложения, поэтому останавливаюсь."
    echo "Варианты: обновите Node вручную ИЛИ используйте отдельный сервер/nvm."
    exit 1
  fi
  echo "Используем существующий node $(node --version)"
else
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null
  echo "Установлен node $(node --version)"
fi
command -v pm2 >/dev/null || npm install -g pm2 >/dev/null

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
# Миграция старого дефолта: пропускная способность сканера 8 → 30 за цикл
# (дешёвый DexScreener-скрининг фильтрует токены до трат RugCheck/Jupiter).
sed -i 's/^MAX_CANDIDATES_PER_CYCLE=8$/MAX_CANDIDATES_PER_CYCLE=30/' .env || true

# Платный ключ X кладётся отдельным файлом (режим 600, вне репозитория) — так он
# не проходит через чат, не попадает в git и не светится в списке процессов.
# Здесь только переносим его в .env; само значение нигде не печатается.
apply_secret() { # $1 = имя файла с секретом, $2 = переменная в .env
  local file="/opt/memescope-secrets/$1"
  if [ -s "$file" ]; then
    sed -i "/^$2=/d" .env
    printf '%s=%s\n' "$2" "$(cat "$file")" >> .env
    say "   ключ $2 подключён (значение не выводится)"
  else
    say "   ключ $2 не задан — источник не используется"
  fi
}
apply_secret x_bearer X_BEARER_TOKEN
apply_secret reddit_client_id REDDIT_CLIENT_ID
apply_secret reddit_client_secret REDDIT_CLIENT_SECRET
apply_secret neynar_api_key NEYNAR_API_KEY
# SQLite однописательный: работающий worker держит блокировку, и db push
# падает с 'database is locked'. Останавливаем сервисы перед миграцией схемы.
pm2 stop memescope-web memescope-worker >/dev/null 2>&1 || true
# Обычный push. Prisma останавливается и требует подтверждения, если изменение
# схемы МОЖЕТ стоить данных — например при добавлении уникального ключа.
if ! npx prisma db push --skip-generate > /tmp/dbpush.log 2>&1; then
  cat /tmp/dbpush.log
  # Подтверждаем автоматически только безопасный случай: добавление уникального
  # ключа (падает, если есть дубликаты, но ничего не удаляет). Любое упоминание
  # удаления таблицы/колонки — останавливаемся, это должен решать человек.
  if grep -qiE "will be dropped|dropped and recreated|column .* will be" /tmp/dbpush.log; then
    echo "ОСТАНОВЛЕНО: изменение схемы удаляет данные — требуется ручное решение."
    exit 1
  fi
  if grep -qi "unique constraint covering the columns" /tmp/dbpush.log; then
    echo "Добавляется уникальный ключ — данные не удаляются, подтверждаю."
    npx prisma db push --skip-generate --accept-data-loss
  else
    echo "ОСТАНОВЛЕНО: неизвестное предупреждение схемы, см. лог выше."
    exit 1
  fi
fi
npx prisma generate >/dev/null
NODE_OPTIONS=--max-old-space-size=1536 npm run build

say "6/8 Запуск сервисов (pm2)"
# Внутренний порт дашборда: 3000 или первый свободный после него.
if [ -f "$APP/.web-port" ]; then
  WEB_PORT=$(cat "$APP/.web-port")
else
  WEB_PORT=$(pick_port 3000)
  echo "$WEB_PORT" > "$APP/.web-port"
fi
pm2 delete memescope-web >/dev/null 2>&1 || true
pm2 delete memescope-worker >/dev/null 2>&1 || true
# max-memory-restart страхует от утечек/OOM: pm2 мягко перезапустит процесс
# до того, как это грубо сделает ядро (и заодно от подвисших состояний).
PORT=$WEB_PORT pm2 start npm --name memescope-web --cwd "$APP" --max-memory-restart 500M -- start
pm2 start npm --name memescope-worker --cwd "$APP" --max-memory-restart 700M --restart-delay 5000 -- run worker
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null || true
pm2 save >/dev/null

say "7/8 Nginx: отдельный порт, чужие сайты не трогаем"
if [ -f /etc/nginx/.memescope-port ]; then
  NGINX_PORT=$(cat /etc/nginx/.memescope-port)
else
  NGINX_PORT=$(pick_port 8090)
  echo "$NGINX_PORT" > /etc/nginx/.memescope-port
fi
if [ ! -f /etc/nginx/.htpasswd-memescope ]; then
  DASH_PASS=$(openssl rand -base64 12 | tr -d '=+/' | cut -c1-12)
  htpasswd -cb /etc/nginx/.htpasswd-memescope admin "$DASH_PASS"
  echo "$DASH_PASS" > /root/memescope-dashboard-password.txt
  chmod 600 /root/memescope-dashboard-password.txt
else
  DASH_PASS="(прежний; смотрите /root/memescope-dashboard-password.txt)"
fi
cat > /etc/nginx/sites-available/memescope <<NGINX
server {
  listen $NGINX_PORT;
  server_name _;
  location / {
    auth_basic "MemeScope";
    auth_basic_user_file /etc/nginx/.htpasswd-memescope;
    proxy_pass http://127.0.0.1:$WEB_PORT;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
  }
}
NGINX
ln -sf /etc/nginx/sites-available/memescope /etc/nginx/sites-enabled/memescope
# Если nginx поставлен только что и его дефолтный сайт не может занять :80
# (там уже живёт другой веб-сервер) — убираем ТОЛЬКО свежесозданный дефолт.
if [ "$HAD_NGINX" -eq 0 ] && port_busy 80 && ! systemctl is-active -q nginx; then
  rm -f /etc/nginx/sites-enabled/default
fi
# Порт 443 на этом сервере принадлежит ДРУГОМУ приложению пользователя
# (docker-proxy). Забирать его нельзя — это сломает чужой сервис, поэтому наш
# domain-vhost, которому certbot добавил `listen 443 ssl`, пересобирается без
# 443: http на :80 плюс https на :8443, если сертификат уже выпущен.
DOMAIN_NAME="aurahrt.com"
HOLDER443=$(ss -ltnp 2>/dev/null | awk '$4 ~ /:443$/ {print $0}' | head -1)
if [ -n "$HOLDER443" ] && ! echo "$HOLDER443" | grep -q '"nginx"'; then
  # Свободный порт под https подбирается, а не задаётся: 8443 у владельца тоже
  # занят docker'ом, и любое фиксированное число рискует так же конфликтовать.
  SSL_PORT=$(pick_own_port "$(cat /etc/nginx/.memescope-ssl-port 2>/dev/null || echo 8443)")
  echo "$SSL_PORT" > /etc/nginx/.memescope-ssl-port
  echo "⚠ порт 443 занят другим приложением, https переносится на $SSL_PORT:"
  echo "  $HOLDER443"
  command -v docker >/dev/null && docker ps --format '  docker: {{.Names}} → {{.Ports}}' 2>/dev/null | head -5 || true
  CERT_DIR="/etc/letsencrypt/live/$DOMAIN_NAME"
  {
    echo "server {"
    echo "  listen 80;"
    echo "  server_name $DOMAIN_NAME www.$DOMAIN_NAME;"
    echo "  location / {"
    echo "    auth_basic \"MemeScope\";"
    echo "    auth_basic_user_file /etc/nginx/.htpasswd-memescope;"
    echo "    proxy_pass http://127.0.0.1:$WEB_PORT;"
    echo "    proxy_set_header Host \$host;"
    echo "    proxy_set_header X-Real-IP \$remote_addr;"
    echo "  }"
    echo "}"
    if [ -f "$CERT_DIR/fullchain.pem" ]; then
      echo "server {"
      echo "  listen $SSL_PORT ssl;"
      echo "  server_name $DOMAIN_NAME www.$DOMAIN_NAME;"
      echo "  ssl_certificate $CERT_DIR/fullchain.pem;"
      echo "  ssl_certificate_key $CERT_DIR/privkey.pem;"
      echo "  location / {"
      echo "    auth_basic \"MemeScope\";"
      echo "    auth_basic_user_file /etc/nginx/.htpasswd-memescope;"
      echo "    proxy_pass http://127.0.0.1:$WEB_PORT;"
      echo "    proxy_set_header Host \$host;"
      echo "    proxy_set_header X-Real-IP \$remote_addr;"
      echo "  }"
      echo "}"
    fi
  } > /etc/nginx/sites-available/memescope-domain
  ln -sf /etc/nginx/sites-available/memescope-domain /etc/nginx/sites-enabled/memescope-domain
  if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow "$SSL_PORT"/tcp >/dev/null 2>&1 || true
  fi
fi

nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
# Конфиг может быть валиден (`nginx -t` не биндит порты), а старт всё равно
# падает — почти всегда порт держит осиротевший мастер-процесс nginx, не
# управляемый systemd (частый побочный эффект certbot/ручных запусков).
# Поэтому: обычный restart → при неудаче показать причину, снять сирот и
# повторить → только потом падать.
if ! systemctl restart nginx; then
  echo "⚠ nginx не стартовал, диагностика:"
  systemctl status nginx --no-pager -l 2>&1 | tail -15 || true
  journalctl -u nginx --no-pager -n 20 2>&1 | tail -20 || true
  ss -ltnp 2>/dev/null | grep -E ':(80|443|'"$NGINX_PORT"')\b' || true
  echo "→ снимаю осиротевшие процессы nginx и пробую снова"
  systemctl stop nginx >/dev/null 2>&1 || true
  pkill -x nginx >/dev/null 2>&1 || true
  sleep 2
  if ! systemctl start nginx; then
    echo "nginx не поднимается — прерываю деплой"
    journalctl -u nginx --no-pager -n 30 2>&1 | tail -30 || true
    exit 1
  fi
  echo "✓ nginx поднят после снятия сирот"
fi

say "8/8 Файрвол (только если уже был включён)"
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow "$NGINX_PORT"/tcp >/dev/null || true
  echo "ufw активен — добавлено правило для порта $NGINX_PORT"
else
  echo "ufw не активен — ничего не меняем (как было, так и осталось)"
fi

IP=$(curl -fsS4 --max-time 5 ifconfig.me || hostname -I | awk '{print $1}')
say "ГОТОВО"
cat <<DONE

  Дашборд:  http://$IP:$NGINX_PORT
  Логин:    admin
  Пароль:   $DASH_PASS
            (сохранён в /root/memescope-dashboard-password.txt)

  Проверка сервисов:  pm2 status
  Логи сканера:       pm2 logs memescope-worker
  Обновление позже:   повторно запустите эту же команду установки

  Если дашборд не открывается снаружи, проверьте панельный файрвол Aeza
  и откройте в нём TCP-порт $NGINX_PORT.

  Telegram-уведомления (по желанию): впишите TELEGRAM_BOT_TOKEN и
  TELEGRAM_CHAT_ID в $APP/.env и выполните: pm2 restart all
DONE
