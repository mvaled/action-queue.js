PATH := ./node_modules/.bin/:$(PATH)
pnpm-lock.yaml: package.json
	@pnpm install

test: pnpm-lock.yaml
	@pnpm run test

caddy: pnpm-lock.yaml
	@caddy file-server --browse --listen ':9999' --root .

.PHONY: test
