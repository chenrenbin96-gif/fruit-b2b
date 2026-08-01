FROM node:22-alpine AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/shared-utils/package.json packages/shared-utils/package.json

RUN npm ci --workspace @fruit-b2b/admin --workspace @fruit-b2b/contracts --include-workspace-root=true

COPY tsconfig.base.json ./
COPY apps/admin apps/admin
COPY packages/contracts packages/contracts

ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build --workspace @fruit-b2b/contracts \
    && npm run build --workspace @fruit-b2b/admin

FROM nginx:1.27-alpine AS runtime

COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/admin/dist /usr/share/nginx/html

EXPOSE 80
