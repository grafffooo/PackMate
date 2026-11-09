# PackMate self-hosted web app (e.g. for a NAS).
# The box generator runs in the browser as WebAssembly; this image only serves static files.

FROM rust:1.97-bookworm AS build
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack \
 && corepack enable \
 && rustup target add wasm32-unknown-unknown \
 && cargo install --locked wasm-pack@0.15.1
WORKDIR /src
COPY . .
RUN cd app && pnpm install --frozen-lockfile && pnpm build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/app/build /usr/share/nginx/html
EXPOSE 8080
