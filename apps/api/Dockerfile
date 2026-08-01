FROM node:22-alpine AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/shared-utils/package.json packages/shared-utils/package.json

RUN npm ci --workspace @fruit-b2b/api --workspace @fruit-b2b/contracts --include-workspace-root=false

COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/contracts packages/contracts

RUN npm run build --workspace @fruit-b2b/contracts \
    && npm run build --workspace @fruit-b2b/api

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /workspace

RUN apk add --no-cache ffmpeg font-noto-cjk

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/shared-utils/package.json packages/shared-utils/package.json

RUN npm ci --omit=dev \
    --workspace @fruit-b2b/api \
    --workspace @fruit-b2b/contracts \
    --include-workspace-root=false \
    && npm cache clean --force

COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/packages/contracts ./packages/contracts

USER node
EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
