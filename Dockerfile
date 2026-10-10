FROM python:3.13-slim
WORKDIR /app
COPY server.py index.html app.js styles.css ./
COPY assets ./assets
ENV PYTHONUNBUFFERED=1 PILOT_DATA_DIR=/var/data/pilot PORT=4180
EXPOSE 4180
CMD ["python", "server.py"]
