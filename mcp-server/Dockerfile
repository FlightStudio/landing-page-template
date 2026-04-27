# Campaign Studio MCP Server
# Build context is the repo root:
#   docker build -f mcp-server/Dockerfile -t campaign-studio .

FROM node:22-alpine
WORKDIR /app

# Install MCP server dependencies
COPY mcp-server/package.json mcp-server/package-lock.json ./
RUN npm ci --omit=dev

# Copy MCP server code
COPY mcp-server/server.js ./

# Bake in custom-page mode templates (Dockerfile + nginx.conf used by deploy_custom_page)
COPY mcp-server/templates/ /app/templates/

# Bake in the landing page template
COPY package.json package-lock.json vite.config.js index.html Dockerfile nginx.conf /template/
COPY src/ /template/src/
COPY public/ /template/public/

EXPOSE 8080
CMD ["node", "server.js"]
