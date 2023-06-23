PATH := ./node_modules/.bin/:$(PATH)

node_modules yarn.lock: package.json
	@yarn install
	@touch node_modules

run: yarn.lock node_modules
	@vite

build: yarn.lock node_modules src/index.js
	@vite build

test: 
	@yarn run test
.PHONY: test

coverage: 
	@yarn run coverage
.PHONY: coverage

caddy: yarn.lock
	@caddy file-server --browse --listen ':9999' --root .
.PHONY: caddy
