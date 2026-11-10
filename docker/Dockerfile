# PackMate web app as a tiny static image — run it on a NAS, home server or any Docker host.
#   docker build -f docker/Dockerfile -t packmate .
#   docker run -d -p 8080:80 --name packmate packmate

# 1) Rust -> WebAssembly geometry engine
FROM rust:1-bookworm AS wasm
RUN rustup target add wasm32-unknown-unknown \
 && cargo install --locked wasm-pack@0.15.1
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
RUN wasm-pack build crates/dieline-wasm --release --target web --out-dir /out/wasm --out-name dieline

# 2) React front end
FROM node:22-bookworm-slim AS web
# pin the same pnpm major as CI: newer majors apply a release-age policy that rejects fresh lockfile entries
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /src/app
COPY app/package.json app/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY app ./
COPY --from=wasm /out/wasm ./wasm
RUN pnpm build:web

# 3) Static server
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web /src/app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
