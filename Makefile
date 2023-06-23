PATH := ./node_modules/.bin/:$(PATH)

node_modules yarn.lock: package.json
	@yarn install
	@touch node_modules

run: yarn.lock node_modules
	@vite

build: yarn.lock node_modules
	@vite build

test: yarn.lock node_modules
	@yarn run test

caddy: yarn.lock
	@caddy file-server --browse --listen ':9999' --root .

.PHONY: test
