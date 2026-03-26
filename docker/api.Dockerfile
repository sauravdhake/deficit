FROM node:24-alpine AS base

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json          ./lib/api-spec/
COPY lib/api-zod/package.json           ./lib/api-zod/
COPY lib/db/package.json                ./lib/db/
COPY artifacts/api-server/package.json  ./artifacts/api-server/

RUN pnpm install --frozen-lockfile

FROM deps AS builder

COPY lib/           ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/
COPY tsconfig.base.json tsconfig.json ./

RUN pnpm --filter @workspace/api-server run build

FROM node:24-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json          ./lib/api-spec/
COPY lib/api-zod/package.json           ./lib/api-zod/
COPY lib/db/package.json                ./lib/db/
COPY artifacts/api-server/package.json  ./artifacts/api-server/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist

WORKDIR /app/artifacts/api-server

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
