FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV AXE_MCP_MODE=hosted

RUN corepack enable

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile \
  && pnpm --filter @axe/mcp-service... build \
  && pnpm exec playwright install chromium --with-deps \
  && pnpm store prune

ENV NODE_ENV=production

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "mcp/dist/index.js"]
