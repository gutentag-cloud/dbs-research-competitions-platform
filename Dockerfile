FROM node:24-slim
WORKDIR /app
COPY server.cjs index.html app.js store.js data.js styles.css ./
COPY assets ./assets
COPY scripts ./scripts
ENV PORT=4183 HOST=0.0.0.0 PILOT_DATA_DIR=/var/lib/dbs-pilot
EXPOSE 4183
CMD ["node","server.cjs"]
