FROM node:24-slim AS base

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json          ./lib/api-spec/
COPY lib/api-zod/package.json           ./lib/api-zod/
COPY lib/db/package.json                ./lib/db/
COPY artifacts/hr-dashboard/package.json ./artifacts/hr-dashboard/

RUN pnpm install --frozen-lockfile

FROM deps AS builder

COPY lib/              ./lib/
COPY artifacts/hr-dashboard/ ./artifacts/hr-dashboard/
COPY tsconfig.base.json tsconfig.json ./

ENV NODE_ENV=production

RUN pnpm --filter @workspace/hr-dashboard run build

FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/artifacts/hr-dashboard/dist/public /usr/share/nginx/html

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
