FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY app.js /usr/share/nginx/html/app.js
COPY ui.js /usr/share/nginx/html/ui.js
COPY styles.css /usr/share/nginx/html/styles.css
EXPOSE 80
HEALTHCHECK --interval=20s --timeout=3s --retries=5 CMD wget -q -O - http://127.0.0.1/ >/dev/null || exit 1
